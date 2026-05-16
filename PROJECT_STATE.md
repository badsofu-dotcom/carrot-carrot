# PROJECT_STATE.md

Snapshot as of **2026-05-14 KST**, working tree on top of commit `2835795` (`fix(fx): custom particle harvest pop, drop stretched PNG`).

> The working tree has **uncommitted feature edits from a prior in-flight subagent run** (Bag Hookup + Items Live PR). This document inventories that state truthfully — it is NOT a fully-green PR. Any line marked "확인 필요" is exactly that.

---

## A. Build / test snapshot (실측)

Local commands re-run by the handoff session (2026-05-14):

| Command | Result | Notes |
| --- | --- | --- |
| `node --test src/lib/*.test.mjs` | **49 pass / 0 fail** | farmRules 15 + seasonalBunny 13 + points 7 + skyMessages 6 + rewardTables 8 |
| `npm run typecheck` | **3 errors** (working-tree regressions) | (1) `AdRewardChannelModal.tsx:19` unused `useState`. (2) `BunnyGachaModal.tsx:132` reads `bunny.imageSrc` — `CharacterDef` has no `imageSrc`. (3) `BunnyGachaModal.tsx:161` reads `bunny.bio` — `CharacterDef` has no `bio`. |
| `npm run build` | **not re-run this turn** (typecheck blocks) | 최근 확인 — `2835795` 시점 ✓ 434 ms |
| `npm run build:preview` | **not re-run this turn** | 최근 확인 ✓ 444 ms |
| `npm run build:ait` | **not re-run this turn** | 최근 확인 ✓ — `carrot-carrot.ait` at repo root (27.98 MB, dated 2026-05-14 05:07) |
| `npm run lint` | not re-run this turn | 최근 확인 — 39 errors (all pre-existing react-hooks rule warnings) |

**Action item for next code PR**: fix the three typecheck errors by either (a) adding `imageSrc`/`bio` fields to `CharacterDef` in `src/features/collection/collectionData.ts` or (b) rewriting `BunnyGachaModal.tsx` to read the existing fields. Then drop the unused `useState` import.

## B. Last committed PR (HEAD)

- Commit: `2835795 fix(fx): custom particle harvest pop, drop stretched PNG`
- Files changed: 1 (`src/components/Farm/Effects/index.tsx`)
- Effect: replaced the elongated `fx_harvest_pop.png` PNG burst with a CSS/framer-motion particle pop (1 ring + 3 carrot wedges + 4 leaf flecks + 4 sparkle dots, ~500 ms).
- Build artifacts produced at this commit: `carrot-carrot.ait` (27.98 MB, deploymentId `019e24e1-b668-7c24-b43e-e952e00084db`, NOT deployed) + `dist-preview/`.

## C. Working-tree changes since HEAD (uncommitted, from in-flight subagent)

`git status --short` snapshot:

```
 M src/components/Farm/SkyView.tsx
 M src/components/Farm/ToolDock.tsx
 M src/features/collection/FarmHub.tsx
 M src/features/collection/rewardsStore.ts
 M src/features/collection/toolStore.ts
 M src/lib/skyMessages.test.mjs
 M src/lib/skyMessages.ts
 M src/pages/CollectionPage.tsx
?? cloudflare/workers/carrot-carrot-api/migrations/0006_items.sql
?? cloudflare/workers/carrot-carrot-api/src/routes/boxes.ts
?? cloudflare/workers/carrot-carrot-api/src/routes/items.ts
?? public/assets/farm/foods/
?? public/assets/farm/icons/icon_energy.png
?? public/assets/farm/items/
?? src/components/Inventory/                     (3 modals)
?? src/features/collection/itemsStore.ts
?? src/lib/bunnyGacha.ts
?? src/lib/rewardTables.ts
?? src/lib/rewardTables.test.mjs
?? listing-assets/                                (stray screenshots; gitignore candidate)
```

What works in the working tree (verified by code reading):

