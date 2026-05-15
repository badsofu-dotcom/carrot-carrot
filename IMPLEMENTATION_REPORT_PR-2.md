# IMPLEMENTATION_REPORT_PR-2 — executePromotion + ad-token verification

**Date:** 2026-05-15
**Branch:** `main`
**Scope:** Replace `503 CONFIG_REQUIRED` / `501 NOT_IMPLEMENTED` placeholders in `routes/economy.ts` with the real Toss `executePromotion` call path, and stand up `verifyAdToken` for `/tools/refill` and `/items/use`. Implementation only — **no live keys, no deploy**.

## What landed

### New files
- `cloudflare/workers/carrot-carrot-api/src/lib/adToken.ts`
  - `verifyAdToken({ db, userKey, channel, nonce, signedToken?, verifyKey? })` — runs nonce idempotency against `ad_redeem_nonces` (PK on `nonce`) and, when `verifyKey` is set, verifies `signedToken = base64url(HMAC-SHA256(verifyKey, "${userKey}:${channel}:${nonce}"))` with a timing-safe compare.
  - Tagged result type (`AdTokenResult = AdTokenOk | AdTokenFail`) with error codes `MISSING_NONCE` / `INVALID_SIG` / `DUPLICATE_NONCE` / `SCHEMA_NOT_READY`.
  - Signature check runs **before** the INSERT — a bad-sig attempt does NOT consume the nonce slot (prevents replay-DoS).
- `src/lib/adToken.test.mjs` — 9 unit tests covering missing nonce, short nonce, valid insert, duplicate nonce, missing signedToken when verifyKey present, valid HMAC, wrong signature, cross-channel replay (signature is channel-bound), and DB throw → SCHEMA_NOT_READY. Loads the worker TS file via the existing `_test-helpers.mjs` esbuild transform — no new dev dependency.

### Modified — worker

- `src/lib/toss.ts`
  - Adds `executePromotion(env, userKey, amountP, idempotencyKey)`. Posts to `${TOSS_PROMOTION_API_BASE}/api-partner/v1/promotions/execute` over the existing mTLS binding with `Authorization: Bearer ${TOSS_PROMOTION_API_KEY}` and a stable `Idempotency-Key` header.
  - New error union `PromotionError = MtlsHandshakeError | PromotionUpstreamError` with codes `PROMOTION_FAILED` / `PROMOTION_RESPONSE_INVALID` / `PROMOTION_CONFIG_REQUIRED`. `isPromotionError` type guard exported alongside the existing `isTossError`.
  - Reuses the existing `redactSnippet` / `safeShapeFromText` / `unwrapEnvelope` helpers so failure bodies never leak tokens or PII into logs.

- `src/types.ts` — extend `Env` with three optional secrets: `TOSS_PROMOTION_API_BASE`, `TOSS_PROMOTION_API_KEY`, `TOSS_AD_VERIFY_KEY`. All three are optional so the worker still type-checks before any `wrangler secret put` runs.

- `src/routes/economy.ts` — `POST /withdraw` is now end-to-end:
  1. Auth via `requireUser` (Bearer JWT).
  2. Config gate: returns `503 CONFIG_REQUIRED` if either `TOSS_PROMOTION_API_BASE` or `TOSS_PROMOTION_API_KEY` is missing.
  3. Body validation: `amount` must be ≥ `MIN_PAYOUT_P` (50). Below → `400 BELOW_MIN`.
  4. Snapshot `pending_points` row (`pending`, `updated_at`). If row missing → `409 SCHEMA_NOT_READY`. If `pending < amount` → `409 INSUFFICIENT`.
  5. CAS decrement: `UPDATE pending_points SET pending = pending - ? WHERE user_key = ? AND pending >= ? AND updated_at = ?`. Zero rows updated → `409 CONCURRENT_UPDATE`.
  6. Insert `promotion_withdrawals (status='pending')` to obtain the audit row id; idempotencyKey is `cc-w-<id>`.
  7. Call `executePromotion(env, sub, amount, idempotencyKey)`.
     - Failure: refund pending (`pending += amount`), mark row `failed` with a redacted JSON snippet, return `502 UPSTREAM_FAILED`.
     - Success: persist `toss_txid` + `status` on the row, return `{ txid, status, newPending }`.

- `src/routes/economy.ts` — `POST /ad-view` enhanced. Still logs every attempt into `ad_views`. When the body carries `nonce` and `status === "completed"`, also calls `verifyAdToken` so the audit response reflects whether the signed token was valid. Verification is logged in the response `reason` field but does **not** itself grant reward — the per-channel routes (`/tools/refill`, `/boxes/*`, `/items/use`) own the grant.

