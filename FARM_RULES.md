# Farm rules — focus completion → farm rewards

Pure helper: `src/lib/farmRules.ts`
Unit tests: `node --test src/lib/farmRules.test.mjs` (15 threshold tests, no extra deps)

## 5-minute gate

A focus session must run for at least **5 minutes** of *focused* time before any session reward applies. Anything shorter:

- crops do **not** grow,
- no seeds awarded,
- **no carrot stat increment** (the legacy `applySession` is also gated now),
- **no streak increment**, **no unlock check**, **no sound-pass grant** — the entire reward branch in `HomePage.tsx` is short-circuited,
- watering-can charges are not consumed or refilled,
- the player sees a friendly toast: **"5분 이상 집중해야 작물이 자라요"**.

This means a 1-minute focus completion is a fully-noop session for the report stats, the farm, and the inventory. The timer still resets and the snapshot still clears so the UI returns to idle — but no state has changed.

The gate is enforced in `getFocusFarmReward(durationMinutes)` and called from `HomePage.tsx` via `getFocusFarmRewardFromMs(lastSnapshot.focusedMs)` on the focus-complete branch of the snapshot effect. The same `lastSnapshotIdRef` guard that wraps the rest of the rewards block prevents double-fire.

`durationMinutes` is computed as `Math.floor(focusedMs / 60_000)`. Fractional minutes round down (so `4.999` is still gated).

## Duration tier table

For valid sessions (≥ 5 minutes), the helper returns:

| Duration (minutes)  | Tier    | growSteps | seedDelta | Toast message |
| ------------------- | ------- | --------- | --------- | --- |
| 5 – 14              | `t5`    | 1         | 0         | `작물이 1단계 자랐어요` |
| 15 – 29             | `t15`   | 1         | 1         | `작물이 1단계 자랐어요 · 씨앗 +1` |
| 30 – 49             | `t30`   | 2         | 2         | `작물이 2단계 자랐어요 · 씨앗 +2` |
| 50 – ∞              | `t50`   | 3         | 3         | `작물이 3단계 자랐어요 · 씨앗 +3` |

Below the gate:

| Duration (minutes) | Tier     | growSteps | seedDelta | Toast message |
| ------------------ | -------- | --------- | --------- | --- |
| 0 – 4              | `gated`  | 0         | 0         | `5분 이상 집중해야 작물이 자라요` |

`growSteps` is the number of `+1` stage advances applied to every planted plot (stage 1–3). A plot already at stage 4 (ripe) does not advance. The local store clamps each plot at stage 4 via `Math.min(4, …)` and the worker clamps in the SQL `MIN(stage + 1, 4)`.

`seedDelta` is added to the local `seeds` inventory in `useFarmStore`. **Harvest still requires a tap on a ripe plot** — seeds and stage growth never auto-harvest.

## Where the rules are applied

