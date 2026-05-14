/**
 * Items routes — inventory CRUD for the 13-item bag.
 *
 * Migration 0006 (`user_items`) backs every read/write. Every route is
 * wrapped in try/catch so a pre-0006 deploy returns 409 SCHEMA_NOT_READY
 * rather than crashing; the client falls back to `useItemsStore` until
 * the migration is applied.
 *
 * Routes:
 *   GET  /items/inventory                  → { items: [{code, count}] }
 *   POST /items/use   { code, nonce? }     → consumes 1 item if owned;
 *                                              returns the resulting
 *                                              inventory row.
 *
 * TODO before production:
 *   - tighten the `code` whitelist to the literal ItemCode union
 *     (mirror lib/itemsStore.ts) so unknown rows can't be created.
 *   - join with `ad_redeem_nonces` when /items/use is triggered by an
 *     ad-watch redeem (bolt / juice etc.).
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";

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

interface ItemRow {
  code: string;
  count: number;
}

async function readInventory(
  db: D1Database,
  userKey: string,
): Promise<ItemRow[] | null> {
  try {
    const r = await db
      .prepare(`SELECT code, count FROM user_items WHERE user_key = ?`)
      .bind(userKey)
      .all<ItemRow>();
    return r.results ?? [];
  } catch {
    return null;
  }
}

app.get("/inventory", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  const rows = await readInventory(c.env.DB, sub);
  if (rows === null) {
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
  return c.json({ ok: true, items: rows });
});

app.post("/use", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  let body: { code?: unknown; nonce?: unknown } = {};
  try {
    body = (await c.req.json()) as { code?: unknown; nonce?: unknown };
  } catch {
    /* tolerate empty */
  }
  const code = typeof body.code === "string" ? body.code : "";
  if (!code) {
    return c.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "code required" } },
      400,
    );
  }
  // TODO: validate `code` against a whitelist mirroring ItemCode.
  try {
    const res = await c.env.DB
      .prepare(
        `UPDATE user_items
         SET count = count - 1, updated_at = unixepoch()
         WHERE user_key = ? AND code = ? AND count > 0`,
      )
      .bind(sub, code)
      .run();
    if ((res.meta?.changes ?? 0) === 0) {
      return c.json(
        {
          ok: false,
          error: { code: "INSUFFICIENT", message: "item not owned" },
        },
        409,
      );
    }
  } catch {
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
  const after = await readInventory(c.env.DB, sub);
  return c.json({
    ok: true,
    item: after?.find((r) => r.code === code) ?? { code, count: 0 },
  });
});

export default app;
