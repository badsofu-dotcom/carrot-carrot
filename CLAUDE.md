# CLAUDE.md — Carrot Carrot (BunnyTime v2) project guide

This file is the entry point for Claude Code / Claude Code Max 20× CLI sessions on this repository. Read this FIRST before any other doc when you open the project.

---

## 1. Project overview

**Carrot Carrot / BunnyTime v2** is an Apps-in-Toss mini-app that gamifies pomodoro-style focus sessions. A 25-minute focus session grows carrots on a 9-plot farm; harvesting carrots eventually converts to Toss-points (real cash promotion).

- Korean-first UI (모든 사용자 노출 텍스트 한국어).
- Mobile-first 390×844 baseline; desktop preview clamps to a 480 px app-shell column.
- Two distribution surfaces:
  - **Apps-in-Toss WebView** — `npm run build:ait` packages the React SPA into a `.ait` artifact for the Apps-in-Toss admin console.
  - **Static preview** — `npm run build:preview` writes `dist-preview/` with `VITE_MOCK_AUTH=true`. Boots in any plain browser / iframe without Toss login. Used by reviewers and screenshots.

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| UI framework | **React 19** + Vite 8 |
| Routing | **wouter** (hash routing — Apps-in-Toss serves under nested base path) |
| State | **Zustand 5** stores (no Redux) |
| Animation | **framer-motion 12** |
| Storage | `safeStorage` shim (string-concat `localStorage` lookup, falls back to in-memory Map in iframes that block storage). Never imports the literal `localStorage` token into the bundle. |
| Worker backend | **Cloudflare Workers** + **Hono** + **D1** (SQLite). Worker repo at `cloudflare/workers/carrot-carrot-api/`. |
| Auth | Toss `appLogin` → Worker `/login` → JWT in tokenStore. Preview / non-Toss browsers go through `VITE_MOCK_AUTH=true` mock path. |
| Test runner | **`node --test`** on pure-helper modules under `src/lib/`. No vitest/jest. Uses `src/lib/_test-helpers.mjs` (esbuild transformSync) to load `.ts` directly. |

## 3. Folder tree (2–3 levels)