- ToolDock has 3 tool slots (shovel / watering_can / basket) + 1 passive bag slot (PR-6) that dispatches `cc:bag:open`. `seed_pack` removed from `ToolDef[]` and from `ToolId` union (`toolStore.ts`).
- CollectionPage farm-header is clean: 📖 도감 / 🎁 RewardsPanel / ⚙ settings. The bag (InventoryModal) opens from ToolDock's 4th slot, not the header (PR-6).
- `InventoryModal.tsx` renders 13 item slots in 3 tabs (자원 / 도구 / 컬렉션), 4-column grid.
- `itemsStore.ts` defines the 13-`ItemCode` union + add/consume/speciesOwned actions + safeStorage persist.
- `rewardTables.ts` ships `DAILY_GIFT_TABLE` + `WEEKLY_TREASURE_TABLE` with pure-helper RNG + tests (8/8 pass, EVs match table).
- `bunnyGacha.ts` ships the 4-tier (common/rare/epic/legendary) draw with `excludeLegendary` + `forceLegendary` opts.
- `BunnyGachaModal.tsx` exists — **but reads non-existent `bunny.imageSrc` / `bunny.bio` fields**. Typecheck blocks the build.
- `AdRewardChannelModal.tsx` opens via `cc:ad-channel:open` CustomEvent (dispatched from ToolDock's refill button).
- `SkyView.tsx` updated with tap-to-cycle messages (12/slot), long-press sparkle burst, daily-first shooting-star/rainbow roll, `quiet_sky` medal accumulation.
- `skyMessages.ts` now has 12 messages per slot for 9 slots (108 total).
- Worker route FILES `routes/items.ts` and `routes/boxes.ts` exist but are **NOT mounted** in `src/index.ts` (no `app.route("/items", …)` / `/boxes` line).
- Migration `0006_items.sql` exists; **not applied**.

## D. Asset inventory (확인)

`public/assets/farm/` tree on disk:

| Family | Files |
| --- | --- |
| Farm bg | `bg_day.webp` + `bg/{sky_dawn,bg_morning,bg_evening,bg_night,bg_rainy,bg_snowy,bg_autumn,bg_cherry}.jpeg` |
| Crops | `crops/crop_stage{0,1,2,3,4}_*.webp` |
| Tools | `tools/tool_{shovel,watering_can,basket,seed_pack}.png` (seed_pack file remains but is unused after dock cleanup) |
| FX | `fx/{fx_sparkle,fx_water_splash,fx_harvest_pop,fx_confetti,fx_heart,fx_level_up_ring,emotion_happy,emotion_love}.png` (harvest_pop file remains but `Effects/index.tsx` no longer references it) |
| Currency | `currency/{carrot,candy_carrot,golden_carrot}.png` |
| Icons | `icons/{icon_coin,icon_gem,icon_heart_hp,icon_timer,icon_xp_star,icon_energy}.png` |
| Rewards | `rewards/{medal_bronze,medal_silver,medal_gold,gift_box,treasure_chest}.png` |
| Sky overlay | `sky/{sky_dawn,sky_noon,sky_sunset,sky_shooting_star,sky_rainbow,sky_rainy,sky_night}.{jpeg,png}` |
| Items | `items/item_bag.png` (+ `.jpg` source) |
| Foods | `foods/food_carrot_{juice,soup,cake}.png` |
| Bunny | `bunny_planting.webp` (transparent — onboarding only) |

**Missing assets** (graceful fallback in code):

- `tool_basket` was missing in PR 8 — now activated. None of the in-dock tools are missing.
- No dedicated `fx_dirt_burst` — CSS particle fallback in `Effects/index.tsx → DirtBurst`.
- No lightning FX — CSS-only zigzag has not been added; **미구현**.
- Seasonal bunny dedicated art — placeholder IDs in `seasonalBunny.ts → SEASONAL_POOLS`; **미구현**.
- Tool action sounds (`dig.mp3` / `water.mp3` / `harvest.mp3`) — silent; **미구현**.

## E. Feature implementation matrix

Legend: ✅ implemented & shipping · 🟡 partially implemented · ❌ 미구현.

| Area | Status | Notes |
| --- | --- | --- |
| 9-polygon farm geometry (id3/id5 corrected) | ✅ | `FarmHub.tsx:27 PLOT_POLYGONS` |
| Compact farm header (carrot / candy / golden chips + dogam + gift + settings) | ✅ | `CollectionPage.tsx FarmView` |
| Bag button + InventoryModal | 🟡 | UI exists; uses `itemsStore` local state only. Worker `/items` route file exists but is **not mounted**. |
| 13-item inventory (resources × 5 / tools × 5 / collection × 3) | 🟡 | All 13 defined in `itemsStore.ts`; `juice / soup / cake` use-effects are toast-only `(미구현)`. `gem` / `heart` are placeholder slots. |
| 5-minute focus gate + duration tier | ✅ | `farmRules.ts` + `HomePage.tsx:174` |
| Harvest tool flow (shovel plant / watering_can / basket harvest) | ✅ | `FarmHub.tsx onPlotClick` |
| ToolDock 3 slots @ 64 px | ✅ | `ToolDock.tsx` |
| Watering-can 10/day + 3 ad-refills | ✅ | `toolStore.ts` + `tools.ts` worker route (ad-token verification TODO) |
| Daily gift box (random reward) | ✅ | `rewardsStore.ts → claimDailyGift` + `RewardsPanel`. Server route `boxes/gift/open` written but unmounted. |
| Weekly treasure progress | 🟡 | `WEEKLY_TREASURE_TABLE` defined; client UI not yet built; worker route `boxes/treasure/{state,open}` written but unmounted. |
| Bunny gacha (0.5 % harvest, legendary excluded) | 🟡 | Logic + draw module present in `bunnyGacha.ts`; modal exists but **typecheck-blocked** by `imageSrc`/`bio` field mismatch. |
| Bunny collection persistence | 🟡 | Client `collectionStore.forceUnlock(id)` works. Worker `bunny_collection` table in 0006 + no route yet. |
| Dogam threshold medals 25/50/75/100 | ✅ | `CollectionPage.tsx FarmView` effect. |
| SkyView (tap-cycle / long-press / shooting-star / rainbow / quiet_sky medal) | ✅ | `SkyView.tsx` + `skyMessages.ts` (12/slot). |
| Sky time accumulation | ✅ (local) | `cc.sky.time.sec.v1` in safeStorage. Worker `sky_visits` table in 0006 + no route yet. |
| Toss points UI + withdraw button | ✅ | `RewardsPanel.tsx` calls `/economy/withdraw` (route exists in `0003_economy`). MIN_PAYOUT = 50 P. |
| Toss points worker `executePromotion` | ❌ | Returns `CONFIG_REQUIRED` / `NOT_IMPLEMENTED` placeholders. **Production secret + integration pending.** |
| Ad reward channel modal (one-of-three) | ✅ (preview) | `AdRewardChannelModal.tsx` + per-channel KST daily cap in safeStorage. **Ad-token verification not implemented.** |
| Onboarding overlay v2 (sprout + cozy speech) | ✅ | `BunnyOnboardingModal.tsx`. URL overrides `?onboarding=1` / `?resetOnboarding=1`. |
| Bottom nav sprout icon | ✅ | `TabBar.tsx` |
| Farm toast text-only | ✅ | `base.css → body[data-farm-view="1"] [data-cc-toast-pill]` |
| Background rotation (KST + season + weather) | ✅ | `farmBackground.ts`. Settings toggle (배경 자동 변경). |
| Atmosphere particles (rain/snow/cherry/autumn + cloud parallax) | ✅ | `Atmosphere.tsx` |
| Harvest FX — CSS particle pop (PR `2835795`) | ✅ | `Effects/index.tsx → HarvestPop` |
| Forbidden-token scrub of `dist-preview/` | ✅ | 0 hits at last build. Re-verify after every preview rebuild. |
| Production deploy | ❌ | Never run from Claude. Maintainer-only. |

## F. Known limitations / blockers (truthful)

1. **Typecheck regressions (3)** — see § A. Must fix before next AIT build.
2. **Worker routes `/items` and `/boxes` not mounted** — `cloudflare/.../src/index.ts` still imports only health/login/me/refresh/unlink/farm/economy/tools. Adding `app.route("/items", itemsRoute)` + `app.route("/boxes", boxesRoute)` is a 4-line follow-up.
3. **D1 migrations 0004–0006 are NOT applied** anywhere. Maintainer must run `wrangler d1 migrations apply <DB_NAME>` locally then `--remote`.
4. **Toss `executePromotion` real call not wired.** The worker `/economy/withdraw` route is a 503/501 scaffold. Real merchant credentials + risk review needed before turning it on.
5. **Apps-in-Toss ad-token verification not wired** for `/tools/refill`, `/economy/ad-view`, and `AdRewardChannelModal`. Real ad SDK + signed callback verification required.
6. **Seasonal bunny art missing** — `SEASONAL_POOLS` IDs are placeholders.
7. **Bunny collection is client-side only.** Once worker `/bunnies/draw` + `/bunnies/collection` land (and migration 0006 applies) the client should reconcile.
8. **Sound effects (`dig.mp3`/`water.mp3`/`harvest.mp3`)** absent → tool actions are silent. Haptics are wired but guarded so unsupported environments fall back cleanly.
9. **`heart` / `gem` items** are slots only. No acquisition path, no use-effect (마크: `미구현`).
10. **No friends / neighbor visit system** yet — placeholder copy in `itemsStore.ts` for `heart`.
11. **Sky `quiet_sky` medal threshold (5 min cumulative)** verified via client `safeStorage` only; once worker `sky_visits` table is wired this should reconcile server-side.
12. **`listing-assets/` directory** is untracked and contains promotional screenshots. Add to `.gitignore` or move out of repo root before next commit.

Anything else not listed here should be assumed **미구현 until verified against source.**
