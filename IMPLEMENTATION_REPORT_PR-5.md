# IMPLEMENTATION_REPORT_PR-5 — Visitor bunny / friend wave (v1)

**Date:** 2026-05-15
**Branch:** `main`
**Scope:** Stand up a low-stakes "daily visitor" path: a deterministic visitor bunny appears on the farm card once per KST day; tapping waves at it, drops +1 heart, and marks the day as waved. Flips the `heart` item from `미구현` → live. **No real social graph** — there's no friend list, no PII, no follow/unfollow. v1 is decorative companion content, not a social product.

## Why this is "not a real social system yet"

The PR-5 brief explicitly asks for a v1 with no social graph (deterministic visitor per user × day rather than a real friend pull). This was a privacy / scope decision:

- No new PII collected. The visitor is computed from `(user_key, ymd)` via FNV-1a — no inter-user reads, no opt-in/opt-out surface, no contact import.
- No real-time "your friend visited" surface that would require a long-lived friend table.
- Heart accumulates a single unit per day per user — capped by the `friend_visits` PK so abuse is impossible.

This frees PR-5 to focus on the UX (the visitor sprite + heart-pop FX) without dragging in friend-graph schema work.

## What landed

### New worker files
- `cloudflare/workers/carrot-carrot-api/migrations/0007_friends.sql` — `friend_visits(user_key TEXT, ymd TEXT, visitor_bunny_id TEXT, hearts_gained INTEGER, waved_at INTEGER, PRIMARY KEY (user_key, ymd))`. Idempotent (`IF NOT EXISTS`), FK to `users(user_key) ON DELETE CASCADE`. Single index on `(user_key, ymd)`.
- `cloudflare/workers/carrot-carrot-api/src/lib/visitorRng.ts` — pure FNV-1a 32-bit hash + `pickVisitor(userKey, ymd, pool)` helper. No crypto-subtle dependency; not a security primitive but predictability is by design.
- `cloudflare/workers/carrot-carrot-api/src/routes/friends.ts` — `GET /today` (idempotent read: computes today's visitor; returns waved state when 0007 is applied; falls through to `waved:false` when 0007 is missing so the sprite still renders). `POST /wave` (inserts the row with `INSERT OR IGNORE`, PK collision → `already_waved:true`; grants +1 heart via `user_items` ON CONFLICT upsert). VISITOR_POOL is the existing 9 common+rare bunny ids — no new art.

### New client files
- `src/features/collection/friendsStore.ts` — Zustand store with `visitor`, `hydrated`, `hydrate()`, `wave()`. Runtime-only (no `safeStorage`). `wave()` optimistically marks waved + increments the local `heart` item count via `useItemsStore.add` so the bag badge updates without waiting for the round-trip. Offline path also handles the optimistic flow.
- `src/components/Farm/VisitorBunny.tsx` — bottom-left sprite (left=14, bottom=92) + speech bubble ("🐰 오늘 놀러왔어!"). Tap → wave → heart-pop animation → auto-dismiss. 6 s auto-dismiss when untapped. `visible={!skyOpen}` so the sprite hides while the SkyView overlay is open. Reuses `<Bunny>` with `breathe`. If the server picks an id the client doesn't render, falls back to `bunnyKey="idle"` so the sprite still appears.

### New tests
- `src/lib/visitorRng.test.mjs` — 5 cases: idempotent same-day same-user pick, 60-day rotation covers ≥5 distinct bunnies, cross-user divergence, empty-pool → null, FNV-1a distribution over 1000 samples on a 9-slot pool (no empty bucket, no >25 % concentration).

### Modified — worker
- `src/index.ts` — `app.route("/friends", friendsRoute)`.

### Modified — client
- `src/features/collection/FarmHub.tsx` — adds `useFriendsStore.hydrate()` to the mount-time hydration block; mounts `<VisitorBunny visible={!skyOpen} />` next to the ToolDock.
- `src/features/collection/itemsStore.ts` — `heart` item flipped: effect "이웃 토끼가 하루 한 번 두고 가는 인사 표시", acquisition "농장에 방문한 이웃 토끼에게 인사하기 (하루 1회)". `usable: false` stays — there's no spend path yet (a future PR can wire heart consumption).

### Modified — docs
- `FARM_RULES.md` — new "친구 방문 — visitor bunny (v1, PR-5)" section documenting the determinism, pool, reward, KST day reset, privacy posture, and sprite lifetime.

## Maintainer commands (human-only)

**This PR requires a new D1 migration.** Per the autonomous-mode contract the migration SQL is written, but only a human runs `wrangler d1 migrations apply`.

```
# Staging dry-run
wrangler d1 migrations apply carrot-carrot-db --remote --dry-run

# Apply
wrangler d1 migrations apply carrot-carrot-db --remote

# Verify
wrangler d1 execute carrot-carrot-db --remote \
  --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='friend_visits'"
wrangler d1 execute carrot-carrot-db --remote \
  --command="SELECT user_key, ymd, visitor_bunny_id, hearts_gained FROM friend_visits ORDER BY waved_at DESC LIMIT 10"
```

Deploy: `wrangler deploy` — human only.

## Verification

```
node --test src/lib/*.test.mjs          ✔ 78/78 (was 73, +5 visitorRng)
npm run typecheck (root)                ✔ clean
cd cloudflare/.../carrot-carrot-api && npm run typecheck   ✔ clean
npm run build                           ✔
npm run build:preview                   ✔
VITE_APPS_IN_TOSS_PROXY_URL=… npm run build:ait  ✔ (deploymentId 019e2917-5bc4-7371-b619-1af317cb78c3)
```

Forbidden-token scrub against `dist-preview/`:
```
localStorage: 0      sessionStorage: 0    indexedDB: 0
requestFullscreen: 0 exitFullscreen: 0    requestPointerLock: 0  exitPointerLock: 0
"/assets/farm: 0     '/assets/farm: 0
```

## Risk surface

- **Pre-0007 deploy:** `GET /friends/today` falls through with `waved:false` and a deterministic visitor — the sprite renders fine. `POST /friends/wave` returns `409 SCHEMA_NOT_READY`, and `friendsStore.wave()` surfaces a toast asking the user to retry. No corrupt state.
- **Roster drift:** the worker's `VISITOR_POOL` lists 9 bunny ids. If the client's `CHARACTER_BY_ID` is missing one (after a client-only revert), `VisitorBunny` falls back to `bunnyKey="idle"` so it never crashes; the alt text still names the server's chosen id.
- **Visitor sprite overlap with ToolDock:** the sprite sits at `left=14, bottom=92`. ToolDock is centered along the bottom edge with its own bounds. At 390 × 844 there is ~46 px of vertical clearance. If the ToolDock copy or height changes, re-measure.
- **Heart inventory unbounded:** there's no cap on `heart` count. Daily +1 → 365/year max per user. The bag UI currently shows raw count with no overflow handling. Acceptable for v1; consider a "9999+" rollover when count tracking gets a UI redesign.
