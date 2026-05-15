# 버니타임 v2 — Economy Design

This document captures the BunnyTime v2 reward economy: how a focus
session converts into Toss points, what caps and audit trails protect
us against abuse, and what is currently **live** vs **scaffolded**.

> Status: **live (gated by secrets)**.
> The `executePromotion` call path is wired in `routes/economy.ts` →
> `/economy/withdraw` (PR-2). It activates only when both
> `TOSS_PROMOTION_API_BASE` and `TOSS_PROMOTION_API_KEY` are registered
> via `wrangler secret put`. Until those secrets exist the route
> short-circuits with 503 CONFIG_REQUIRED — same surface as before, so
> the frontend keeps showing the "준비 중" placeholder.
>
> Migrations `0003_economy.sql` (pending_points + audit ledger) and
> `0006_items.sql` (ad_redeem_nonces) must both be applied before the
> path can succeed end-to-end. See the apply checklist at the bottom
> of this doc — only a human runs `wrangler d1 migrations apply`.

## Conversion table

| Source | Drop | Points | Tracked in client store as |
| --- | --- | --- | --- |
| 일반 당근 (carrot harvest) | every harvest | 1 P | `useFarmStore.carrots` |
| 캔디 당근 (candy carrot) | 4 % base / 12 % during perfect-combo / +1 %p with combo-streak ≥5 | 5 P | `useFarmStore.candyCarrots` |
| 황금 당근 (golden carrot) | 1 % roll on harvest | 10 P | `useFarmStore.goldenCarrots` |
| 광고 시청 보상 (rewarded ad) | per ad, ≤ 10/day | 2 P | (server-side audit) |
| 데일리 출석 보너스 | once / KST day | 3 P | (server-side audit) |

Roll table lives in `src/lib/seasonalBunny.ts` — see the `HARVEST_*` constants. Header currency chips read directly from `useFarmStore` so the player sees their candy/golden inventory grow live. The roll percentages are clamped server-side by the daily cap so a single lucky run does not blow past the anti-abuse limit. Note: this PR resolves the historical mismatch between the original economy doc (7 % / 0.6 %) and the implemented roll table (4 % / 1 %) — the implemented values win because they match the unit tests in `seasonalBunny.test.mjs`.

## Currency icons (header)

| Currency | Asset | Fallback emoji |
| --- | --- | --- |
| Carrot | `public/assets/farm/currency/carrot.png` (sourced from `crop_stage4_ripe.png`) | 🥕 |
| Candy carrot | `public/assets/farm/currency/candy_carrot.png` (from `food_carrot_candy.png`) | 🍬 |
| Golden carrot | `public/assets/farm/currency/golden_carrot.png` (from `food_golden_carrot.png`) | ✨ |

Header chips render the PNG icon at 18×18 with `object-fit: contain`. If the asset fails to load on the deploy host (nested-proxy path issues), the chip falls back to the emoji glyph through an `onError` handler.

## Anti-abuse caps (KST per day, per user)

| Counter | Cap |
| --- | --- |
| `carrot_count` (당근 수확 횟수) | 24 |
| `reward_points_total` (포인트 합계) | 50 |
| `ad_views_today` (광고 시청 횟수) | 10 |

All caps live in the `daily_caps` table keyed by `(user_key, ymd)`.
`ymd` is the KST date string (`YYYY-MM-DD`) — every grant looks up
today's row, increments, and rejects if the new total would exceed
the cap.

## Data model

See `migrations/0003_economy.sql` for the full schema. Five tables:

1. **`pending_points`** — running pending balance per user, plus a
   monotonic lifetime total for analytics.
2. **`point_grants`** — append-only ledger of every grant. One row =
   one (source, kind, amount) tuple. Daily-cap aggregation runs off
   the `(user_key, ymd)` index here too, but `daily_caps` is the hot
   read path.
3. **`daily_caps`** — denormalized per-day counters.
4. **`ad_views`** — every rewarded-ad attempt is logged, including
   dismissed / errored ones. Reward grants are linked via
   `reward_id → point_grants(id)`.
5. **`promotion_withdrawals`** — every executePromotion request and
   response. Reconciliation trail.

## Server endpoints (scaffold)

All endpoints require Bearer JWT auth (`requireUser`). See
`cloudflare/workers/carrot-carrot-api/src/routes/economy.ts`.