- `src/routes/tools.ts:217-261` — `POST /refill` accepts optional `{ nonce, signedToken }`. When either `env.TOSS_AD_VERIFY_KEY` is set OR a nonce is provided, runs `verifyAdToken({ channel: "watering", … })` and short-circuits on failure (`409 DUPLICATE_NONCE` / `401 INVALID_SIG` / `400 MISSING_NONCE` / `409 SCHEMA_NOT_READY`). The 3/day cap still applies after verification.

  Also incidentally fixed two pre-existing typecheck errors on tools.ts: the `WATERING_EMPTY` and `AD_REFILL_CAP` error responses used `...shape(st)` which silently overwrote `ok: false` (because `shape` returns `ok: true`). Replaced with explicit field copies.

- `src/routes/items.ts` — `POST /use` accepts optional `{ nonce, signedToken }` and runs the same `verifyAdToken({ channel: "item_use", … })` check when the client opts in or `TOSS_AD_VERIFY_KEY` is configured. Bag-internal consumption (no nonce) is unchanged.

- `wrangler.toml` — added a documentation-only comment block listing the five `wrangler secret put` names; no secret values committed.

### Modified — docs
- `ECONOMY_DESIGN.md` — header flipped from "scaffold only" → "live (gated by secrets)". The `/withdraw` section now describes the 7-step flow + the full error catalogue. Apply checklist enumerates migrations 0003 / 0006 and the three `wrangler secret put` commands.
- `DEPLOY.md` — appended **§10 Smoke test: first promotion** with the 6-step staging→production validation runbook (curl examples redacted of any live URLs).

## Verification

```
node --test src/lib/*.test.mjs          ✔ 58/58 (was 49, +9 adToken)
npm run typecheck (root)                ✔ clean
cd cloudflare/.../carrot-carrot-api && npm run typecheck   ✔ clean (was 2 errors pre-existing on tools.ts spread)
npm run build                           ✔
npm run build:preview                   ✔
VITE_APPS_IN_TOSS_PROXY_URL=… npm run build:ait  ✔ (deploymentId 019e2902-e316-7a40-bff5-dc2bfb2607a1)
```

Forbidden-token scrub against `dist-preview/`:
```
localStorage: 0      sessionStorage: 0    indexedDB: 0
requestFullscreen: 0 exitFullscreen: 0    requestPointerLock: 0  exitPointerLock: 0
"/assets/farm: 0     '/assets/farm: 0
```

## Maintainer commands (human-only)

PR-2 itself adds no new migration — it consumes the existing `ad_redeem_nonces` and `promotion_withdrawals` tables (migration 0006 and 0003 respectively). If those are not yet applied on production:

```
wrangler d1 migrations apply carrot-carrot-db --remote --dry-run
wrangler d1 migrations apply carrot-carrot-db --remote
```

Register secrets (NEVER commit values):
```
wrangler secret put TOSS_PROMOTION_API_BASE   # e.g. https://apps-in-toss-api.toss.im
wrangler secret put TOSS_PROMOTION_API_KEY    # Toss 발급 Bearer
wrangler secret put TOSS_AD_VERIFY_KEY        # HMAC-SHA256 secret 공유 (광고 SDK 콜백)
```

Deploy: `wrangler deploy` — human only, after the smoke test in `DEPLOY.md §10` passes on staging.

## Frontend follow-up (out of scope for PR-2)

The frontend still posts nonce-only to `/economy/ad-view` (no `signedToken` yet — the ad SDK callback path is not wired). Once Toss provides the ad-callback contract, `AdRewardChannelModal.tsx` should:
1. await the ad SDK's signed callback (which contains a `signedToken`),
2. include both `nonce` and `signedToken` in the channel-specific request body (`/tools/refill`, `/boxes/*`, or `/items/use`),
3. only mark the local claim flag after the worker returns `ok: true`.

`AdRewardChannelModal.tsx:112-115` is the existing TODO anchor.

## Risk surface

- **Refund race:** between the failed `executePromotion` and `refundPending` write, the user's pending appears too low. Window ≤ 1 RTT; acceptable given the alternative is to credit twice on retry. Toss-side idempotencyKey makes the executePromotion call itself safe to retry, but we currently don't auto-retry — that's a maintainer decision via the audit log.
- **Signature key compromise:** if `TOSS_AD_VERIFY_KEY` leaks, an attacker could forge signedTokens and consume the per-channel daily caps but cannot drain pending_points (executePromotion uses a different secret).
- **Schema drift on partial migration:** if `ad_redeem_nonces` exists but `promotion_withdrawals` does not, `/withdraw` returns 409 SCHEMA_NOT_READY before any side effect. Safe.
