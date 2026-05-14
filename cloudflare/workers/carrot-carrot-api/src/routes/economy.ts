/**
 * Economy routes (scaffold).
 *
 * IMPORTANT: The real executePromotion call to Toss is gated behind two
 * env vars:
 *   - TOSS_PROMOTION_API_BASE
 *   - TOSS_PROMOTION_API_KEY
 * If either is missing the route returns CONFIG_REQUIRED instead of
 * silently no-oping or, worse, granting points without recording them.
 *
 * Migration 0003_economy.sql must be applied for these routes to work.
 * Until then GET endpoints return zero values and POST endpoints return
 * CONFIG_REQUIRED.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";

interface EconomyEnv extends Env {
  TOSS_PROMOTION_API_BASE?: string;
  TOSS_PROMOTION_API_KEY?: string;
}

type AppContext = Context<{ Bindings: EconomyEnv }>;

const app = new Hono<{ Bindings: EconomyEnv }>();

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
      { ok: false, error: { code: "UNAUTHORIZED", message: "invalid token" } },
      401,
    );
  }
  return claims.sub;
}

function isPromotionConfigured(env: EconomyEnv): boolean {
  return Boolean(env.TOSS_PROMOTION_API_BASE && env.TOSS_PROMOTION_API_KEY);
}

/** GET /economy/balance — current pending balance + lifetime total. */
app.get("/balance", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;

  try {
    const row = await c.env.DB.prepare(
      "SELECT pending, lifetime_total FROM pending_points WHERE user_key = ?1",
    )
      .bind(sub)
      .first<{ pending: number; lifetime_total: number }>();

    return c.json({
      ok: true,
      data: {
        pending: row?.pending ?? 0,
        lifetimeTotal: row?.lifetime_total ?? 0,
        withdrawEnabled: isPromotionConfigured(c.env),
      },
    });
  } catch (err) {
    // Table may not exist yet — migration 0003 not applied. Return
    // zeroed values rather than 500 so the frontend can render the
    // placeholder.
    console.warn("economy.balance fallback (migration not applied?)", err);
    return c.json({
      ok: true,
      data: {
        pending: 0,
        lifetimeTotal: 0,
        withdrawEnabled: false,
      },
    });
  }
});

/** POST /economy/withdraw — request a Toss promotion payout. */
app.post("/withdraw", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;

  if (!isPromotionConfigured(c.env)) {
    return c.json(
      {
        ok: false,
        error: {
          code: "CONFIG_REQUIRED",
          message:
            "Toss promotion API not configured — set TOSS_PROMOTION_API_BASE / TOSS_PROMOTION_API_KEY",
        },
      },
      503,
    );
  }

  // Real executePromotion call lives here once the env is wired.
  // Intentionally not implemented yet — see ECONOMY_DESIGN.md.
  return c.json(
    {
      ok: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "withdraw is staged but not yet enabled",
      },
    },
    501,
  );
});

/** POST /economy/ad-view — record a rewarded ad attempt. */
app.post("/ad-view", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;

  let body: { placement?: unknown; status?: unknown; network?: unknown } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    /* tolerate empty body */
  }
  const placement = typeof body.placement === "string" ? body.placement : null;
  const status = typeof body.status === "string" ? body.status : null;
  const network = typeof body.network === "string" ? body.network : "mock";

  if (!placement || !status) {
    return c.json(
      {
        ok: false,
        error: { code: "BAD_REQUEST", message: "placement and status are required" },
      },
      400,
    );
  }

  // SECURITY: a reward is granted only when status === "completed" AND
  // the network confirms via a signed callback. dismissed / error never
  // grant points. Until the SDK is wired we log the attempt but never
  // grant.
  try {
    await c.env.DB.prepare(
      "INSERT INTO ad_views (user_key, placement, network, status) VALUES (?1, ?2, ?3, ?4)",
    )
      .bind(sub, placement, network, status)
      .run();
  } catch (err) {
    console.warn("economy.ad-view insert failed (migration not applied?)", err);
  }

  return c.json({
    ok: true,
    data: { rewarded: false, reason: "ad_reward_pending_sdk_integration" },
  });
});

export default app;