```
carrot-carrot/
├── CLAUDE.md                        # this file
├── PROJECT_STATE.md                 # current implementation snapshot
├── ARCHITECTURE.md                  # data flow + worker + D1 schema
├── NEXT_PR_PLAYBOOK.md              # next 5 PR prompts
├── README.md
├── DEPLOY.md
├── ECONOMY_DESIGN.md
├── ONBOARDING_FLOW.md
├── FARM_RULES.md
├── TOOLS_DESIGN.md
├── SEASONAL_DESIGN.md
├── assets-missing.md
├── docs/SETUP_FOR_USER.md
│
├── package.json
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── granite.config.ts                # Apps-in-Toss console config
├── eslint.config.js
├── .env.preview / .env.example      # public env (no secrets)
│
├── public/
│   └── assets/farm/
│       ├── bg_day.webp              # in-card farm background
│       ├── bg/                      # sky-slot backgrounds (jpeg)
│       ├── crops/                   # crop_stage1_seed.webp .. crop_stage4_ripe.webp
│       ├── tools/                   # tool_shovel/watering_can/basket/seed_pack PNG
│       ├── fx/                      # fx_sparkle / fx_water_splash / fx_heart / …
│       ├── currency/                # carrot.png / candy_carrot.png / golden_carrot.png
│       ├── icons/                   # icon_coin/gem/heart_hp/timer/xp_star/energy
│       ├── rewards/                 # medal_bronze/silver/gold, gift_box, treasure_chest
│       ├── sky/                     # sky_dawn/noon/sunset/shooting_star/rainbow/rainy/night
│       ├── items/                   # item_bag.png (+ jpg source)
│       ├── foods/                   # food_carrot_juice/soup/cake
│       └── bunny_planting.webp      # transparent bunny used in onboarding modal
│
├── src/
│   ├── App.tsx                      # wouter routes + AppsInTossLoginGate
│   ├── main.tsx
│   ├── assets/characters/           # existing bunny webp set used by dogam
│   ├── components/
│   │   ├── AppsInTossLoginGate.tsx
│   │   ├── Bunny.tsx
│   │   ├── SessionDots.tsx / SoundChip.tsx / SplashScreen.tsx / TabBar.tsx / TimerControls.tsx
│   │   ├── Farm/
│   │   │   ├── Atmosphere.tsx       # rain/snow/cherry/autumn particles
│   │   │   ├── Effects/index.tsx    # CSS/SVG FX (HarvestPop, DirtBurst, PngBurst, PerfectCombo)
│   │   │   ├── RewardsPanel.tsx     # 🎁 panel — points + daily gift + medals
│   │   │   ├── SkyView.tsx          # ☁ overlay (sky_* assets + cozy messages)
│   │   │   └── ToolDock.tsx         # 3-slot bottom dock
│   │   └── Inventory/
│   │       ├── InventoryModal.tsx          # 13-item bag, 3-tab grid
│   │       ├── BunnyGachaModal.tsx         # 0.5 % harvest pull modal
│   │       └── AdRewardChannelModal.tsx    # ad-watch channel chooser
│   ├── features/
│   │   ├── collection/
│   │   │   ├── FarmHub.tsx          # 9-polygon SVG + click logic
│   │   │   ├── farmStore.ts         # plots/carrots/candy/golden/seeds (zustand)
│   │   │   ├── farmSync.ts          # POSTs to worker /farm/*
│   │   │   ├── BunnyOnboardingModal.tsx
│   │   │   ├── FarmOnboarding.tsx   # compat re-export
│   │   │   ├── toolStore.ts         # selected tool + watering charges (KST)
│   │   │   ├── itemsStore.ts        # 13-item inventory
│   │   │   ├── rewardsStore.ts      # medals + daily-gift claim flag
│   │   │   ├── collectionStore.ts   # legacy stats + dogam unlocks
│   │   │   ├── collectionData.ts    # CHARACTERS / SLOTS / RARITY_*
│   │   │   └── UnlockOverlay.tsx
│   │   ├── share/ShareCard.tsx
│   │   ├── sound/AdPassModal.tsx
│   │   └── timer/sessionMath.ts
│   ├── lib/
│   │   ├── farmRules.ts             # 5-min gate + duration tier
│   │   ├── farmBackground.ts        # KST → bg slot
│   │   ├── skyMessages.ts           # 12 msgs / slot
│   │   ├── skyView.ts               # bg slot → sky asset URL
│   │   ├── seasonalBunny.ts         # rollHarvestGacha, computePerfectCombo
│   │   ├── bunnyGacha.ts            # 4-tier draw (common/rare/epic/legendary)
│   │   ├── rewardTables.ts          # DAILY_GIFT_TABLE / WEEKLY_TREASURE_TABLE
│   │   ├── points.ts                # carrot/candy/golden → P
│   │   ├── safeStorage.ts           # iframe-safe local/session shim
│   │   ├── api.ts / appsInTossLogin.ts / toss.ts / tossRewardedAd.ts
│   │   └── *.test.mjs               # node --test pure-helper tests
│   ├── design-system/
│   │   ├── base.css / tokens.css
│   │   ├── ui.tsx                   # Button / Chip / BottomSheet / ToastViewport
│   │   ├── ThemeProvider.tsx
│   │   └── haptic.ts
│   ├── pages/                       # HomePage / CollectionPage / ReportPage / SettingsPage / NotFoundPage
│   ├── services/                    # authService, pushService, sessionsApi
│   └── store/                       # soundStore, timerStore, userStore
│
├── cloudflare/workers/carrot-carrot-api/
│   ├── wrangler.toml
│   ├── package.json
│   ├── src/
│   │   ├── index.ts                 # Hono app + CORS + route mounts
│   │   ├── types.ts
│   │   ├── routes/                  # health, login, me, refresh, unlink, farm, economy, tools, items, boxes
│   │   └── lib/                     # db.ts, jwt.ts, toss.ts, decrypt.ts
│   └── migrations/                  # 0001_init → 0006_items (additive, NEVER apply via Claude)
│
└── scripts/                         # build-submit / run-ait-build / package-source / export-icons / …
```

