/**
 * fragmentStore (Round 24, PR-151) — 가구 조각 보유 + 교환.
 *
 * 광고 시청 (AdRewardChannelModal) drop pool 에 조각이 0.05 weight 로
 * 등장. 5조각 모이면 `exchange()` 호출 시 랜덤으로 owned 안 된 일반
 * 가구 1개를 무료 지급 (unlockCondition 가구 제외).
 *
 * 영속: localStorage `cc.fragment.v1`.
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import { useDecorStore } from "./decorStore";
import {
  FRAGMENTS_PER_FURNITURE,
  pickExchangeCandidate,
} from "./fragmentPicker";

export { FRAGMENTS_PER_FURNITURE, pickExchangeCandidate };

const STORAGE_KEY = "cc.fragment.v1";

interface PersistShape {
  count: number;
  totalEarned: number;
}

function loadPersist(): PersistShape {
  const raw = safeStorage.get(STORAGE_KEY);
  const blank: PersistShape = { count: 0, totalEarned: 0 };
  if (!raw) return blank;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return blank;
    return {
      count:
        typeof parsed.count === "number" && parsed.count >= 0
          ? Math.floor(parsed.count)
          : 0,
      totalEarned:
        typeof parsed.totalEarned === "number" && parsed.totalEarned >= 0
          ? Math.floor(parsed.totalEarned)
          : 0,
    };
  } catch {
    return blank;
  }
}

function savePersist(s: PersistShape): void {
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export interface ExchangeResult {
  ok: boolean;
  /** Granted furniture id on ok=true. */
  furnitureId?: string;
  /** Reason on ok=false: insufficient / all_owned. */
  reason?: "insufficient" | "all_owned";
  remaining?: number;
}

interface FragmentState {
  count: number;
  totalEarned: number;
  /** Add N fragments (광고 drop 호출). N defaults 1. */
  add: (n?: number) => void;
  /** Spend 5 fragments → 랜덤 미보유 가구 1개. unlockCondition 제외. */
  exchange: () => ExchangeResult;
}

export const useFragmentStore = create<FragmentState>((set, get) => {
  const init = loadPersist();
  return {
    count: init.count,
    totalEarned: init.totalEarned,

    add: (n = 1) => {
      if (!Number.isFinite(n) || n <= 0) return;
      const inc = Math.floor(n);
      const next: PersistShape = {
        count: get().count + inc,
        totalEarned: get().totalEarned + inc,
      };
      set(next);
      savePersist(next);
    },

    exchange: () => {
      const cur = get();
      if (cur.count < FRAGMENTS_PER_FURNITURE) {
        return {
          ok: false,
          reason: "insufficient",
          remaining: cur.count,
        };
      }
      const ownedIds = useDecorStore.getState().owned;
      const pickedId = pickExchangeCandidate(ownedIds);
      if (!pickedId) {
        return { ok: false, reason: "all_owned", remaining: cur.count };
      }
      // Atomic: 5 차감 + grantReward (당근 차감 X).
      const ok = useDecorStore.getState().grantReward(pickedId);
      if (!ok) {
        // 동시성 — 다른 path 가 막 owned 로 추가했을 때만 발생.
        // 한 차감도 하지 않고 retry 가능하도록 false 반환.
        return { ok: false, reason: "all_owned", remaining: cur.count };
      }
      const next: PersistShape = {
        count: cur.count - FRAGMENTS_PER_FURNITURE,
        totalEarned: cur.totalEarned,
      };
      set(next);
      savePersist(next);
      return {
        ok: true,
        furnitureId: pickedId,
        remaining: next.count,
      };
    },
  };
});