| Layer | File | Behavior |
| --- | --- | --- |
| Pure logic | `src/lib/farmRules.ts` | `getFocusFarmReward(min)` and `getFocusFarmRewardFromMs(ms)` |
| Tests | `src/lib/farmRules.test.mjs` | Boundary thresholds: 4 / 5 / 14 / 15 / 29 / 30 / 49 / 50 (+ negative / NaN / ms-helper) |
| App glue | `src/pages/HomePage.tsx` | On focus-complete snapshot, call the helper. If gated → toast only. Else call `useFarmStore.getState().growAllPlanted(growSteps, snapshotId, seedDelta)` and surface the message. |
| Local store | `src/features/collection/farmStore.ts` | `growAllPlanted(steps, snapshotId, seedDelta)`. Snapshot-id dedupe prevents double-application across re-renders. Bonus seeds added to local `seeds` field even when no plots were planted (so the bonus isn't lost when the player ran focus without seeded plots). |
| Sync adapter | `src/features/collection/farmSync.ts` | `growOnServer(steps, _snapshotId)` posts `{ steps }` to the worker. Clamped to [1,3]. |
| Worker route | `cloudflare/workers/carrot-carrot-api/src/routes/farm.ts` | `POST /farm/grow` accepts `{ steps?: 1|2|3 }`. Loops `growAllPlots` `steps` times so existing SQL works without a migration. Defaults to 1 for back-compat with older clients. |

### Seeds persistence (D1 migration 0004)

Migration `cloudflare/workers/carrot-carrot-api/migrations/0004_farm_seed_rewards.sql` adds a `seeds INTEGER NOT NULL DEFAULT 0` column to `farm_inventory`. The worker now:

- Returns `seeds` in `GET /farm/state`, `POST /farm/plant`, `POST /farm/grow`, `POST /farm/harvest`.
- Accepts `{ steps?, seedDelta? }` on `POST /farm/grow`. `seedDelta` is clamped to `[0, 3]`. The DB write uses `addSeeds()` which silently no-ops when the column doesn't exist yet (try/catch fallback), so an older worker deploy won't 500.

The migration is **not applied remotely from this session** — that requires `wrangler d1 migrations apply` against the production binding, which we explicitly do not run here. The command the maintainer should run (with their own Cloudflare auth):

```
cd cloudflare/workers/carrot-carrot-api
npx wrangler d1 migrations apply <DB_NAME>            # local
npx wrangler d1 migrations apply <DB_NAME> --remote   # production
```

(`<DB_NAME>` matches the binding in `wrangler.toml`; the command is non-destructive — `ALTER TABLE ADD COLUMN` only.) Until then, `seeds` lives in the client `useFarmStore.seeds` field and the worker returns `0`.

## UI feedback

- Single toast per snapshot — the existing toast-stacking limit from earlier work continues to apply, so spam is prevented even if the user gets sequential completions.
- Header chips (`🥕 당근 N  🌱 N  ✨ N`) update reactively because they read directly from `useFarmStore`.
- Seeds inventory is exposed today via the header's `aria-label` ("당근 N개, 씨앗 N개, 심은 밭 N개, 수확 가능 N개"). When a dedicated seeds chip is needed, read `useFarmStore((s) => s.seeds)`.

## Behavior summary at a glance

| Focused time | Crops grow? | Seeds? | Carrots? (manual harvest only) | Toast |
| --- | --- | --- | --- | --- |
| 0–4 min | ❌ | ❌ | unchanged | "5분 이상 집중해야…" |
| 5–14 min | +1 stage | ❌ | unchanged | "작물이 1단계 자랐어요" |
| 15–29 min | +1 stage | +1 | unchanged | "작물이 1단계 자랐어요 · 씨앗 +1" |
| 30–49 min | +2 stages | +2 | unchanged | "작물이 2단계 자랐어요 · 씨앗 +2" |
| 50+ min | +3 stages | +3 | unchanged | "작물이 3단계 자랐어요 · 씨앗 +3" |

## 친구 방문 — visitor bunny (v1, PR-5)

A single visitor bunny appears on the farm card once per KST day. Tap to wave → +1 heart (recorded in the bag's `heart` item slot). At most one wave per day, enforced server-side.

| Aspect | Value |
| --- | --- |
| Visitor pick | Deterministic FNV-1a hash of `${user_key}:${ymd}` mod `VISITOR_POOL` (worker `lib/visitorRng.ts`). Same user + day → same visitor. |
| Pool | `idle / focus / eat25 / eat50 / eat75 / sleep / success / rare-ninja / rare-king` — common + rare tiers only. Legendary visitors stay rare-by-luck via the regular gacha. |
| Reward | +1 heart per wave. Future PRs can wire heart consumption. |
| Day reset | KST midnight. PK `(user_key, ymd)` on `friend_visits` enforces idempotency. |
| Privacy | **No real social graph.** No PII, no friend list, no follow. v1 is a daily decorative drop. |
| Sprite lifetime | 6 s pop on FarmHub mount; auto-dismisses if untapped. Hidden while the SkyView overlay is open so they don't compete visually. |

Routes:
- `GET /friends/today` — returns today's visitor + waved state. Idempotent.
- `POST /friends/wave` — inserts the row (PK collision → `already_waved: true`), grants the heart via `user_items.code = 'heart'` upsert.

Tests: `node --test src/lib/visitorRng.test.mjs` covers determinism, day rotation, cross-user divergence, hash distribution over 1k samples, and empty-pool null return.

## Future / out of scope

- Worker-side seed persistence (needs new `user_seeds` column or table — separate PR).
- Toss-point conversion for seeds (lives in the economy worker, also separate PR).
- Tier copy / numbers are subject to product tweaks — change `STEPS`-style tables in `farmRules.ts` only; UI auto-reflects.
- Heart consumption: PR-5 grants hearts but does not spend them. A follow-up PR can wire a friend-related action that consumes hearts (gifting back, unlocking visitor variants, etc.).