## 4. Build / test / dev commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (localhost:5173). |
| `npm run typecheck` | `tsc -b --noEmit`. **Must pass before every PR.** |
| `npm run lint` | ESLint (current baseline ≈ 39 errors, see PROJECT_STATE.md). |
| `npm run build` | Production build → `dist/`. |
| `npm run build:preview` | Preview build (mock auth) → `dist-preview/`. Used for review URLs. |
| `npm run preview:serve` | Serve `dist-preview/` on `0.0.0.0:4173`. |
| `npm run build:ait` | Apps-in-Toss `.ait` artifact at `carrot-carrot.ait`. Wraps two RN builds + zip. |
| `npm run package:source [out.zip]` | Source zip via `scripts/package-source.mjs`. Excludes `node_modules`, `dist*`, `.git`. |
| `node --test src/lib/*.test.mjs` | Pure-helper unit tests. Current status: **49/49 pass** (farmRules 15, seasonalBunny 13, points 7, skyMessages 6, rewardTables 8). |

## 5. Forbidden commands (NEVER run in any session)

| Forbidden | Why |
| --- | --- |
| `wrangler deploy` / `wrangler publish` | Touches real production worker. Reward economy = real money. |
| `wrangler d1 migrations apply` | Database mutation. Only a human with the staging DB binding may run this. |
| `ait deploy` / `granite deploy` | Pushes the `.ait` to the Apps-in-Toss console. |
| Any direct `curl` to `https://carrot-carrot-api.bunniesfarm.workers.dev` or `apps-in-toss.com` for non-read endpoints | Hits production. |
| `git push --force` to `master` | Destructive. |
| `git commit --amend` / `git rebase -i` | Don't rewrite shared history. |
| Adding hard-coded API keys or secrets anywhere in source | All secrets live in `wrangler secret put` only. |
| Editing the 9 farm polygon coordinates | Locked in `FarmHub.tsx → PLOT_POLYGONS`. Any layout change is opt-in only. |

## 6. Work policies

- **Never amend pushed commits.** Always create a new commit.
- **Don't apply migrations.** Write the SQL file and document the exact `wrangler d1 migrations apply <DB_NAME>` command in the PR report; let the maintainer run it.
- **Preview no-login is sacred.** `.env.preview` sets `VITE_MOCK_AUTH=true`. The Apps-in-Toss login gate auto-passes when `isMockForced()`; don't bypass that path with new code.
- **Iframe-safe storage.** All `localStorage` / `sessionStorage` access must go through `safeStorage` / `safeSessionStorage` (`src/lib/safeStorage.ts`). Perplexity preview blocks the literal token; the shim string-concats the API name so the built bundle never contains it.
- **BASE_URL paths only.** Asset URLs must use `${import.meta.env.BASE_URL}…`. Never `"/assets/…"` (host root) — nested-proxy hosting breaks.
- **Polygon geometry frozen.** Don't edit `PLOT_POLYGONS` (id 0..8). `id3` and `id5` were manually corrected and are part of the design lock.
- **Toast text-only on farm.** Farm-tab toasts render via the `body[data-farm-view="1"] [data-cc-toast-pill]` rule — text + stroke only, no pill background. Other tabs keep the glass pill. See `src/design-system/base.css`.
- **No idle bunny on the farm.** The old `FarmBunny` component was removed. The bunny only appears inside `BunnyOnboardingModal` and `BunnyGachaModal`.

## 7. Business rules (must hold)

