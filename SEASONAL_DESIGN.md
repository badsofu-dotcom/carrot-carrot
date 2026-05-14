# Seasonal Bunny + Combo Design

PR: Bunny Time v2 — Farm Tools & Atmosphere.

## Drop table

`src/lib/seasonalBunny.ts → rollHarvestGacha()`. Single RNG draw against a stacked-probability table; first hit wins.

| Outcome | Base rate | Boosted (perfect combo) | Notes |
| --- | --- | --- | --- |
| Seasonal bunny | 0.5% | 0.5% | Skipped if every seasonal-pool entry is owned |
| Golden carrot | 1.0% | 1.0% | 5× point value (economy worker) |
| Candy carrot | 4.0% | **12.0%** | +1%p while comboStreak ≥ 5 |
| Plain carrot | 94.5% | 86.5% | Default |

`HARVEST_BUNNY_RATE`, `HARVEST_GOLD`, `HARVEST_BASE_CANDY`, `HARVEST_BOOST_CANDY`, `COMBO_BATCH_BONUS` are exported constants — tune in one place.

## Seasonal pools (KST month-anchored)

| Months | Season | Pool |
| --- | --- | --- |
| 3, 4, 5 | spring | `seasonal_cherry_blossom` |
| 6, 7, 8 | summer | `seasonal_beach` |
| 9, 10, 11 | autumn | `seasonal_maple` |
| 12, 1, 2 | winter | `seasonal_snowman` |
| any (fallback) | general | `seasonal_basic` |

The IDs are placeholders pending dedicated seasonal art (see `assets-missing.md`). Collection storage (`useCollectionStore`) does not yet track these IDs — a follow-up PR wires them into `CHARACTERS` and the dogam grid.

## Perfect-combo trigger

`computePerfectCombo(next, prev)` returns true exactly when:
1. `next` has length 9 AND every entry is 4 (all ripe), AND
2. `prev` had at least one non-4 (so we don't refire every render).

`FarmHub.tsx` watches `stages` via `useEffect` and fires:
- the `perfect_combo` full-card FX,
- a toast `🌟 퍼펙트 콤보! 다음 수확이 좋아질거에요`.

The "perfect combo buff" itself is a future product hook — once activated, `rollHarvestGacha({ perfectCombo: true })` returns the 12% candy bucket. Wiring it into the harvest tap stream is a one-line change when the combo-state lifecycle is finalized.

## Combo batch bonus

`comboStreak ≥ 5` adds `+0.01` (1%p) to the candy bucket while the streak persists. Tracking the streak across harvest taps is a UI concern (state lives in `FarmHub` only as long as harvests come in fast) — design intent rather than implemented telemetry. Test:

```
node --test src/lib/seasonalBunny.test.mjs
```

13 cases, including all-ripe perfect-combo detection, owned-bunny exclusion, RNG bucket boundaries, and the boost effect.

## Known limitations / next PR candidates

- **Seasonal art**: every season returns a placeholder ID. Drop new bunny PNGs into `src/assets/characters/` (or `public/assets/farm/bunnies/`) and update `SEASONAL_POOLS` + `CHARACTERS`.
- **Collection persistence**: rolled bunny IDs are returned but not yet committed to `useCollectionStore`. The dogam tab won't reflect captures until a follow-up wires `applyHarvestOutcome()` → `useCollectionStore.applyOwn()`.
- **Combo lifecycle**: `perfectCombo: true` isn't latched anywhere in the runtime today — the toast shows but the gacha bonus doesn't apply yet. This is intentional: combo-window timing (5 minutes? until next focus session? per harvest day?) is a product call and not pinned in the brief.
- **Worker stat**: no `seasonal_grants` table yet. When persistence lands, mirror `farm_inventory.seeds` and add a `gacha_rolls(user_key, snapshot_id)` PK guard so re-rolls aren't possible.
