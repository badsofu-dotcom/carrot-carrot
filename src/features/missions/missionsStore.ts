/**
 * Missions store (PR-52) — 3 daily missions + progress tracking +
 * KST 자정 자동 rotation.
 *
 * Trigger 사이트가 `incrementProgress(type, amount?)` 호출. 본 store
 * 가 active mission 중 매치되는 것 찾아 progress 증분. threshold 도달
 * 시 `claim(type)` 으로 P 그랜트 (caller 가 farmStore.incCarrots).
 *
 * safeStorage 영속 — day + progress map + claimed set.
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import {
  ALL_COMPLETE_BONUS_P,
  DAILY_MISSION_COUNT,
  kstDayKey,
  pickDailyMissions,
  type MissionDef,
  type MissionType,
} from "./dailyMissions";

// PR-75 — pool 재설계로 mission type set 변경. v1 영속 데이터 무효화.
// 구 v1 키는 무해하게 사이드에 남고, fresh start 로 새 미션 시작.
const STORAGE_KEY_DAY = "cc.missions.day.v2";
const STORAGE_KEY_PROGRESS = "cc.missions.progress.v2";
const STORAGE_KEY_CLAIMED = "cc.missions.claimed.v2";
const STORAGE_KEY_BONUS = "cc.missions.bonusClaimed.v2";

interface MissionsState {
  day: string;
  /** Today's 3 picks (deterministic from day key). */
  missions: readonly MissionDef[];
  /** Per-type progress (0..threshold). */
  progress: Record<MissionType, number>;
  /** Claimed mission types (today). */
  claimed: ReadonlySet<MissionType>;
  /** True iff all-complete bonus already granted today. */
  bonusClaimed: boolean;

  /** Increment progress for a mission type. Caps at threshold. */
  incrementProgress: (type: MissionType, amount?: number) => void;
  /**
   * Claim a completed mission. Returns rewardP (>0) on success, 0 on
   * already-claimed or not-yet-completed. Caller is responsible for
   * actually granting carrots (farmStore.incCarrots).
   */
  claim: (type: MissionType) => number;
  /**
   * Claim all-complete bonus when all 3 missions are claimed. Returns
   * ALL_COMPLETE_BONUS_P on success, 0 if any mission unclaimed or
   * bonus already taken.
   */
  claimAllBonus: () => number;
  /** Force re-pick (DEV) — bumps day to today, clears claimed set. */
  rerollForToday: () => void;
  /** Reset for tests / wipe. */
  reset: () => void;
}

// PR-111 — Legacy MissionType 12종 제거. Active pool 만.
function emptyProgress(): Record<MissionType, number> {
  return {
    min25Sessions2: 0,
    totalFocusMin50: 0,
    perfectCombo1: 0,
  };
}