| Rule | Where enforced |
| --- | --- |
| 5-minute focus gate — under 5 min grants nothing | `src/lib/farmRules.ts` → `getFocusFarmReward` ; applied at `src/pages/HomePage.tsx` |
| Tier table (5–14 / 15–29 / 30–49 / 50+) | `src/lib/farmRules.ts` |
| Point values carrot=1 / candy=5 / golden=10 | `src/lib/points.ts` |
| MIN_PAYOUT = 50 P | `src/lib/points.ts` |
| Harvest gacha 0.5 % bunny / 1 % golden / 4 % candy (base) | `src/lib/seasonalBunny.ts → rollHarvestGacha` |
| Bunny rarity weights common 70 / rare 22 / epic 7 / legendary 1 (harvest excludes legendary) | `src/lib/bunnyGacha.ts → TIER_WEIGHTS` + `excludeLegendary` |
| Legendary bunny costs 100 stars | `src/lib/bunnyGacha.ts → LEGENDARY_STAR_COST` |
| Watering can 10 charges / day + max 3 ad-refills | `src/features/collection/toolStore.ts → TOOL_CONSTANTS` |
| Daily gift box once per KST day | `src/features/collection/rewardsStore.ts → claimDailyGift` + `cloudflare/.../routes/boxes.ts` |
| Weekly treasure progress 7-to-open | `src/lib/rewardTables.ts` + worker route |
| Sky `quiet_sky` medal at 5 min total | `src/components/Farm/SkyView.tsx → QUIET_SKY_THRESHOLD_SEC` |

## 8. Required PR outputs (every change)

Every PR Claude opens must:

1. Run `node --test src/lib/*.test.mjs` — report pass count.
2. Run `npm run typecheck` — must be clean (or report regressions vs baseline).
3. Run `npm run build` AND `npm run build:preview` — both must succeed.
4. Run `npm run build:ait` if assets or worker types changed.
5. Re-verify scrubs against `dist-preview/`:
   - 0 occurrences of `localStorage` / `sessionStorage` / `indexedDB` / `requestFullscreen` / `exitFullscreen` / `requestPointerLock` / `exitPointerLock`
   - 0 occurrences of literal `"/assets/farm"` (i.e. absolute root paths)
6. Commit message format: `feat(area): summary` or `fix(area): summary` (Korean OK in body).
7. Update `IMPLEMENTATION_REPORT.md` if the public surface of a feature changed (or the equivalent doc in `docs/`).
8. **Do not** create source zips unless the user asks.

## 9. Known TODO / 미구현 (truth, not aspiration)

Search hits for `TODO` / `미구현` in the working tree (2026-05-14):

| File:line | Description |
| --- | --- |
| `src/components/Inventory/AdRewardChannelModal.tsx:112` | TODO — post nonce + channel to worker `/economy/ad-view` once ad-token verification is wired. |
| `src/components/Inventory/InventoryModal.tsx:17` | TODO — juice/soup/cake are preview-only flag toasts. |
| `src/components/Inventory/InventoryModal.tsx:101,104,107` | `(미구현)` shown to user. |
| `src/features/collection/itemsStore.ts:176,178` | `gem` 미구현 — 차후 상점 화폐. |
| `src/features/collection/itemsStore.ts:185,187` | `heart` 미구현 — 차후 친구 시스템. |
| `cloudflare/.../routes/tools.ts:17,220` | TODO — Apps-in-Toss ad-token verification. |
| `cloudflare/.../routes/items.ts:15,104` | TODO — code whitelist + ad-nonce join. |

See `PROJECT_STATE.md` § E for the full "implemented vs 미구현" matrix.

## 10. User / Claude / Perplexity workflow

This repo gets worked on by three roles. Stay in your lane:

| Role | Does | Doesn't |
| --- | --- | --- |
| **사용자 (human)** | Approves UX direction. Provides screenshots in `/home/user/workspace/*.jpg`. Decides product trade-offs. | Doesn't write code. |
| **Claude (this CLI)** | Implements PRs, writes tests, generates assets via Pillow when needed, produces builds + zips, writes design docs. | Doesn't deploy. Doesn't run wrangler. Doesn't push to remote. |
| **Perplexity preview** | Reviews UI deltas against the brief in a hosted iframe — uses `dist-preview/`. | Doesn't write code; flags forbidden-token leaks, layout regressions, broken assets. |

Workflow for a new task:

1. User drops a screenshot or text spec in this CLI.
2. Claude reads the relevant module(s), proposes a plan, implements, runs the 5-command battery from § 8, commits.
3. Claude reports artifact paths (AIT, sometimes source zip) + a deploymentId from `build:ait`. **NOT deployed.**
4. User uploads the preview build / AIT manually when ready.
5. Perplexity preview validates the next iteration; user feeds back, loop.

When in doubt: **make the build + tests pass, write the doc, do not deploy.**
