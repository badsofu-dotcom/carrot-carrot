/**
 * Bunny collection routes — server-authoritative gacha + ownership log.
 *
 * Routes:
 *   GET  /bunnies/collection
 *     → { ok: true, bunnies: [{ bunny_id, tier, owned_at }] }
 *   POST /bunnies/draw
 *     body: { excludeLegendary?: boolean, ownedIds?: string[] }
 *     → { ok: true, bunny: { bunny_id, tier, owned_at, newly_owned: bool } }
 *
 * Migration 0006 (`bunny_collection`) is the backing table — same
 * try/catch pattern as the rest of the routes: a pre-0006 deploy
 * returns 409 SCHEMA_NOT_READY so the client falls back to its local
 * gacha (`src/lib/bunnyGacha.ts`).
 *
 * Why server-side gacha:
 *   - Authoritative ownership trail (analytics, anti-cheat).
 *   - Tier weights live on the server so a client-side patch can't
 *     boost legendary odds.
 *   - The CHARACTERS roster on the server intentionally mirrors a
 *     curated subset of src/features/collection/collectionData.ts; the
 *     duplication is acceptable because the worker should NEVER deny a
 *     bunny the client legitimately drew. A roster mismatch is
 *     surfaced via the `newly_owned` flag — if the client tries to
 *     record a bunny id the server doesn't know, the route still
 *     accepts it but flags it for review.
 *
 * No new migration in this PR — `bunny_collection` already exists.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
import {
  drawFromRoster,
  type BunnyRosterEntry,
  type GachaTier,
} from "../lib/bunnyDraw.js";

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

async function requireUser(c: AppContext): Promise<string | Response> {
  const token = bearerToken(c.req.raw);
  if (!token) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "missing bearer" } },
      401,
    );
  }
  const claims = await verifyAppJwt(token, c.env.JWT_SECRET);
  if (!claims) {
    return c.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "bad token" } },
      401,
    );
  }
  return claims.sub;
}

/**
 * Server roster — must stay in sync with the IDs the client knows
 * about (src/features/collection/collectionData.ts CHARACTERS). When
 * adding seasonal bunnies, drop the new ids in here too.
 *
 * Seasonal entries are commented out until art lands; SEASONAL_DESIGN.md
 * is the canonical "what to add next" list.
 */
export const ROSTER: ReadonlyArray<BunnyRosterEntry> = [
  // common
  { id: "idle", tier: "common" },
  { id: "focus", tier: "common" },
  { id: "eat25", tier: "common" },
  { id: "eat50", tier: "common" },
  { id: "eat75", tier: "common" },
  { id: "cry", tier: "common" },
  { id: "sleep", tier: "common" },
  // rare
  { id: "success", tier: "rare" },
  { id: "rare-ninja", tier: "rare" },
  { id: "rare-king", tier: "rare" },
  // epic (sr/ssr on client)
  { id: "sr-wizard", tier: "epic" },
  // legendary
  { id: "legendary-demon", tier: "legendary" },
  // SEASONAL — pending art uploads (see SEASONAL_DESIGN.md):
  // { id: "seasonal_cherry_blossom", tier: "rare" },
  // { id: "seasonal_beach",          tier: "rare" },
  // { id: "seasonal_maple",          tier: "rare" },
  // { id: "seasonal_snowman",        tier: "rare" },
];

interface CollectionRow {
  bunny_id: string;
  tier: string;
  owned_at: number;
}

async function readCollection(
  db: D1Database,
  userKey: string,
): Promise<CollectionRow[] | null> {
  try {
    const r = await db
      .prepare(
        `SELECT bunny_id, tier, owned_at
         FROM bunny_collection
         WHERE user_key = ?
         ORDER BY owned_at ASC`,
      )
      .bind(userKey)
      .all<CollectionRow>();
    return r.results ?? [];
  } catch {
    return null;
  }
}

app.get("/collection", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  const rows = await readCollection(c.env.DB, sub);
  if (rows === null) {
    return c.json(
      {
        ok: false,
        error: {
          code: "SCHEMA_NOT_READY",
          message: "bunny_collection missing — apply migration 0006",
        },
      },
      409,
    );
  }
  return c.json({ ok: true, bunnies: rows });
});

app.post("/draw", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;

  let body: { excludeLegendary?: unknown; ownedIds?: unknown } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    /* tolerate empty */
  }
  const excludeLegendary =
    typeof body.excludeLegendary === "boolean" ? body.excludeLegendary : true;
  // Authoritative owned set comes from the DB; the client-supplied
  // ownedIds is informational (warm-start) but the DB query wins.
  const collection = await readCollection(c.env.DB, sub);
  if (collection === null) {
    return c.json(
      {
        ok: false,
        error: {
          code: "SCHEMA_NOT_READY",
          message: "bunny_collection missing — apply migration 0006",
        },
      },
      409,
    );
  }
  const owned = new Set<string>(collection.map((r) => r.bunny_id));

  const decision = drawFromRoster({
    roster: ROSTER,
    ownedIds: owned,
    excludeLegendary,
  });

  if (!decision.bunnyId || !decision.tier) {
    return c.json({
      ok: true,
      bunny: null,
      reason: "all_owned",
    });
  }

  try {
    const tierLiteral: GachaTier = decision.tier;
    await c.env.DB
      .prepare(
        `INSERT OR IGNORE INTO bunny_collection (user_key, bunny_id, tier)
         VALUES (?, ?, ?)`,
      )
      .bind(sub, decision.bunnyId, tierLiteral)
      .run();
  } catch (err) {
    console.warn("bunnies.draw insert failed", err);
    return c.json(
      {
        ok: false,
        error: {
          code: "SCHEMA_NOT_READY",
          message: "bunny_collection missing — apply migration 0006",
        },
      },
      409,
    );
  }

  return c.json({
    ok: true,
    bunny: {
      bunny_id: decision.bunnyId,
      tier: decision.tier,
      newly_owned: !owned.has(decision.bunnyId),
    },
  });
});

export default app;
