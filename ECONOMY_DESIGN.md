# 버니타임 v2 — Economy Design

This document captures the BunnyTime v2 reward economy: how a focus
session converts into Toss points, what caps and audit trails protect
us against abuse, and what is currently **live** vs **scaffolded**.

> Status: **scaffold only**. No real payouts run. Migration
> `cloudflare/workers/carrot-carrot-api/migrations/0003_economy.sql`
> is committed but **not** applied. `wrangler d1 migrations apply`
> must be run by a human with the staging DB bound.

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
- **`POST /economy/withdraw`** — invokes Toss `executePromotion` once
  configured.
  - Returns `503 CONFIG_REQUIRED` if `TOSS_PROMOTION_API_BASE` or
    `TOSS_PROMOTION_API_KEY` is missing.
  - Returns `501 NOT_IMPLEMENTED` once configured, until the real call
    is wired in.
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

- Real `executePromotion` integration (needs Toss merchant
  credentials).
- Ad SDK selection (TossAds vs AdMob). Right now we ship a stub
  network=`mock` that always reports `dismissed`.
- Fraud detection beyond per-day caps. Future: device fingerprinting,
  IP reputation, click-through anomaly detection.

## Migration apply checklist (human-only)

1. Confirm staging DB bound: `wrangler d1 list`.
2. Dry-run: `wrangler d1 migrations apply DB --remote --dry-run`.
3. Apply: `wrangler d1 migrations apply DB --remote`.
4. Verify tables exist: `wrangler d1 execute DB --remote --command="SELECT name FROM sqlite_master WHERE type='table'"`.
5. Bump `wrangler.toml` env vars `TOSS_PROMOTION_API_BASE` /
   `TOSS_PROMOTION_API_KEY` once Toss issues credentials.

**Do not** run `wrangler deploy` from CI or from an autonomous agent.
The reward economy touches money — every deploy is a human action.
