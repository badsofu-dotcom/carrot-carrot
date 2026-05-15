/**
 * Tool state routes — watering-can charges + ad-refill counter.
 *
 * Routes:
 *   GET  /tools/state   — current state (auto-resets at KST midnight)
 *   POST /tools/use     — body { tool: "watering_can" } → decrement charges
 *   POST /tools/refill  — apply one ad refill (+3 charges, max 3/day)
 *   POST /tools/seed    — convenience wrapper for client/plant flow
 *   POST /tools/harvest — convenience wrapper for client/harvest flow
 *
 * Migration: 0005_tools.sql. The route is wrapped in try/catch so a
 * pre-0005 deploy returns `{ ok: false, code: "SCHEMA_NOT_READY" }`
 * rather than 500 — the client falls back to its local toolStore.
 *
 * `/tools/refill` accepts an optional `{ nonce, signedToken }` pair.
 *   - When `env.TOSS_AD_VERIFY_KEY` is set (production), the pair is
 *     REQUIRED and verified via `verifyAdToken` — see lib/adToken.ts.
 *   - When the key is NOT set (preview/staging), a nonce alone is used
 *     as an idempotency token; signedToken is optional.
 *   - When neither is sent, the route falls back to the legacy
 *     trust-the-client mode and only the 3/day cap applies.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
import {
  getFarmState,
  growAllPlots,
  harvestPlot,
  plantPlot,
} from "../lib/db.js";
import { verifyAdToken, type AdTokenChannel } from "../lib/adToken.js";

const MAX_DAILY = 10;
const MAX_AD_REFILLS = 3;
const AD_REFILL_AMOUNT = 3;

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
 * Next KST midnight as a unix-second timestamp. KST is UTC+9 so we
 * compute KST time first, advance to the start of the next day, then
 * convert back to UTC.
 */
function nextKstMidnightUnix(now: number = Math.floor(Date.now() / 1000)): number {
  const KST = 9 * 3600;
  const kstNow = now + KST;
  const nextKstMid = Math.floor(kstNow / 86400) * 86400 + 86400;
  return nextKstMid - KST;
}

interface ToolStateRow {
  watering_can_left: number;
  watering_can_resets_at: number;
  ad_refills_today: number;
}

async function readToolState(
  db: D1Database,
  userKey: string,
): Promise<ToolStateRow | null> {
  try {
    const r = await db
      .prepare(
        `SELECT watering_can_left, watering_can_resets_at, ad_refills_today
         FROM tool_state WHERE user_key = ?`,
      )
      .bind(userKey)
      .first<ToolStateRow>();
    return r ?? null;
  } catch {
    return null;
  }
}

async function ensureToolState(
  db: D1Database,
  userKey: string,
): Promise<ToolStateRow | null> {
  const cur = await readToolState(db, userKey);
  if (cur) {
    // Roll over if the reset window passed.
    if (cur.watering_can_resets_at <= Math.floor(Date.now() / 1000)) {
      const nextReset = nextKstMidnightUnix();
      try {
        await db
          .prepare(
            `UPDATE tool_state SET
               watering_can_left = ?,
               watering_can_resets_at = ?,
               ad_refills_today = 0,
               updated_at = unixepoch()
             WHERE user_key = ?`,
          )
          .bind(MAX_DAILY, nextReset, userKey)
          .run();
      } catch {
        return cur;
      }
      return {
        watering_can_left: MAX_DAILY,
        watering_can_resets_at: nextReset,
        ad_refills_today: 0,
      };
    }
    return cur;
  }
  // First-time row.
  const nextReset = nextKstMidnightUnix();
  try {
    await db
      .prepare(
        `INSERT INTO tool_state
           (user_key, watering_can_left, watering_can_resets_at, ad_refills_today, updated_at)
         VALUES (?, ?, ?, 0, unixepoch())`,
      )
      .bind(userKey, MAX_DAILY, nextReset)
      .run();
  } catch {
    return null;
  }
  return {
    watering_can_left: MAX_DAILY,
    watering_can_resets_at: nextReset,
    ad_refills_today: 0,
  };
}

function shape(state: ToolStateRow | null) {
  if (!state) {
    return {
      ok: false as const,
      error: {
        code: "SCHEMA_NOT_READY",
        message: "tool_state table missing — apply migration 0005",
      },
    };
  }
  return {
    ok: true as const,
    watering_can_left: state.watering_can_left,
    watering_can_resets_at: state.watering_can_resets_at,
    ad_refills_today: state.ad_refills_today,
  };
}

app.get("/state", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  const st = await ensureToolState(c.env.DB, sub);
  return c.json(shape(st));
});

