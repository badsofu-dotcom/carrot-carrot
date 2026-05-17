/**
 * Economy routes — pending balance, ad-view audit, Toss promotion withdraw.
 *
 * Live payout path:
 *   - `/economy/balance` reads pending_points (migration 0003).
 *   - `/economy/withdraw` decrements pending_points via a CAS update,
 *     inserts a `pending` row into promotion_withdrawals, then calls
 *     Toss `executePromotion`. On upstream failure we roll the balance
 *     back and mark the withdrawal row `failed`.
 *   - `/economy/ad-view` logs every rewarded-ad attempt and (when a
 *     signed nonce + TOSS_AD_VERIFY_KEY are present) verifies the ad
 *     token via `verifyAdToken`.
 *
 * Config gate:
 *   - TOSS_PROMOTION_API_BASE + TOSS_PROMOTION_API_KEY must both be set
 *     as `wrangler secret put` values. Until they are, `/withdraw`
 *     short-circuits with 503 CONFIG_REQUIRED. This is the canonical
 *     way the worker keeps real money disabled in preview/staging.
 *
 * Migration prerequisites:
 *   - 0003_economy.sql (pending_points, point_grants, daily_caps,
 *     ad_views, promotion_withdrawals).
 *   - 0006_items.sql (ad_redeem_nonces — used by verifyAdToken).
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types.js";
import { bearerToken, verifyAppJwt } from "../lib/jwt.js";
import { executePromotion } from "../lib/toss.js";
import { verifyAdToken } from "../lib/adToken.js";

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

const MIN_PAYOUT_P = 50;

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

function isPromotionConfigured(env: Env): boolean {
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
        minPayout: MIN_PAYOUT_P,
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
        minPayout: MIN_PAYOUT_P,
      },
    });
  }
});

/**
 * POST /economy/withdraw
 *   body: { amount: number }
 *   200: { ok:true, data:{ txid, status, newPending } }
 *   400: BELOW_MIN              — amount < MIN_PAYOUT_P
 *   409: INSUFFICIENT           — pending balance < amount
 *   409: CONCURRENT_UPDATE      — CAS lost; retry
 *   409: SCHEMA_NOT_READY       — migration 0003 not applied
 *   502: UPSTREAM_FAILED        — Toss responded with non-success; balance refunded
 *   503: CONFIG_REQUIRED        — secrets not configured
 */
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

  let body: { amount?: unknown } = {};
  try {
    body = (await c.req.json()) as { amount?: unknown };
  } catch {
    /* tolerate empty body */
  }
  const amountP = Number.isFinite(Number(body.amount))
    ? Math.floor(Number(body.amount))
    : 0;
  if (amountP < MIN_PAYOUT_P) {
    return c.json(
      {
        ok: false,
        error: { code: "BELOW_MIN", message: `minimum payout is ${MIN_PAYOUT_P}P` },
      },
      400,
    );
  }

  // 1) Snapshot current pending row (for CAS).
  let beforeRow:
    | { pending: number; lifetime_total: number; updated_at: number }
    | null = null;
  try {
    beforeRow = await c.env.DB
      .prepare(
        "SELECT pending, lifetime_total, updated_at FROM pending_points WHERE user_key = ?",
      )
      .bind(sub)
      .first<{ pending: number; lifetime_total: number; updated_at: number }>();
  } catch (err) {
    console.warn("withdraw: pending_points read failed", err);
    return c.json(
      {
        ok: false,
        error: {
          code: "SCHEMA_NOT_READY",
          message: "pending_points missing — apply migration 0003",
        },
      },
      409,
    );
  }
  if (!beforeRow || beforeRow.pending < amountP) {
    return c.json(
      {
        ok: false,
        error: { code: "INSUFFICIENT", message: "pending balance too low" },
      },
      409,
    );
  }

  // 2) CAS decrement — only proceeds if `updated_at` hasn't moved AND pending
  //    still covers the amount. This is the concurrency guard against two
  //    /withdraw calls landing simultaneously.
  let dec;
  try {
    dec = await c.env.DB
      .prepare(
        `UPDATE pending_points
           SET pending = pending - ?,
               updated_at = unixepoch()
         WHERE user_key = ?
           AND pending >= ?
           AND updated_at = ?`,
      )
      .bind(amountP, sub, amountP, beforeRow.updated_at)
      .run();
  } catch (err) {
    console.warn("withdraw: CAS update failed", err);
    return c.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "cas update failed" } },
      500,
    );
  }
  if ((dec.meta?.changes ?? 0) === 0) {
    return c.json(
      {
        ok: false,
        error: {
          code: "CONCURRENT_UPDATE",
          message: "balance changed concurrently — retry",
        },
      },
      409,
    );
  }

  // 3) Insert a pending withdrawal row — gives us the stable id we'll use
  //    as the Toss idempotencyKey.
  let withdrawalId: number;
  try {
    const ins = await c.env.DB
      .prepare(
        `INSERT INTO promotion_withdrawals (user_key, amount, status)
         VALUES (?, ?, 'pending')`,
      )
      .bind(sub, amountP)
      .run();
    withdrawalId = Number(ins.meta?.last_row_id ?? 0);
  } catch (err) {
    // Roll the balance back — without a row we have no audit anchor.
    await refundPending(c.env.DB, sub, amountP).catch(() => {});
    console.warn("withdraw: insert promotion_withdrawals failed", err);
    return c.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "audit insert failed" } },
      500,
    );
  }
  const idempotencyKey = `cc-w-${withdrawalId}`;

  // 4) Call Toss. On any non-success we refund and mark the row failed.
  const result = await executePromotion(c.env, sub, amountP, idempotencyKey);
  if ("error" in result) {
    await refundPending(c.env.DB, sub, amountP).catch(() => {});
    try {
      await c.env.DB
        .prepare(
          `UPDATE promotion_withdrawals
             SET status = 'failed',
                 failure = ?,
                 settled_at = unixepoch()
           WHERE id = ?`,
        )
        .bind(safeFailureSnippet(result), withdrawalId)
        .run();
    } catch (err) {
      console.warn("withdraw: failed-row update failed", err);
    }
    return c.json(
      {
        ok: false,
        error: {
          code: "UPSTREAM_FAILED",
          message: "promotion call failed; balance refunded",
        },
      },
      502,
    );
  }

  // 5) Success — record the txid + final status.
  try {
    await c.env.DB
      .prepare(
        `UPDATE promotion_withdrawals
           SET toss_txid = ?, status = ?, settled_at = unixepoch()
         WHERE id = ?`,
      )
      .bind(result.txid, result.status, withdrawalId)
      .run();
  } catch (err) {
    console.warn("withdraw: success-row update failed", err);
  }

  // Lifetime total stays a separate accumulator (analytics-only). We
  // don't decrement it on withdraw, but we do track total successful
  // withdrawals via promotion_withdrawals.amount above.
  return c.json({
    ok: true,
    data: {
      txid: result.txid,
      status: result.status,
      newPending: beforeRow.pending - amountP,
    },
  });
});

