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
 *     latest server state and applies it locally. Safe to call repeatedly.
 *
 * Growth model:
 *   - Tap empty plot → plant (stage 1). 무한 — 씨앗 자원 가드 없음 (PR-109).
 *   - Tap stage 1–3 → gentle reminder toast; stage stays.
 *   - Tap stage 4 (ripe) → harvest, plot back to 0, carrot count +1.
 *   - Focus session complete → every planted plot grows +1 (capped at 4).
 *
 * PR-109 — 씨앗 자원 폐기. seeds 필드 + seedDelta param 모두 제거.
 * 미배포 컨텍스트 → 마이그레이션 / 환산 없이 깔끔 제거.
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
import { addPoints, addPointsUncapped } from "../../lib/economy/dailyCap";

export type CropStage = 0 | 1 | 2 | 3 | 4;

interface FarmState {
  stages: CropStage[]; // length 9
  carrots: number;
  candyCarrots: number;
  goldenCarrots: number;
  /** Last growth-snapshot id we applied. Internal dedup belt+braces. */
  lastGrowthSnapshotId: number | null;
  /** True once an initial hydrate attempt has resolved (ok or noop). */
  hydrated: boolean;

  plant: (id: number) => boolean;
  harvest: (id: number) => boolean;
  cycleDebug: (id: number) => void;
  /**
   * Increment the candy/golden bonus carrot inventory (local-only).
   *
   * R33 PR-189 — opts.bypassDailyCap: 광고 source 면제용. true 면
   * addPointsUncapped 로 routing 되어 일일 캡 무시 + earned 카운터
   * 영향 X. AdRewardChannelModal 의 N-th tier 보상 / 보물 채널
   * 보상 path 에서 사용.
   */
  incCandyCarrots: (n?: number, opts?: { bypassDailyCap?: boolean }) => void;
  incGoldenCarrots: (n?: number, opts?: { bypassDailyCap?: boolean }) => void;
  /** Direct-grant carrot count (PR-17b weekly treasure rewards). */
  incCarrots: (n?: number, opts?: { bypassDailyCap?: boolean }) => void;
  /**
   * Atomic carrot debit. Returns true if `carrots >= n` and decrement
   * applied, false otherwise. Server sync is NOT triggered — callers
   * (e.g. farmhubStore.buyNextStep) are local-only sinks for now.
   */
  spendCarrots: (n: number) => boolean;
  /**
   * R32 PR-181 — candy/golden in-app sink 인프라.
   * spendCarrots 와 동일한 CAS 패턴. 신규 sink (프리미엄 가구 결제 /
   * 가챠 pity) 가 잔액을 안전하게 차감하는 데 사용.
   */
  spendCandyCarrots: (n: number) => boolean;
  spendGoldenCarrots: (n: number) => boolean;
  /**
   * Grow every planted plot by `steps` (capped at stage 4).
   * `snapshotId` is the unique focus-complete snapshot id (e.g. lastSnapshot.at).
   * Pass it to guarantee idempotency: a repeated call with the same id is a
   * no-op even if the HomePage effect runs twice.
   */
  growAllPlanted: (
    steps?: number,
    snapshotId?: number | null,
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
  set({ stages: next, carrots: r.state.carrots });
}

export const useFarmStore = create<FarmState>((set, get) => ({
  stages: empty(),
  carrots: 0,
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

  incCandyCarrots: (n = 1, opts) => {
    if (!Number.isFinite(n) || n <= 0) return;
    const grant = Math.floor(n) * 5;
    if (opts?.bypassDailyCap) {
      void addPointsUncapped("ad_candy", grant);
    } else {
      void addPoints("candy", grant);
    }
    set({ candyCarrots: get().candyCarrots + Math.floor(n) });
  },
  incGoldenCarrots: (n = 1, opts) => {
    if (!Number.isFinite(n) || n <= 0) return;
    const grant = Math.floor(n) * 10;
    if (opts?.bypassDailyCap) {
      void addPointsUncapped("ad_golden", grant);
    } else {
      void addPoints("golden", grant);
    }
    set({ goldenCarrots: get().goldenCarrots + Math.floor(n) });
  },
  incCarrots: (n = 1, opts) => {
    if (!Number.isFinite(n) || n <= 0) return;
    const grant = Math.floor(n);
    if (opts?.bypassDailyCap) {
      void addPointsUncapped("ad_carrot", grant);
    } else {
      void addPoints("carrot", grant);
    }
    set({ carrots: get().carrots + grant });
  },

  spendCarrots: (n) => {
    if (!Number.isFinite(n) || n <= 0) return false;
    const cost = Math.floor(n);
    const cur = get().carrots;
    if (cur < cost) return false;
    set({ carrots: cur - cost });
    return true;
  },

  spendCandyCarrots: (n) => {
    if (!Number.isFinite(n) || n <= 0) return false;
    const cost = Math.floor(n);
    const cur = get().candyCarrots;
    if (cur < cost) return false;
    set({ candyCarrots: cur - cost });
    return true;
  },

  spendGoldenCarrots: (n) => {
    if (!Number.isFinite(n) || n <= 0) return false;
    const cost = Math.floor(n);
    const cur = get().goldenCarrots;
    if (cur < cost) return false;
    set({ goldenCarrots: cur - cost });
    return true;
  },

  growAllPlanted: (steps = 1, snapshotId = null) => {
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
    if (grown > 0) {
      set({ stages: next, lastGrowthSnapshotId: snapshotId });
      // PR-109 — seedDelta 제거. growOnServer 의 3번째 param 도 0.
      void growOnServer(steps, snapshotId, 0).then((r) => applyRemote(set, r));
    } else if (snapshotId !== null) {
      set({ lastGrowthSnapshotId: snapshotId });
    }
    return grown;
  },

  reset: () =>
    set({
      stages: empty(),
      carrots: 0,
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