- **`GET /economy/balance`** — `{ pending, lifetimeTotal, withdrawEnabled }`.
  Falls back to `0` if migration not applied, so the frontend never
  errors out.
- **`POST /economy/withdraw`** — invokes Toss `executePromotion`. Body:
  `{ amount: number }` (P). Flow:
  1. Snapshot `pending_points` row (`pending`, `updated_at`).
  2. CAS decrement: `UPDATE … WHERE pending >= amount AND updated_at = <snapshot>`. 0 rows → 409 `CONCURRENT_UPDATE`; retry.
  3. Insert `promotion_withdrawals (status='pending')` to obtain a stable id; use `cc-w-<id>` as `Idempotency-Key`.
  4. Call `executePromotion(env, sub, amount, idemKey)` — mTLS POST to `${TOSS_PROMOTION_API_BASE}/api-partner/v1/promotions/execute`.
  5. On success update the row with `toss_txid` + `status`; on failure refund pending + mark row `failed` with a redacted snippet.
  - Returns `503 CONFIG_REQUIRED` if `TOSS_PROMOTION_API_BASE` or
    `TOSS_PROMOTION_API_KEY` is missing. Returns `400 BELOW_MIN`,
    `409 INSUFFICIENT`, `409 CONCURRENT_UPDATE`, `409 SCHEMA_NOT_READY`,
    or `502 UPSTREAM_FAILED` otherwise.

- **`POST /tools/refill`** and **`POST /items/use`** — accept optional
  `{ nonce, signedToken }`. When `TOSS_AD_VERIFY_KEY` is configured the
  pair is required; the route runs `verifyAdToken` first
  (`cloudflare/.../lib/adToken.ts`). Duplicate / invalid / missing →
  `409 DUPLICATE_NONCE` / `401 INVALID_SIG` / `400 MISSING_NONCE`. When
  the verify key is NOT set, a nonce alone serves as best-effort
  idempotency — suitable for preview only.
- **`POST /economy/ad-view`** — `{ placement, status, network }`. ALL
  attempts are logged. A reward is granted only when status =
  `completed` AND a signed callback from the ad network has been
  verified — never inline based on client claims.

## Frontend behavior (current)

The frontend renders the economy UI defensively:

- If `withdrawEnabled === false`, the withdraw button is shown
  disabled with copy "준비 중 — 토스 연동을 기다리고 있어요".
- Pending balance is read from `/economy/balance` and rendered next
  to the carrot counter on the farm tab and on the report tab. When
  the worker returns the migration-fallback zeros the UI shows
  "0 P" silently.
- Rewarded ads: dismissed / error never trigger a reward locally.
  The frontend always posts the outcome to `/economy/ad-view`
  regardless of status.

## Out of scope for this PR

- Live activation of `executePromotion` — requires the maintainer to
  `wrangler secret put TOSS_PROMOTION_API_BASE`, `… API_KEY`, and (for
  ad-token verification) `TOSS_AD_VERIFY_KEY`. Without those the call
  path stays dormant.
- Ad SDK selection (TossAds vs AdMob). Right now we ship a stub
  network=`mock` that always reports `dismissed`.
- Fraud detection beyond per-day caps. Future: device fingerprinting,
  IP reputation, click-through anomaly detection.

## Migration apply checklist (human-only)

1. Confirm staging DB bound: `wrangler d1 list`.
2. Dry-run: `wrangler d1 migrations apply carrot-carrot-db --remote --dry-run`.
3. Apply migrations in order: 0003, 0004, 0005, 0006 (all idempotent):
   `wrangler d1 migrations apply carrot-carrot-db --remote`.
4. Verify tables exist:
   `wrangler d1 execute carrot-carrot-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"`.
5. Register Toss secrets (NEVER commit values):
   ```
   wrangler secret put TOSS_PROMOTION_API_BASE   # e.g. https://apps-in-toss-api.toss.im
   wrangler secret put TOSS_PROMOTION_API_KEY    # Bearer token from Toss merchant console
   wrangler secret put TOSS_AD_VERIFY_KEY        # HMAC-SHA256 secret shared with ad SDK callback
   ```
6. First-promotion smoke test (see `DEPLOY.md → Smoke test: first
   promotion`).

**Do not** run `wrangler deploy` from CI or from an autonomous agent.
The reward economy touches money — every deploy is a human action.