async function refundPending(
  db: D1Database,
  userKey: string,
  amountP: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE pending_points
         SET pending = pending + ?,
             updated_at = unixepoch()
       WHERE user_key = ?`,
    )
    .bind(amountP, userKey)
    .run();
}

function safeFailureSnippet(err: { error: string; upstream?: { status?: number; bodySnippet?: string } }): string {
  // The Toss helpers already redact sensitive fields; we just compact
  // the diagnostic object so the column stays bounded.
  const code = err.error;
  const status = err.upstream?.status ?? 0;
  const snippet = err.upstream?.bodySnippet ?? "";
  return JSON.stringify({ code, status, snippet }).slice(0, 1024);
}

/** POST /economy/ad-view — record a rewarded ad attempt. */
app.post("/ad-view", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;

  let body: {
    placement?: unknown;
    status?: unknown;
    network?: unknown;
    nonce?: unknown;
    signedToken?: unknown;
  } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    /* tolerate empty body */
  }
  const placement = typeof body.placement === "string" ? body.placement : null;
  const status = typeof body.status === "string" ? body.status : null;
  const network = typeof body.network === "string" ? body.network : "mock";
  const nonce = typeof body.nonce === "string" ? body.nonce : undefined;
  const signedToken =
    typeof body.signedToken === "string" ? body.signedToken : undefined;

  if (!placement || !status) {
    return c.json(
      {
        ok: false,
        error: { code: "BAD_REQUEST", message: "placement and status are required" },
      },
      400,
    );
  }

  // ALL ad attempts are logged regardless of status; reward grants are
  // a separate code path (handled by /tools/refill, /items/use, /boxes/*).
  try {
    await c.env.DB.prepare(
      "INSERT INTO ad_views (user_key, placement, network, status) VALUES (?1, ?2, ?3, ?4)",
    )
      .bind(sub, placement, network, status)
      .run();
  } catch (err) {
    console.warn("economy.ad-view insert failed (migration not applied?)", err);
  }

  // Optional verification: if the client passed a nonce we run
  // verifyAdToken so the audit log also reflects whether the signed
  // ad-token was valid. Failures are recorded but do not 500 — they
  // just return `rewarded:false` with the reason.
  let verifyOutcome: { rewarded: false; reason: string } = {
    rewarded: false,
    reason: "ad_reward_pending_sdk_integration",
  };
  if (status === "completed" && nonce) {
    const v = await verifyAdToken({
      db: c.env.DB,
      userKey: sub,
      channel: placementToChannel(placement),
      nonce,
      signedToken,
      verifyKey: c.env.TOSS_AD_VERIFY_KEY,
    });
    if (v.ok) {
      // Verification succeeded — the actual reward grant happens at the
      // channel-specific route (refill / box / item). This endpoint
      // remains an audit log only.
      verifyOutcome = { rewarded: false, reason: "verified_pending_channel_grant" };
    } else {
      verifyOutcome = { rewarded: false, reason: `verify_${v.error}` };
    }
  }

  return c.json({ ok: true, data: verifyOutcome });
});

function placementToChannel(placement: string): "watering" | "gift" | "treasure" | "item_use" {
  if (placement === "watering" || placement === "watering_can") return "watering";
  if (placement === "gift" || placement === "daily_gift") return "gift";
  if (placement === "treasure" || placement === "weekly_treasure") return "treasure";
  return "item_use";
}

// ----------------------------------------------------------------------
// PR-116 — server-side dailyCap enforcement.
//
// 클라이언트 (lib/economy/dailyCap.ts) 가 100 P (+10 dogam) 캡을 추적
// 하지만 localStorage tamper 가능. server 가 daily_caps 의
// reward_points_total 로 권위 있는 quota 관리.
//
// 호출 패턴:
//   POST /economy/grant { source, points }
//   → server: check today's reward_points_total + points <= CAP_MAX
//     - 통과 → INSERT point_grants + UPDATE daily_caps + UPDATE
//       pending_points + return { granted: points }
//     - 초과 → partial grant (cap 까지만) + return { granted: < points }
//     - 이미 도달 → 0 grant + return { granted: 0, capReached: true }
//
// 클라이언트가 fire-and-forget 호출. 실패해도 클라 게임 흐름 막지 않음.
// 클라 cap 은 시각 진행도 / "🌙 오늘은 푹 쉬어요" 안내 용.
// ----------------------------------------------------------------------

const SERVER_BASE_DAILY_CAP = 100;
const SERVER_DOGAM_CAP_BOOST_MAX = 10; // dogam 100% 완성 시.

/** YYYY-MM-DD in KST. KST = UTC+9. */
function serverKstYmd(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

/**
 * POST /economy/grant
 * Body: { source: string, points: number }
 *
 * Response: { ok, data: { granted, totalToday, cap, capReached } }
 */
app.post("/grant", async (c) => {
  const sub = await requireUser(c);
  if (typeof sub !== "string") return sub;

  let body: { source?: unknown; points?: unknown } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { ok: false, error: { code: "BAD_BODY", message: "invalid json" } },
      400,
    );
  }
  const source = typeof body.source === "string" ? body.source : "unknown";
  const requested =
    typeof body.points === "number" &&
    Number.isFinite(body.points) &&
    body.points > 0
      ? Math.floor(body.points)
      : 0;

  if (requested === 0) {
    return c.json({
      ok: true,
      data: { granted: 0, totalToday: 0, cap: SERVER_BASE_DAILY_CAP, capReached: false },
    });
  }

  const ymd = serverKstYmd();
  // 현재 daily_caps row 조회.
  const row = await c.env.DB.prepare(
    "SELECT reward_points_total FROM daily_caps WHERE user_key = ?1 AND ymd = ?2",
  )
    .bind(sub, ymd)
    .first<{ reward_points_total: number }>();
  const currentTotal = row?.reward_points_total ?? 0;

  // dogam boost — bunnies_owned 카운트 기반. 12+ 면 +10P.
  const ownedRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM bunnies_owned WHERE user_key = ?1",
  )
    .bind(sub)
    .first<{ cnt: number }>();
  const dogamCount = ownedRow?.cnt ?? 0;
  const cap =
    SERVER_BASE_DAILY_CAP +
    (dogamCount >= 12 ? SERVER_DOGAM_CAP_BOOST_MAX : 0);

  const remaining = Math.max(0, cap - currentTotal);
  const granted = Math.min(requested, remaining);
  const nextTotal = currentTotal + granted;

  if (granted > 0) {
    // Upsert daily_caps.
    await c.env.DB.prepare(
      `INSERT INTO daily_caps (user_key, ymd, reward_points_total, updated_at)
       VALUES (?1, ?2, ?3, unixepoch())
       ON CONFLICT(user_key, ymd) DO UPDATE SET
         reward_points_total = reward_points_total + ?3,
         updated_at = unixepoch()`,
    )
      .bind(sub, ymd, granted)
      .run();

    // Append-only ledger.
    await c.env.DB.prepare(
      `INSERT INTO point_grants (user_key, ymd, source, kind, amount, created_at)
       VALUES (?1, ?2, ?3, 'p', ?4, unixepoch())`,
    )
      .bind(sub, ymd, source, granted)
      .run();

    // Pending balance update.
    await c.env.DB.prepare(
      `INSERT INTO pending_points (user_key, pending, lifetime_total, updated_at)
       VALUES (?1, ?2, ?2, unixepoch())
       ON CONFLICT(user_key) DO UPDATE SET
         pending = pending + ?2,
         lifetime_total = lifetime_total + ?2,
         updated_at = unixepoch()`,
    )
      .bind(sub, granted)
      .run();
  }

  return c.json({
    ok: true,
    data: {
      granted,
      totalToday: nextTotal,
      cap,
      capReached: nextTotal >= cap,
    },
  });
});

export default app;
