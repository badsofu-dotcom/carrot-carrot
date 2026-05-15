# IMPLEMENTATION_REPORT_PR-3 — Server-authoritative bunny gacha

**Date:** 2026-05-15
**Branch:** `main`
**Scope:** Stand up `/bunnies/draw` + `/bunnies/collection` worker routes, mirror to client via `bunniesSync.ts`, hydrate `useCollectionStore.ownedCharacters` from the server. **Seasonal art replacement is deferred** — no PNGs were supplied for spring/summer/autumn/winter bunnies, so the `SEASONAL_POOLS` swap + new `CharacterDef` entries are explicitly **out of scope** for this PR. The worker `ROSTER` is structured to accept those entries the moment art lands.

## What landed

### New worker files
- `cloudflare/workers/carrot-carrot-api/src/lib/bunnyDraw.ts` — pure `drawFromRoster(args)` helper. Weighted tier pick (common 70 / rare 22 / epic 7 / legendary 1) with fallthrough across buckets when the chosen tier is exhausted. `excludeLegendary` defaults true (matches harvest semantics). No Hono dependency — testable via the same `loadTs` shim as `adToken`.
- `cloudflare/workers/carrot-carrot-api/src/routes/bunnies.ts` — Hono app with `GET /collection` and `POST /draw`. Server reads owned set from `bunny_collection` (migration 0006), calls `drawFromRoster`, inserts `INSERT OR IGNORE INTO bunny_collection`. Pre-0006 deploys return `409 SCHEMA_NOT_READY`. `ROSTER` constant lists the 12 existing client `CharacterDef` ids; seasonal slots are commented out with a pointer to `SEASONAL_DESIGN.md`.

### New client files
- `src/features/collection/bunniesSync.ts` — mirrors `farmSync.ts` / `itemsSync.ts`. `loadBunnyCollection()` + `drawBunnyOnServer(excludeLegendary)`. Discriminated `BunniesSyncResult`, never throws, `noop` mode when API base or JWT is absent.

### New tests
- `src/lib/bunnyDraw.test.mjs` — 8 cases: TIER_WEIGHTS sum, rng=0 → common pick, excludeLegendary blocks legendary across 20 trials, excludeLegendary=false + rng=0.995 picks legendary, owned-set excludes the picked id, empty-tier fallthrough, all-owned → null/null, deterministic with fixed rng.

### Modified — worker
- `src/index.ts` — mount `app.route("/bunnies", bunniesRoute)`.

### Modified — client
- `src/features/collection/FarmHub.tsx`
  - On mount: also load `loadBunnyCollection()` and feed bunny ids into `hydrateBunniesFromRemote`.
  - 0.5% harvest pull path is now server-authoritative-with-fallback: the client gate runs locally (no RTT on every harvest), then on a hit we call `drawBunnyOnServer(true)`. If the server responds with a bunny, the modal uses that id. If the server is offline / noop / errors, the local `drawBunny` is the fallback. Result: dogam stays interactive in preview/guest/offline, and live users get an authoritative ownership trail.
- `src/features/collection/collectionStore.ts` — new `hydrateBunniesFromRemote(ids)` action. Union-only merge: ids already owned are skipped, unknown ids (server roster has more than client knows) are silently ignored. Returns the list of newly-merged ids.

### Modified — docs
- `SEASONAL_DESIGN.md` — added a "Server-authoritative gacha (PR-3)" section documenting the `/bunnies/draw` + `/bunnies/collection` contract, the client fallback chain, the `TIER_WEIGHTS` ownership (server SoT), and the 3-step roster-sync runbook for adding new bunnies. Known-limitations section refreshed to clarify the SEASONAL_POOLS placeholder is now a parallel-future-path, not a bug.

## Out of scope — needs art

The PR-3 deliverables checklist includes these items that require user-supplied PNGs and are explicitly **not** done in this PR:

- [ ] Swap placeholder IDs in `SEASONAL_POOLS` for real character ids.
- [ ] Add seasonal `CharacterDef` entries (id, rarity, name, imageSrc, bio) in `collectionData.ts`.
- [ ] Drop PNGs into `public/assets/farm/bunnies/` or `src/assets/characters/`.
- [ ] Dogam grid (`CollectionPage.tsx` dogam branch) shows silhouette for un-owned seasonals.

The seasonal entries in the worker `ROSTER` are commented out with an explicit pointer (`SEASONAL_POOLS pending art uploads (see SEASONAL_DESIGN.md)`). Drop them in once the PNG set ships.

The `seasonalBunny.test.mjs` assertion "no placeholder IDs remain" from the playbook is also deferred — the IDs DO still remain but are unused at the harvest call site (we use `drawBunny` / `drawBunnyOnServer`, not the seasonalBunny.ts bunny outcome). SEASONAL_DESIGN.md "Known limitations" now documents why.

## Verification

```
node --test src/lib/*.test.mjs          ✔ 66/66 (was 58, +8 bunnyDraw)
npm run typecheck (root)                ✔ clean
cd cloudflare/.../carrot-carrot-api && npm run typecheck   ✔ clean
npm run build                           ✔
npm run build:preview                   ✔
VITE_APPS_IN_TOSS_PROXY_URL=… npm run build:ait  ✔ (deploymentId 019e290c-9ece-76f8-994e-eb930f53fa0e)
```

Forbidden-token scrub against `dist-preview/`:
```
localStorage: 0      sessionStorage: 0    indexedDB: 0
requestFullscreen: 0 exitFullscreen: 0    requestPointerLock: 0  exitPointerLock: 0
"/assets/farm: 0     '/assets/farm: 0
```

## Maintainer commands (human-only)

No new migration; uses `bunny_collection` from migration 0006.

```
# If migration 0006 is not yet applied on production:
wrangler d1 migrations apply carrot-carrot-db --remote --dry-run
wrangler d1 migrations apply carrot-carrot-db --remote
```

Sample queries (post-apply):
```
# Inspect the user's bunny collection
wrangler d1 execute carrot-carrot-db --remote \
  --command="SELECT user_key, bunny_id, tier, owned_at FROM bunny_collection \
             ORDER BY owned_at DESC LIMIT 20"

# Roster mismatch audit — bunny ids the server owns but the client roster doesn't list
wrangler d1 execute carrot-carrot-db --remote \
  --command="SELECT DISTINCT bunny_id, tier FROM bunny_collection \
             WHERE bunny_id NOT IN ('idle','focus','eat25','eat50','eat75','cry','sleep',\
                                    'success','rare-ninja','rare-king','sr-wizard','legendary-demon')"
```

Deploy: `wrangler deploy` — human only.

## Risk surface

- **Server / client roster drift:** if the server's `ROSTER` lists an id the client doesn't render, `drawBunnyOnServer` will record it but the modal silently no-ops (`findBunny` returns null). Mitigation: the 3-step runbook in `SEASONAL_DESIGN.md → Roster sync`.
- **Double-record across local + server pull paths:** the harvest flow now talks to the server first, but the local `forceUnlock` still runs. If the server returns bunny "X" and the local hydrate later also imports bunny "X", `forceUnlock` is a no-op (already owned). No risk.
- **Rate of `/bunnies/draw` calls:** the 0.5% client gate caps RPS naturally. A bug that loosened the gate could DoS the worker — keep `HARVEST_BUNNY_CHANCE` at 0.005 unless changing intentionally.
