/**
 * Farm session store — plot state survives tab navigation within the SPA.
 *
 * Persistence model:
 *   - Optimistic UI: every action updates local state immediately.
 *   - Server sync: mutating actions call through `farmSync` adapter. If the
 *     server is reachable (API base + auth token), the response replaces the
 *     local state with the canonical server snapshot. Otherwise we stay
 *     session-only and the user sees no error.
 *   - Hydration: `hydrate()` is called by FarmHub on mount; it fetches the
 *     latest server state and seeds the store. Safe to call repeatedly.
 *
 * Growth model:
 *   - Tap empty plot → seed (stage 1). Manual taps never advance further.
 *   - Tap stage 1–3 → gentle reminder toast; stage stays.
 *   - Tap stage 4 (ripe) → harvest, plot back to 0, carrot count +1.
 *   - Focus session complete → every planted plot grows +1 (capped at 4).
 *
 * Debug mode (?debug=1) allows manual stage cycling for testing/screenshots.
 */
import { create } from "zustand";
import {
  growOnServer,
  harvestOnServer,
  loadFarmState,
  plantOnServer,
  stagesFromRemote,
  type FarmSyncResult,
} from "./farmSync";

export type CropStage = 0 | 1 | 2 | 3 | 4;

interface FarmState {
  stages: CropStage[]; // length 9
  carrots: number;
  /**
   * Bonus seeds inventory awarded by focus-tier rules (see
   * `src/lib/farmRules.ts`). Client-side only today — the worker
   * schema does not store seeds yet, so this resets on a fresh
   * device. Re-hydrates only locally.
   */
  seeds: number;
  /**
   * Candy carrots (4–12% of harvests per seasonalBunny.ts). Local-only
   * for now — pending the economy worker's persistence layer. UI
   * surfaces this in the header chip and the gacha helper increments
   * via `incCandyCarrots()`.
   */
  candyCarrots: number;
  /**
   * Golden carrots (1% of harvests). Local-only, same caveat.
   */
  goldenCarrots: number;
  /** Last growth-snapshot id we applied. Internal dedup belt+braces. */
  lastGrowthSnapshotId: number | null;
  /** True once an initial hydrate attempt has resolved (ok or noop). */
  hydrated: boolean;

  plant: (id: number) => boolean;
  harvest: (id: number) => boolean;
  cycleDebug: (id: number) => void;
  /** Increment the candy/golden bonus carrot inventory (local-only). */
  incCandyCarrots: (n?: number) => void;
  incGoldenCarrots: (n?: number) => void;
  /** Direct-grant carrot count (PR-17b weekly treasure rewards). */
  incCarrots: (n?: number) => void;
  /**
   * Grow every planted plot by `steps` (capped at stage 4).
   * `snapshotId` is the unique focus-complete snapshot id (e.g. lastSnapshot.at).
   * Pass it to guarantee idempotency: a repeated call with the same id is a
   * no-op even if the HomePage effect runs twice.
   *
   * `seedDelta` (optional) is the bonus-seed count returned by
   * `getFocusFarmReward()`. Applied to local `seeds` inventory only;
   * the worker doesn't know about seeds yet (no D1 migration in this
   * PR). Defaults to 0.
   */
  growAllPlanted: (
    steps?: number,
    snapshotId?: number | null,
    seedDelta?: number,
  ) => number;
  reset: () => void;
  /**
   * Pull canonical farm state from the server (if logged in). No-op for
   * guest/mock. Safe to call multiple times — last write wins.
   */
  hydrate: () => Promise<void>;
}

const empty = (): CropStage[] => Array(9).fill(0) as CropStage[];

function applyRemote(set: (p: Partial<FarmState>) => void, r: FarmSyncResult) {
  if (!r.ok || r.mode !== "remote") return;
  const next = stagesFromRemote(r.state) as CropStage[];
  // Server is the SoT for cross-session inventory. `seeds` is optional
  // because pre-0004 workers don't return it; default to whatever the
  // local store currently has so we don't zero a locally-incremented
  // value on partial responses.
  const patch: Partial<FarmState> = {
    stages: next,
    carrots: r.state.carrots,
  };
  if (typeof r.state.seeds === "number") {
    patch.seeds = r.state.seeds;
  }
  set(patch);
}

export const useFarmStore = create<FarmState>((set, get) => ({
  stages: empty(),
  carrots: 0,
  seeds: 0,
  candyCarrots: 0,
  goldenCarrots: 0,
  lastGrowthSnapshotId: null,
  hydrated: false,

  plant: (id) => {
    const s = get();
    if (s.stages[id] !== 0) return false;
    const next = s.stages.slice();
    next[id] = 1;
    set({ stages: next });
    void plantOnServer(id).then((r) => applyRemote(set, r));
    return true;
  },

  harvest: (id) => {
    const s = get();
    if (s.stages[id] !== 4) return false;
    const next = s.stages.slice();
    next[id] = 0;
    set({ stages: next, carrots: s.carrots + 1 });
    void harvestOnServer(id).then((r) => applyRemote(set, r));
    return true;
  },

  cycleDebug: (id) => {
    const s = get();
    const cur = s.stages[id];
    const nxt: CropStage = cur === 4 ? 0 : ((cur + 1) as CropStage);
    const next = s.stages.slice();
    next[id] = nxt;
    set({ stages: next });
  },

  incCandyCarrots: (n = 1) => {
    if (!Number.isFinite(n) || n <= 0) return;
    set({ candyCarrots: get().candyCarrots + Math.floor(n) });
  },
  incGoldenCarrots: (n = 1) => {
    if (!Number.isFinite(n) || n <= 0) return;
    set({ goldenCarrots: get().goldenCarrots + Math.floor(n) });
  },
  incCarrots: (n = 1) => {
    if (!Number.isFinite(n) || n <= 0) return;
    set({ carrots: get().carrots + Math.floor(n) });
  },

  growAllPlanted: (steps = 1, snapshotId = null, seedDelta = 0) => {
    const s = get();
    if (snapshotId !== null && s.lastGrowthSnapshotId === snapshotId) {
      return 0;
    }
    let grown = 0;
    const next = s.stages.slice() as CropStage[];
    for (let i = 0; i < next.length; i++) {
      if (next[i] >= 1 && next[i] < 4) {
        next[i] = Math.min(4, next[i] + steps) as CropStage;
        grown++;
      }
    }
    const nextSeeds = Math.max(0, s.seeds + (seedDelta > 0 ? seedDelta : 0));
    if (grown > 0) {
      set({
        stages: next,
        lastGrowthSnapshotId: snapshotId,
        seeds: nextSeeds,
      });
      void growOnServer(steps, snapshotId, seedDelta).then((r) =>
        applyRemote(set, r),
      );
    } else if (snapshotId !== null) {
      set({ lastGrowthSnapshotId: snapshotId, seeds: nextSeeds });
    } else if (seedDelta > 0) {
      set({ seeds: nextSeeds });
    }
    return grown;
  },

  reset: () =>
    set({
      stages: empty(),
      carrots: 0,
      seeds: 0,
      candyCarrots: 0,
      goldenCarrots: 0,
      lastGrowthSnapshotId: null,
    }),

  hydrate: async () => {
    const r = await loadFarmState();
    applyRemote(set, r);
    set({ hydrated: true });
  },
}));

// DEV-only window hook for screenshot/e2e harness. Tree-shaken out in
// production builds (`import.meta.env.DEV` is statically false then).
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __farmStore?: typeof useFarmStore }).__farmStore =
    useFarmStore;
}