function loadDay(): string {
  return safeStorage.get(STORAGE_KEY_DAY) ?? "";
}
function saveDay(v: string) {
  try {
    safeStorage.set(STORAGE_KEY_DAY, v);
  } catch {
    /* ignore */
  }
}
function loadProgress(): Record<MissionType, number> {
  const raw = safeStorage.get(STORAGE_KEY_PROGRESS);
  if (!raw) return emptyProgress();
  try {
    const v = JSON.parse(raw);
    const out = emptyProgress();
    if (v && typeof v === "object") {
      for (const k of Object.keys(out) as MissionType[]) {
        const n = (v as Record<string, unknown>)[k];
        if (typeof n === "number" && n >= 0) out[k] = Math.floor(n);
      }
    }
    return out;
  } catch {
    return emptyProgress();
  }
}
function saveProgress(p: Record<MissionType, number>) {
  try {
    safeStorage.set(STORAGE_KEY_PROGRESS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
function loadClaimed(): Set<MissionType> {
  const raw = safeStorage.get(STORAGE_KEY_CLAIMED);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return new Set(arr.filter((x) => typeof x === "string") as MissionType[]);
    }
  } catch {
    /* ignore */
  }
  return new Set();
}
function saveClaimed(s: ReadonlySet<MissionType>) {
  try {
    safeStorage.set(STORAGE_KEY_CLAIMED, JSON.stringify(Array.from(s)));
  } catch {
    /* ignore */
  }
}
function loadBonus(): boolean {
  return safeStorage.get(STORAGE_KEY_BONUS) === "1";
}
function saveBonus(v: boolean) {
  try {
    safeStorage.set(STORAGE_KEY_BONUS, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Initialize / rollover — KST 자정 cross-day 시 progress + claimed
 *  + bonus 모두 reset, missions 새로 picked. */
function bootstrap(): {
  day: string;
  missions: readonly MissionDef[];
  progress: Record<MissionType, number>;
  claimed: Set<MissionType>;
  bonusClaimed: boolean;
} {
  const today = kstDayKey();
  const persistedDay = loadDay();
  if (persistedDay !== today) {
    saveDay(today);
    saveProgress(emptyProgress());
    saveClaimed(new Set());
    saveBonus(false);
    return {
      day: today,
      missions: pickDailyMissions(today),
      progress: emptyProgress(),
      claimed: new Set(),
      bonusClaimed: false,
    };
  }
  return {
    day: today,
    missions: pickDailyMissions(today),
    progress: loadProgress(),
    claimed: loadClaimed(),
    bonusClaimed: loadBonus(),
  };
}

export const useMissionsStore = create<MissionsState>((set, get) => {
  const init = bootstrap();
  return {
    day: init.day,
    missions: init.missions,
    progress: init.progress,
    claimed: init.claimed,
    bonusClaimed: init.bonusClaimed,

    incrementProgress: (type, amount = 1) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      // Day cross check — if today changed, bootstrap.
      const today = kstDayKey();
      if (get().day !== today) {
        const fresh = bootstrap();
        set({
          day: fresh.day,
          missions: fresh.missions,
          progress: fresh.progress,
          claimed: fresh.claimed,
          bonusClaimed: fresh.bonusClaimed,
        });
      }
      const active = get().missions.find((m) => m.type === type);
      if (!active) return; // type 이 오늘 picked 아님 — silent no-op
      const cur = get().progress[type] ?? 0;
      if (cur >= active.threshold) return; // 이미 최대
      const next = { ...get().progress };
      next[type] = Math.min(active.threshold, cur + Math.floor(amount));
      saveProgress(next);
      set({ progress: next });
    },

    claim: (type) => {
      const active = get().missions.find((m) => m.type === type);
      if (!active) return 0;
      if (get().claimed.has(type)) return 0;
      const cur = get().progress[type] ?? 0;
      if (cur < active.threshold) return 0;
      const next = new Set(get().claimed);
      next.add(type);
      saveClaimed(next);
      set({ claimed: next });
      return active.rewardP;
    },

    claimAllBonus: () => {
      if (get().bonusClaimed) return 0;
      const all = get().missions.every((m) => get().claimed.has(m.type));
      if (!all) return 0;
      saveBonus(true);
      set({ bonusClaimed: true });
      return ALL_COMPLETE_BONUS_P;
    },

    rerollForToday: () => {
      const fresh = bootstrap();
      set({
        day: fresh.day,
        missions: fresh.missions,
        progress: fresh.progress,
        claimed: fresh.claimed,
        bonusClaimed: fresh.bonusClaimed,
      });
    },

    reset: () => {
      safeStorage.remove(STORAGE_KEY_DAY);
      safeStorage.remove(STORAGE_KEY_PROGRESS);
      safeStorage.remove(STORAGE_KEY_CLAIMED);
      safeStorage.remove(STORAGE_KEY_BONUS);
      const fresh = bootstrap();
      set({
        day: fresh.day,
        missions: fresh.missions,
        progress: fresh.progress,
        claimed: fresh.claimed,
        bonusClaimed: fresh.bonusClaimed,
      });
    },
  };
});

export { DAILY_MISSION_COUNT };
