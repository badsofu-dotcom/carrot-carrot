# Farm Tools Design

PR: Bunny Time v2 — Farm Tools & Atmosphere.

## Tool dock

`src/components/Farm/ToolDock.tsx` renders four 56×56 slots inside the farm card, anchored bottom-center, above the help-copy chip. Slots: shovel, watering_can, basket, seed_pack. Active slot has an accent orange border (`#FF7B61`) and `scale(1.05)`.

Asset paths (all resolved through `import.meta.env.BASE_URL`):

| Tool | Asset | Status |
| --- | --- | --- |
| `shovel` | `assets/farm/tools/tool_shovel.png` | ✅ |
| `watering_can` | `assets/farm/tools/tool_watering_can.png` | ✅ |
| `seed_pack` | `assets/farm/tools/tool_seed_pack.png` | ✅ (display-only) |
| `basket` | `assets/farm/tools/tool_basket.png` | ✅ (converted from user-supplied jpg, transparent bg) |

`ToolDock` dispatches a `cc:tool:selected` `CustomEvent` so `FarmHub`'s click handler can branch without prop-drilling.

## Click semantics

| Plot stage | Selected tool | Action |
| --- | --- | --- |
| 0 (empty) | shovel / none | Plant (dirt-burst FX). Auto-selects shovel if no tool. |
| 0 (empty) | watering_can | Toast "물뿌리개는 자라는 작물에 사용할 수 있어요" |
| 0 (empty) | basket | Toast "바구니는 익은 작물에 사용할 수 있어요" |
| 1–3 (growing) | watering_can | Spend 1 charge → grow +1 stage + water-splash FX. If empty: toast "오늘 물뿌리개를 다 썼어요 🥲" |
| 1–3 (growing) | shovel | Toast "이미 심은 자리에요" |
| 1–3 (growing) | basket | Toast "조금만 더 집중하면 자라요 🌱" |
| 1–3 (growing) | none | Toast "집중을 완료하면 자라요" |
| 4 (ripe) | basket / shovel / none | Harvest (harvest-pop FX, carrot +1) |
| 4 (ripe) | watering_can | Toast "이미 다 자랐어요 — 바구니로 수확하세요" |

The 5-minute gate + duration-tier rules from `farmRules.ts` are unchanged — they only apply on focus completion, not on tool taps.

## Watering can

`src/features/collection/toolStore.ts` (Zustand). Daily quota:

| Field | Value |
| --- | --- |
| `MAX_DAILY` | 10 |
| `MAX_AD_REFILLS` | 3 |
| `AD_REFILL_AMOUNT` | 3 |

Reset is keyed to KST midnight via `kstDayKey()`. `rolloverIfNeeded()` is called on every read; both stale-day rollover AND ad-refill counts are atomic on the local store.

When `wateringCanLeft === 0` AND `adRefillsToday < 3`, the dock renders a 🎬 `+3 충전` button. The preview/mock path increments locally; production will call `POST /tools/refill` after Apps-in-Toss ad-verify (not implemented this PR — see TODO in `routes/tools.ts`).

## Worker side

New migration `cloudflare/workers/carrot-carrot-api/migrations/0005_tools.sql`:

```sql
CREATE TABLE IF NOT EXISTS tool_state (
  user_key               TEXT    PRIMARY KEY REFERENCES users(user_key) ON DELETE CASCADE,
  watering_can_left      INTEGER NOT NULL DEFAULT 10,
  watering_can_resets_at INTEGER NOT NULL,
  ad_refills_today       INTEGER NOT NULL DEFAULT 0,
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);
```

`watering_can_resets_at` is a unix-second timestamp marking the next KST midnight. `ensureToolState()` in `routes/tools.ts` rolls over on read and advances the reset stamp.

Routes (all JWT-bearer guarded, error wrapped):

| Method + path | Body | Returns |
| --- | --- | --- |
| `GET /tools/state` | — | `{ ok, watering_can_left, watering_can_resets_at, ad_refills_today }` |
| `POST /tools/use` | `{ tool: "watering_can" }` | same shape, charge decremented (or `WATERING_EMPTY` 409) |
| `POST /tools/refill` | TODO ad-token | same shape, +3 charges (or `AD_REFILL_CAP` 409) |
| `POST /tools/seed` | `{ slotIndex }` | `{ ok, farm, tool }` (combined inventory) |
| `POST /tools/harvest` | `{ slotIndex }` | `{ ok, farm, tool }` |

