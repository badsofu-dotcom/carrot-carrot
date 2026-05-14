# NEXT_PR_PLAYBOOK.md

Five ready-to-launch PRs for the next sessions. Each block is sized for a single Claude Code Max session.

The PRs are ordered: **PR-1 unblocks** the rest (fixes typecheck regressions left by the in-flight Bag PR). PR-2 and PR-3 are independent. PR-4 and PR-5 are polish.

> Common ground rules (always): no `wrangler` invocation, no remote D1 apply, no production deploys, no API keys committed. Run `node --test src/lib/*.test.mjs && npm run typecheck && npm run build && npm run build:preview && npm run build:ait` before commit. Don't create a source zip unless asked.

---

## PR-1 — Bag Hookup + Inventory Modal + assets live (unblock the working tree)

### Goal
The previous subagent left the Bag Hookup PR half-merged: components and store landed, but typecheck is broken and the worker routes for `/items` and `/boxes` aren't mounted. Land that PR cleanly so the working tree compiles + the inventory modal is fully wired (asset-image counts, use-buttons, badge).

### Scope files
- `src/components/Inventory/BunnyGachaModal.tsx` — typecheck regression (reads `bunny.imageSrc` / `bunny.bio` which don't exist on `CharacterDef`).
- `src/components/Inventory/AdRewardChannelModal.tsx` — drop unused `useState` import.
- `src/features/collection/collectionData.ts` — either add the two missing fields to `CharacterDef` or rename in the modal.
- `cloudflare/workers/carrot-carrot-api/src/index.ts` — mount `/items` (`routes/items.ts`) and `/boxes` (`routes/boxes.ts`).
- `src/lib/itemsSync.ts` *(new)* — adapter mirroring `farmSync.ts`. Posts `useItem(code)` → `/items/use` when token + base URL are present; otherwise no-op (preview).
- `src/features/collection/itemsStore.ts` — wire `add`/`consume` to call `itemsSync` post-mutation; reconcile via the returned row.
- `IMPLEMENTATION_REPORT.md` — record current EVs from `rewardTables.test.mjs` (1.9 P daily, 7.0 P weekly).

### Deliverable checklist
- [ ] `npm run typecheck` clean (3 → 0 errors).
- [ ] `node --test src/lib/*.test.mjs` still 49/49.
- [ ] `npm run build`, `build:preview`, `build:ait` succeed.
- [ ] `dist-preview/` forbidden-token scan returns 0 for all 7 tokens.
- [ ] Playwright smoke (390×844): tap bag → modal opens; tab switch works; `사용` button on `hourglass` actually grows a plot.
- [ ] PR report lists the 5 maintainer commands for `wrangler d1 migrations apply` (0004 / 0005 / 0006).

### Dependencies
None — purely local. Migration 0006 is already in tree.

### Estimated difficulty / time
**~1.5–2 h.** Most of the work is the worker mount + a small sync adapter; the typecheck fix is mechanical.

---

## PR-2 — `executePromotion` + ad verification (production payout path)

### Goal
Replace the `503 CONFIG_REQUIRED` / `501 NOT_IMPLEMENTED` placeholders in `routes/economy.ts` and `routes/tools.ts` with the real Toss `executePromotion` call + Apps-in-Toss ad-token verification. **Implementation only — no live keys, no deploy.**

### Scope files
- `cloudflare/workers/carrot-carrot-api/src/lib/toss.ts` — add `executePromotion(env, sub, amountP)` (mTLS + signed request). All credentials come from `wrangler secret` (never committed).
- `cloudflare/workers/carrot-carrot-api/src/lib/adToken.ts` *(new)* — verify the Apps-in-Toss ad-watched JWT/token + nonce idempotency by joining `ad_redeem_nonces` (table from 0006).
- `cloudflare/workers/carrot-carrot-api/src/routes/economy.ts` — wire `/economy/withdraw` to `executePromotion` + write a row into `promotion_withdrawals`. Concurrency: guard via `pending_points.updated_at` compare-and-swap.
- `cloudflare/workers/carrot-carrot-api/src/routes/tools.ts:220` — replace the TODO with `verifyAdToken(body.nonce, …)`.
- `cloudflare/workers/carrot-carrot-api/src/routes/items.ts` (if landed) — same ad-token check on `/items/use` when used for ad-rewarded items.
- `ECONOMY_DESIGN.md` — flip "scaffold only" header to "live" plus the apply checklist.

### Deliverable checklist
- [ ] `wrangler.toml` documents the 3 required secrets (`TOSS_PROMOTION_API_BASE`, `TOSS_PROMOTION_API_KEY`, `TOSS_AD_VERIFY_KEY`) without committing values.
- [ ] Local `wrangler dev` (DON'T deploy) can mock-call `executePromotion` against a stub server.
- [ ] Unit tests for `verifyAdToken` (nonce reuse → 409, valid → ok).
- [ ] Daily cap aggregation against `daily_caps` re-checked.
- [ ] Maintainer runbook block in `DEPLOY.md` for "first promotion smoke test".

### Dependencies
- PR-1 must land so `/items/use` exists.
- Maintainer must supply Toss merchant credentials offline.

### Estimated difficulty / time
**~3–4 h.** Money-touching code — requires extra-careful review, signed/idempotent flow design, and tests.

---

## PR-3 — Seasonal bunny art + collection rules

### Goal
Replace the placeholder seasonal IDs in `SEASONAL_POOLS` with real bunny PNGs and register them in the dogam grid + worker `bunny_collection` table.

### Scope files
- `src/lib/seasonalBunny.ts → SEASONAL_POOLS` — swap placeholder IDs (`seasonal_cherry_blossom`, etc.) for the actual character ids.
- `src/features/collection/collectionData.ts` — add the seasonal `CharacterDef` entries (id, rarity, name, imageSrc, bio). New rarity tier optional — most likely `rare` or `sr`.
- `src/features/collection/UnlockOverlay.tsx` — render the bunny modal style for seasonal unlocks (reuse `BunnyGachaModal`'s structure once it compiles).
- `public/assets/farm/bunnies/` *(new)* — drop the seasonal cutout PNGs (if user supplies).
- `cloudflare/workers/carrot-carrot-api/src/routes/bunnies.ts` *(new)* — `POST /bunnies/draw` (server-authoritative gacha — replaces client-side `drawBunny` over the wire) + `GET /bunnies/collection`.
- `SEASONAL_DESIGN.md` — table of season → pool IDs + drop rates.

### Deliverable checklist
- [ ] `seasonalBunny.test.mjs` updated (or new) to assert no placeholder IDs remain.
- [ ] `BunnyGachaModal` renders new bunnies with their PNG.
- [ ] Dogam grid (`CollectionPage.tsx` dogam branch) shows silhouette for un-owned seasonals.
- [ ] Worker `/bunnies/draw` route mounted in `index.ts`.
- [ ] Migration 0006 (`bunny_collection`) usage documented; insert/select sample queries in PR report.

### Dependencies
- User uploads at least 1 seasonal bunny PNG (per spring/summer/autumn/winter, or general placeholder).
- PR-1 typecheck baseline.

### Estimated difficulty / time
**~2–3 h** once art is in hand. Mostly data plumbing + dogam render.

---

## PR-4 — Sound, BGM, haptics

### Goal
Add (1) ambient farm BGM tied to the bg slot, (2) tool action SFX (`dig.mp3` / `water.mp3` / `harvest.mp3`), (3) sky-view low-volume reverb track, all guarded so unsupported environments (e.g. preview iframe without user interaction) silently no-op.

### Scope files
- `public/sounds/` — add `dig.mp3`, `water.mp3`, `harvest.mp3`, `bgm_day.mp3`, `bgm_night.mp3`, `bgm_rainy.mp3` (or whatever the user provides). Use `optimize-assets.mjs` if available.
- `src/lib/soundFx.ts` *(new)* — small wrapper around `HTMLAudioElement`. Honors a global mute flag. Idempotent preload. Volume scaled by `useSoundStore.volumeMaster`.
- `src/features/collection/FarmHub.tsx` — call `soundFx.play("dig")` on plant, `play("water")` on water, `play("harvest")` on harvest. Existing haptic calls stay.
- `src/components/Farm/SkyView.tsx` — start a slot-specific ambient track on open, fade out on close.
- `src/store/soundStore.ts` — add `sfxMuted: boolean` toggle + a Settings row.
- `src/pages/SettingsPage.tsx` — add a "효과음 음소거" toggle.

### Deliverable checklist
- [ ] No autoplay before first user gesture (Apps-in-Toss policy).
- [ ] Audio failures (file 404, blocked autoplay) silently fall through.
- [ ] Bundle size delta documented; sounds ≤ 50 KB each, MP3 at 96 kbps mono.
- [ ] Smoke test: `npm run build:preview` then play each tool tap in DevTools console.
- [ ] Settings toggle persists across reload.

### Dependencies
- Sound assets from the user.
- Haptic API path already exists (`src/design-system/haptic.ts`) — no change.

### Estimated difficulty / time
**~2 h.** Audio plumbing is small; most time goes into asset optimization + the muted-fallback path.

---

## PR-5 — Friends / neighbor bunny visits

### Goal
Wire up the `heart` item (currently `미구현`) into a low-stakes social system: a friend's bunny "visits" the player's farm card with a brief animation + a 하트 drop. No real social graph in v1 — just a daily randomized "오늘의 방문 토끼" deterministic by user_key + KST day.

### Scope files
- `cloudflare/workers/carrot-carrot-api/migrations/0007_friends.sql` *(new)* — `friend_visits` (user_key + ymd PK, visitor_bunny_id, hearts_gained).
- `cloudflare/workers/carrot-carrot-api/src/routes/friends.ts` *(new)* — `GET /friends/today` (idempotent, computes today's visitor deterministically), `POST /friends/wave` (consume one heart, +carrot reward).
- `src/features/collection/friendsStore.ts` *(new)* — caches today's visitor + claimed flag.
- `src/components/Farm/VisitorBunny.tsx` *(new)* — small bottom-corner sprite + speech bubble; uses the existing transparent bunny set under `src/assets/characters/`.
- `src/features/collection/itemsStore.ts` — flip the `heart` item from `미구현` to functional. Acquisition path: friend-wave reward.
- `FARM_RULES.md` — add a "친구 방문" section.

### Deliverable checklist
- [ ] Visitor selection deterministic per (user_key, ymd) — verifiable with a node test injecting RNG.
- [ ] At most one wave per day (worker-side enforced via `friend_visits` PK).
- [ ] Visitor sprite never overlaps the tool dock — measured via Playwright.
- [ ] No idle bunny on the farm outside the visitor 6-second pop.
- [ ] PR report explains why this is **not** a real social system yet (no PII, no friend graph).

### Dependencies
- PR-1 must land (clean typecheck).
- No new art needed — reuses `src/assets/characters/bunny_*.webp`.

### Estimated difficulty / time
**~3 h.** Worker route + new modal/sprite + small store. The hardest part is the deterministic visitor RNG; recommend `hash(user_key + ymd) % pool.length`.

---

## Cross-PR scrub before any commit

Run this checklist as part of every PR landing in this repo:

```
node --test src/lib/*.test.mjs            # all helpers pass
npm run typecheck                         # no new errors vs prior PR
npm run build                             # production build OK
npm run build:preview                     # preview build OK
npm run build:ait                         # AIT artifact written

# Forbidden-token scan (must be 0 for every entry):
for t in localStorage sessionStorage indexedDB requestFullscreen \
         exitFullscreen requestPointerLock exitPointerLock; do
  grep -rl "$t" dist-preview/ | wc -l
done

# Absolute-path scan (must be 0):
grep -rln -F '"/assets/farm' dist-preview/
grep -rln -F "'/assets/farm" dist-preview/

# 9-polygon geometry check:
awk '/PLOT_POLYGONS:/,/^\];$/' src/features/collection/FarmHub.tsx \
  | grep -c "^  { id:"   # → 9
```

Only the maintainer runs `wrangler d1 migrations apply <DB_NAME>` and the corresponding `--remote` variant.
