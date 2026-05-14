# IMPLEMENTATION_REPORT.md — Carrot Carrot

Living log of what each PR adds, what the public surface looks like, and what the maintainer must do **outside** of `git push` (D1 migrations, secrets, deploy). Append-only; latest PR on top.

---

## PR-1 — Bag Hookup + Items sync (2026-05-14)

### What landed

- **Worker route mount** (`cloudflare/.../src/index.ts`, already in `eb4a3f9`): `/items` (`routes/items.ts`) and `/boxes` (`routes/boxes.ts`) are now reachable. Auth is the existing JWT Bearer.
- **`src/features/collection/itemsSync.ts`** *(new)* — adapter modelled on `farmSync.ts`. Never throws; returns a discriminated `ItemsSyncResult`. Two endpoints:
  - `loadInventory()` → `GET /items/inventory`
  - `useItemOnServer(code, nonce?)` → `POST /items/use`
  Falls through to `{ ok: true, mode: "noop" }` when there is no API base URL or no JWT (preview / guest / offline) so the local store keeps the optimistic count.
- **`src/features/collection/itemsStore.ts`** — `consume(code, n)` now fires `useItemOnServer(code)` once per consumption after the local mutation; the server's `{ item: {code, count} }` reply reconciles into local `counts`. Added a `hydrate()` method + a `hydrated` flag; FarmHub now calls `void hydrateItems()` alongside `void hydrate()` on mount. `add()` stays local-only because the worker has no `/items/add` route — server-side balance changes come via reward/gacha routes that already write the canonical row.
- **Typecheck regressions cleared** (3 → 0 errors):
  - `BunnyGachaModal.tsx` resolves the bunny portrait through `bunnyImages[bunny.bunnyKey]` (1x + srcSet) and uses `bunny.quotes[0]` for the bio line.
  - `AdRewardChannelModal.tsx` drops the unused `useState` import.

### Result of the PR battery

| Step | Result |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **49 / 49 pass** |
| `npm run typecheck` | clean |
| `npm run build` | ✓ (build:341ms) |
| `npm run build:preview` | ✓ (build:259ms) |
| `npm run build:ait` | ✓ — `carrot-carrot.ait` written, `deploymentId: 019e267c-3c8f-7d56-af5c-aaaf84b6f8cb` |
| `dist-preview/` forbidden-token scan | 0 hits for all 7 tokens + `"/assets/farm` |

### Reward EVs (from `rewardTables.test.mjs`)

| Table | Expected Value |
| --- | --- |
| `DAILY_GIFT_TABLE` | **1.9 P** per claim |
| `WEEKLY_TREASURE_TABLE` | **7.0 P** per open |

Read for budget planning when wiring `/economy/withdraw` in PR-2. Day-1 cohort upper-bound payout: `1.9 P/day × user × 30 days ≈ 57 P/month` from daily-gift alone.

### Maintainer follow-ups

D1 migrations are **not** applied by Claude. Run these against the staging DB binding when ready:

```
wrangler d1 migrations apply carrot-carrot-db --remote --env staging
# or one at a time, in order:
wrangler d1 execute carrot-carrot-db --remote --env staging --file=cloudflare/workers/carrot-carrot-api/migrations/0004_*.sql
wrangler d1 execute carrot-carrot-db --remote --env staging --file=cloudflare/workers/carrot-carrot-api/migrations/0005_*.sql
wrangler d1 execute carrot-carrot-db --remote --env staging --file=cloudflare/workers/carrot-carrot-api/migrations/0006_*.sql
```

Repeat against production DB after staging smoke. The worker code already handles a missing `items` table gracefully (returns 500 from `/items/*` which `itemsSync` swallows as a noop) — the user sees no error.

### Public surface change

`itemsStore`:
- new method: `hydrate(): Promise<void>` (idempotent; called once from FarmHub on mount)
- new field: `hydrated: boolean`

No other store contract changed; `add` / `consume` / `speciesOwned` / `reset` keep their signatures.