app.post("/use", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  let body: { tool?: unknown } = {};
  try {
    body = (await c.req.json()) as { tool?: unknown };
  } catch {
    /* tolerate empty body */
  }
  if (body.tool !== "watering_can") {
    // Only watering_can is metered; the other tools are free actions
    // that don't change tool_state. Return the current snapshot so the
    // client UI is in sync.
    const st = await ensureToolState(c.env.DB, sub);
    return c.json(shape(st));
  }
  const st = await ensureToolState(c.env.DB, sub);
  if (!st) return c.json(shape(null), 409);
  if (st.watering_can_left <= 0) {
    return c.json(
      {
        ok: false as const,
        error: { code: "WATERING_EMPTY", message: "watering can empty" },
        watering_can_left: st.watering_can_left,
        watering_can_resets_at: st.watering_can_resets_at,
        ad_refills_today: st.ad_refills_today,
      },
      409,
    );
  }
  try {
    await c.env.DB
      .prepare(
        `UPDATE tool_state SET
           watering_can_left = watering_can_left - 1,
           updated_at = unixepoch()
         WHERE user_key = ? AND watering_can_left > 0`,
      )
      .bind(sub)
      .run();
  } catch {
    return c.json(shape(null), 500);
  }
  const after = await readToolState(c.env.DB, sub);
  return c.json(shape(after));
});

app.post("/refill", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;

  let body: { nonce?: unknown; signedToken?: unknown } = {};
  try {
    body = (await c.req.json()) as { nonce?: unknown; signedToken?: unknown };
  } catch {
    /* tolerate empty body */
  }
  const nonce = typeof body.nonce === "string" ? body.nonce : undefined;
  const signedToken =
    typeof body.signedToken === "string" ? body.signedToken : undefined;
  const verifyKey = c.env.TOSS_AD_VERIFY_KEY;

  // Production: verifyKey is configured ⇒ nonce + signedToken are required.
  // Preview: nonce alone (if provided) is used as an idempotency check.
  if (verifyKey || nonce) {
    const ad = await verifyAdToken({
      db: c.env.DB,
      userKey: sub,
      channel: "watering" satisfies AdTokenChannel,
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

  const st = await ensureToolState(c.env.DB, sub);
  if (!st) return c.json(shape(null), 409);
  if (st.ad_refills_today >= MAX_AD_REFILLS) {
    return c.json(
      {
        ok: false as const,
        error: { code: "AD_REFILL_CAP", message: "max ad refills today" },
        watering_can_left: st.watering_can_left,
        watering_can_resets_at: st.watering_can_resets_at,
        ad_refills_today: st.ad_refills_today,
      },
      409,
    );
  }
  const nextLeft = Math.min(MAX_DAILY, st.watering_can_left + AD_REFILL_AMOUNT);
  try {
    await c.env.DB
      .prepare(
        `UPDATE tool_state SET
           watering_can_left = ?,
           ad_refills_today = ad_refills_today + 1,
           updated_at = unixepoch()
         WHERE user_key = ?`,
      )
      .bind(nextLeft, sub)
      .run();
  } catch {
    return c.json(shape(null), 500);
  }
  const after = await readToolState(c.env.DB, sub);
  return c.json(shape(after));
});

/**
 * `/tools/seed` and `/tools/harvest` are convenience wrappers so the
 * client can express intent ("I'm using the seed pack on slot N")
 * without juggling /farm/plant and /farm/harvest separately. They
 * return the combined { tool state, farm state } payload so the
 * client UI can update both inventories from one network round-trip.
 */
app.post("/seed", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  let body: { slotIndex?: unknown } = {};
  try {
    body = (await c.req.json()) as { slotIndex?: unknown };
  } catch {
    /* empty */
  }
  const slotIndex = Number(body.slotIndex);
  const res = await plantPlot(c.env.DB, sub, slotIndex);
  if (!res.ok) {
    return c.json(
      {
        ok: false,
        error: {
          code: res.reason === "invalid" ? "BAD_REQUEST" : "PLOT_OCCUPIED",
          message: res.reason ?? "plant failed",
        },
      },
      res.reason === "invalid" ? 400 : 409,
    );
  }
  const [farm, st] = await Promise.all([
    getFarmState(c.env.DB, sub),
    ensureToolState(c.env.DB, sub),
  ]);
  return c.json({
    ok: true,
    farm,
    tool: shape(st),
  });
});

app.post("/harvest", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;
  let body: { slotIndex?: unknown } = {};
  try {
    body = (await c.req.json()) as { slotIndex?: unknown };
  } catch {
    /* empty */
  }
  const slotIndex = Number(body.slotIndex);
  const res = await harvestPlot(c.env.DB, sub, slotIndex);
  if (!res.ok) {
    return c.json(
      {
        ok: false,
        error: {
          code: res.reason === "invalid" ? "BAD_REQUEST" : "PLOT_NOT_READY",
          message: res.reason ?? "harvest failed",
        },
      },
      res.reason === "invalid" ? 400 : 409,
    );
  }
  const [farm, st] = await Promise.all([
    getFarmState(c.env.DB, sub),
    ensureToolState(c.env.DB, sub),
  ]);
  return c.json({
    ok: true,
    farm,
    tool: shape(st),
  });
});

// Suppress unused-import warnings — these helpers are intentionally
// referenced for future tools that grow plots via the /tools surface.
void growAllPlots;

export default app;
