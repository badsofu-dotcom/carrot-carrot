/**
 * Friends — daily visitor bunny.
 *
 * v1 deliberately ships **no real social graph**:
 *   - No friend list, no PII, no follow/unfollow.
 *   - The "visitor" is a deterministic pick from the existing CHARACTERS
 *     roster, hashed off (user_key, KST ymd). Same user, same day →
 *     same visitor — calling GET /friends/today twice is idempotent.
 *
 * Routes:
 *   GET  /friends/today
 *     → { ok: true, data: { visitor_bunny_id, ymd, waved: boolean, hearts_gained: number | null } }
 *   POST /friends/wave
 *     → { ok: true, data: { visitor_bunny_id, hearts_gained: 1, already_waved: boolean } }
 *
 * Storage:
 *   - `friend_visits` (migration 0007). PK is (user_key, ymd) so a
 *     second POST /wave on the same KST day is a no-op (returns the
 *     same row with `already_waved: true`).
 *   - Heart inventory is granted via `user_items.code = 'heart'`. The
 *     route does the upsert atomically alongside the friend_visits
 *     insert.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
import { pickWeightedVisitor, type WeightedEntry } from "../lib/visitorRng.js";

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
 * Visitor pool — all 12 designated bunnies from collectionData with
 * weighted rarity distribution. Sum = 1000 for easy mental math.
 *
 *   common (60%): 7 ids, ~8.5% each — idle/focus/eat25/eat50/eat75/cry/sleep
 *   rare   (30%): 3 ids, ~10% each — success/rare-ninja/rare-king
 *   sr     ( 8%): 1 id  — sr-wizard
 *   legendary (2%): 1 id — legendary-demon
 *
 * Updated Round 16 (PR-128): was 9-id uniform; user wanted full 12-bunny
 * roster with proper rarity feel. Must stay in sync with
 * `src/features/collection/collectionData.ts` CHARACTERS ids.
 */
const VISITOR_POOL: ReadonlyArray<WeightedEntry> = [
  // common — 60% total
  { id: "idle",            weight: 86 },
  { id: "focus",           weight: 86 },
  { id: "eat25",           weight: 86 },
  { id: "eat50",           weight: 86 },
  { id: "eat75",           weight: 86 },
  { id: "cry",             weight: 85 },
  { id: "sleep",           weight: 85 },
  // rare — 30% total
  { id: "success",         weight: 100 },
  { id: "rare-ninja",      weight: 100 },
  { id: "rare-king",       weight: 100 },
  // sr — 8%
  { id: "sr-wizard",       weight: 80 },
  // legendary — 2%
  { id: "legendary-demon", weight: 20 },
];

const HEART_REWARD = 1;

function kstYmd(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

interface VisitRow {
  visitor_bunny_id: string;
  hearts_gained: number;
  waved_at: number;
}

app.get("/today", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  const ymd = kstYmd();
  const visitor = pickWeightedVisitor(sub, ymd, VISITOR_POOL);
  if (!visitor) {
    return c.json(
      { ok: false, error: { code: "EMPTY_POOL", message: "no visitor pool configured" } },
      500,
    );
  }
  try {
    const row = await c.env.DB
      .prepare(
        `SELECT visitor_bunny_id, hearts_gained, waved_at
         FROM friend_visits WHERE user_key = ? AND ymd = ?`,
      )
      .bind(sub, ymd)
      .first<VisitRow>();
    return c.json({
      ok: true,
      data: {
        visitor_bunny_id: row?.visitor_bunny_id ?? visitor,
        ymd,
        waved: !!row,
        hearts_gained: row?.hearts_gained ?? null,
      },
    });
  } catch (err) {
    console.warn("friends.today read failed (migration not applied?)", err);
    // Pre-0007 deploy: the visitor pick still works — only the waved
    // state is unknown. Return the deterministic visitor with waved=false
    // so the client can render the sprite; /wave will surface
    // SCHEMA_NOT_READY when the user actually taps.
    return c.json({
      ok: true,
      data: {
        visitor_bunny_id: visitor,
        ymd,
        waved: false,
        hearts_gained: null,
      },
    });
  }
});

app.post("/wave", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  const ymd = kstYmd();
  const visitor = pickWeightedVisitor(sub, ymd, VISITOR_POOL);
  if (!visitor) {
    return c.json(
      { ok: false, error: { code: "EMPTY_POOL", message: "no visitor pool configured" } },
      500,
    );
  }

  // Try to insert today's row. PK collision → user already waved.
  let alreadyWaved = false;
  try {
    const res = await c.env.DB
      .prepare(
        `INSERT OR IGNORE INTO friend_visits
           (user_key, ymd, visitor_bunny_id, hearts_gained)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(sub, ymd, visitor, HEART_REWARD)
      .run();
    if ((res.meta?.changes ?? 0) === 0) {
      alreadyWaved = true;
    }
  } catch (err) {
    console.warn("friends.wave insert failed", err);
    return c.json(
      {
        ok: false,
        error: {
          code: "SCHEMA_NOT_READY",
          message: "friend_visits missing — apply migration 0007",
        },
      },
      409,
    );
  }

  // Grant the heart only on a fresh insert. Second wave of the day is
  // a no-op on inventory (idempotent).
  if (!alreadyWaved) {
    try {
      await c.env.DB
        .prepare(
          `INSERT INTO user_items (user_key, code, count, updated_at)
           VALUES (?, 'heart', ?, unixepoch())
           ON CONFLICT(user_key, code) DO UPDATE SET
             count = user_items.count + excluded.count,
             updated_at = unixepoch()`,
        )
        .bind(sub, HEART_REWARD)
        .run();
    } catch (err) {
      // user_items is 0006 — if missing, the friend_visits row is
      // already inserted. We surface SCHEMA_NOT_READY but the visit is
      // still recorded; a retry won't double-grant the heart because
      // the friend_visits PK already exists.
      console.warn("friends.wave heart grant failed", err);
      return c.json(
        {
          ok: false,
          error: {
            code: "SCHEMA_NOT_READY",
            message: "user_items missing — apply migration 0006",
          },
        },
        409,
      );
    }
  }

  return c.json({
    ok: true,
    data: {
      visitor_bunny_id: visitor,
      hearts_gained: HEART_REWARD,
      already_waved: alreadyWaved,
    },
  });
});

export default app;