When migration 0005 hasn't been applied yet, `readToolState()` returns `null` and routes fall back to `{ ok: false, code: "SCHEMA_NOT_READY" }`. The client `useToolStore` already works standalone in that case — pure session UX.

**Migration is not applied here**. The maintainer runs:

```
cd cloudflare/workers/carrot-carrot-api
npx wrangler d1 migrations apply <DB_NAME>            # local
npx wrangler d1 migrations apply <DB_NAME> --remote   # production
```

## Effects

`src/components/Farm/Effects/index.tsx` exports `FxLayer` + the `FxKind` union. Effects render as absolute-positioned HTML INSIDE the aspect-locked farm-stage wrapper, NOT inside the SVG. The SVG uses `preserveAspectRatio="none"` so anything drawn in viewBox coordinates inherits the card's aspect stretch — which is exactly what made circles look like ovals and PNG bursts look elongated in the previous build. Positioning via plain CSS `left: cx%; top: cy%` lands on the same logical points the polygons do (the wrapper is locked to bg ratio 1536:2752 internally) while each effect itself renders at its natural ratio.

| Kind | Source | Duration | Notes |
| --- | --- | --- | --- |
| `dirt_burst` | 8 CSS particle spans | 0.6s | No ring; small earth-toned dots radiate outward up to ~26 px |
| `water_splash` | `assets/farm/fx/fx_water_splash.png` | 0.5s | 56×56 square wrapper — never stretched |
| `harvest_pop` | `assets/farm/fx/fx_harvest_pop.png` | 0.5s | 64×64 square wrapper |
| `sparkle` | `assets/farm/fx/fx_sparkle.png` | 1.0s | 52×52 square wrapper |
| `perfect_combo` | `assets/farm/fx/fx_confetti.png` (full-card flash) | 0.8s | `mix-blend-mode: screen` over the card |

All PNG bursts use a square `width = height` wrapper with `background-size: contain`, so the asset preserves its aspect ratio independent of card aspect.

## Atmosphere

`src/components/Farm/Atmosphere.tsx` overlays one-shot CSS particles inside the farm card. Pure DOM, no canvas, no rAF loop:

| Variant | Particles | Trigger |
| --- | --- | --- |
| `none` | clouds only | default |
| `rain` | 20 slanted streaks | `bg_rainy` slot |
| `snow` | 18 flakes + drift | `bg_snowy` slot |
| `cherry` | 14 pink petals | `bg_cherry` slot |
| `autumn` | 12 amber leaves | `bg_autumn` slot |

Particles are absolutely-positioned spans with compositor-only `transform` keyframes — cheap on low-end WebViews.

## Background rotation

`src/lib/farmBackground.ts` now reads from `public/assets/farm/bg/*.jpeg` for all eight non-day slots. `FarmHub` re-evaluates every 5 minutes (and on `visibilitychange`, and at the next KST hour boundary). The image swap is wrapped in `AnimatePresence` so the previous bg fades out under the new one for 0.8s.

## Acceptance checklist

- ✅ Tool dock visible on the farm card, all four slots present.
- ✅ Watering can spends from a daily 10/10 pool (KST), shows `N/10` badge.
- ✅ Seed pack badge reads the local `seeds` inventory.
- ✅ Plant FX fires on shovel→empty plot tap.
- ✅ Water FX fires on watering_can→growing plot tap (charge decremented).
- ✅ Harvest FX fires on basket→ripe plot tap.
- ✅ Perfect-combo full-card flash when stages → all-4.
- ✅ Atmosphere variant matches current bg slot.
- ✅ Header: `🥕 당근 N · 🌱 새싹 N · ✨ 캔디 N` left, `📖 도감 N/100 ⚙` right.
- ✅ Gear icon routes to `/me`.
- ❌ Production ad-verify token (TODO in `routes/tools.ts`).
