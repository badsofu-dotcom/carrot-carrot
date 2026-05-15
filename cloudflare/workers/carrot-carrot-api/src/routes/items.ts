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
 * Ad-token verification:
 *   - When the client opts in (passes `nonce` in the POST body) or
 *     `env.TOSS_AD_VERIFY_KEY` is set, `verifyAdToken` runs first. A
 *     duplicate / invalid nonce blocks the consumption. This protects
 *     ad-rewarded redeems (bolt / juice / etc.). For bag-internal item
 *     consumption (no ad involved) the client simply omits `nonce` and
 *     this layer is skipped — unless verifyKey is configured globally.
 *
 * Code whitelist — for now the route trusts any string `code` and only
 * enforces "row must exist with count > 0". This is safe because UPDATE
 * never creates a row. A future PR can tighten this to the literal
 * ItemCode union.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
import { verifyAdToken } from "../lib/adToken.js";

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
  let body: { code?: unknown; nonce?: unknown; signedToken?: unknown } = {};
  try {
    body = (await c.req.json()) as {
      code?: unknown;
      nonce?: unknown;
      signedToken?: unknown;
    };
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

  const nonce = typeof body.nonce === "string" ? body.nonce : undefined;
  const signedToken =
    typeof body.signedToken === "string" ? body.signedToken : undefined;
  const verifyKey = c.env.TOSS_AD_VERIFY_KEY;

  // Only run ad-token check when the client opted in (sent a nonce) or
  // when production verifyKey is configured globally. Bag-internal item
  // consumption stays trust-on-auth.
  if (verifyKey || nonce) {
    const ad = await verifyAdToken({
      db: c.env.DB,
      userKey: sub,
      channel: "item_use",
      nonce,
      signedToken,
      verifyKey,
    });
    if (!ad.ok) {
      const status =
        ad.error === "DUPLICATE_NONCE"
          ? 409
          : ad.error === "INVALID_SIG"
            ? 401
            : ad.error === "MISSING_NONCE"
              ? 400
              : 409;
      return c.json(
        { ok: false, error: { code: ad.error, message: ad.message } },
        status,
      );
    }
  }

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
