/**
 * Weekly missions store (PR-76) — 매주 월요일 04:00 KST 자동 리셋.
 *
 * 패턴은 missionsStore (daily) 와 동일. 다른 점:
 *   - rollover: weekKey() 비교 (vs kstDayKey)
 *   - attendance type 별 day-dedupe (같은 KST 일자 첫 세션만 +1)
 *   - claim attendance → rewardsStore.addTreasureProgress(7) 로 보물상자
 *     보장
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import {
  WEEKLY_ALL_COMPLETE_BONUS_P,
  WEEKLY_MISSIONS,
  weekKey,
  type WeeklyMissionDef,
  type WeeklyMissionType,
} from "./weeklyMissions";
import { kstDayKey } from "./dailyMissions";

const STORAGE_KEY_WEEK = "cc.weeklyMissions.week.v1";
const STORAGE_KEY_PROGRESS = "cc.weeklyMissions.progress.v1";
const STORAGE_KEY_CLAIMED = "cc.weeklyMissions.claimed.v1";
const STORAGE_KEY_BONUS = "cc.weeklyMissions.bonusClaimed.v1";
const STORAGE_KEY_LAST_ATTEND = "cc.weeklyMissions.lastAttendDay.v1";

type ProgressMap = Record<WeeklyMissionType, number>;

function emptyProgress(): ProgressMap {
  return {
    weeklyAttendDays5: 0,
    weeklyTotalFocusMin300: 0,
    weeklyPerfectCombo5: 0,
  };
}

function loadString(key: string): string | null {
  return safeStorage.get(key);
}
function saveString(key: string, v: string): void {
  try {
    safeStorage.set(key, v);
  } catch {
    /* ignore */
  }
}
function loadProgress(): ProgressMap {
  const raw = safeStorage.get(STORAGE_KEY_PROGRESS);
  if (!raw) return emptyProgress();
  try {
    const v = JSON.parse(raw);
    const out = emptyProgress();
    if (v && typeof v === "object") {
      for (const k of Object.keys(out) as WeeklyMissionType[]) {
        const n = (v as Record<string, unknown>)[k];
        if (typeof n === "number" && n >= 0) out[k] = Math.floor(n);
      }
    }
    return out;
  } catch {
    return emptyProgress();
  }
}
function saveProgress(p: ProgressMap): void {
  try {
    safeStorage.set(STORAGE_KEY_PROGRESS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
function loadClaimed(): Set<WeeklyMissionType> {
  const raw = safeStorage.get(STORAGE_KEY_CLAIMED);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return new Set(
        arr.filter((x) => typeof x === "string") as WeeklyMissionType[],
      );
    }
  } catch {
    /* ignore */
  }
  return new Set();
}
function saveClaimed(s: ReadonlySet<WeeklyMissionType>): void {
  try {
    safeStorage.set(STORAGE_KEY_CLAIMED, JSON.stringify(Array.from(s)));
  } catch {
    /* ignore */
  }
}
function loadBonus(): boolean {
  return safeStorage.get(STORAGE_KEY_BONUS) === "1";
}
function saveBonus(v: boolean): void {
  try {
    safeStorage.set(STORAGE_KEY_BONUS, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

interface BootResult {
  week: string;
  missions: readonly WeeklyMissionDef[];
  progress: ProgressMap;
  claimed: Set<WeeklyMissionType>;
  bonusClaimed: boolean;
}

function bootstrap(): BootResult {
  const thisWeek = weekKey();
  const persistedWeek = loadString(STORAGE_KEY_WEEK);
  if (persistedWeek !== thisWeek) {
    saveString(STORAGE_KEY_WEEK, thisWeek);
    saveProgress(emptyProgress());
    saveClaimed(new Set());
    saveBonus(false);
    // lastAttendDay 리셋 안 함 — KST day 비교에만 쓰임. 새 주에 다시
    // 출석 카운트 시작은 progress 만 0 으로 (lastAttendDay 가 이번 주
    // 첫 출석 시 cur day 로 갱신).
    return {
      week: thisWeek,
      missions: WEEKLY_MISSIONS,
      progress: emptyProgress(),
      claimed: new Set(),
      bonusClaimed: false,
    };
  }
  return {
    week: thisWeek,
    missions: WEEKLY_MISSIONS,
    progress: loadProgress(),
    claimed: loadClaimed(),
    bonusClaimed: loadBonus(),
  };
}

interface WeeklyMissionsState {
  week: string;
  missions: readonly WeeklyMissionDef[];
  progress: ProgressMap;
  claimed: ReadonlySet<WeeklyMissionType>;
  bonusClaimed: boolean;

  /**
   * 학습 세션 완료 시 호출. focusedMin >= 0 정수.
   *   - weeklyTotalFocusMin300 += focusedMin
   *   - 오늘이 이 주 첫 출석 KST 일자면 weeklyAttendDays5 += 1
   */
  recordFocusSession: (focusedMin: number) => void;

  /** Perfect combo 1회 — weeklyPerfectCombo5 += 1. */
  recordPerfectCombo: () => void;

  /** Claim. Return rewardP > 0 on success, 0 if not eligible or claimed. */
  claim: (type: WeeklyMissionType) => number;

  /**
   * Claim all-complete bonus when all 3 claimed. Returns
   * WEEKLY_ALL_COMPLETE_BONUS_P.
   */
  claimAllBonus: () => number;

  reset: () => void;
}

export const useWeeklyMissionsStore = create<WeeklyMissionsState>((set, get) => {
  const init = bootstrap();
  return {
    week: init.week,
    missions: init.missions,
    progress: init.progress,
    claimed: init.claimed,
    bonusClaimed: init.bonusClaimed,

    recordFocusSession: (focusedMin) => {
      if (!Number.isFinite(focusedMin) || focusedMin <= 0) return;
      // Week rollover check.
      const thisWeek = weekKey();
      if (get().week !== thisWeek) {
        const fresh = bootstrap();
        set({
          week: fresh.week,
          missions: fresh.missions,
          progress: fresh.progress,
          claimed: fresh.claimed,
          bonusClaimed: fresh.bonusClaimed,
        });
      }
      const next = { ...get().progress };
      // totalFocusMin300 — 누적 분.
      const totalCap = 300;
      next.weeklyTotalFocusMin300 = Math.min(
        totalCap,
        next.weeklyTotalFocusMin300 + Math.floor(focusedMin),
      );
      // attendance — 같은 KST 일자 두 번째 세션은 추가 출석 X.
      const today = kstDayKey();
      const lastAttend = loadString(STORAGE_KEY_LAST_ATTEND);
      if (lastAttend !== today) {
        saveString(STORAGE_KEY_LAST_ATTEND, today);
        next.weeklyAttendDays5 = Math.min(5, next.weeklyAttendDays5 + 1);
      }
      saveProgress(next);
      set({ progress: next });
    },

    recordPerfectCombo: () => {
      const thisWeek = weekKey();
      if (get().week !== thisWeek) {
        const fresh = bootstrap();
        set({
          week: fresh.week,
          missions: fresh.missions,
          progress: fresh.progress,
          claimed: fresh.claimed,
          bonusClaimed: fresh.bonusClaimed,
        });
      }
      const next = { ...get().progress };
      next.weeklyPerfectCombo5 = Math.min(5, next.weeklyPerfectCombo5 + 1);
      saveProgress(next);
      set({ progress: next });
    },

    claim: (type) => {
      const active = get().missions.find((m) => m.type === type);
      if (!active) return 0;
      if (get().claimed.has(type)) return 0;
      const cur = get().progress[type] ?? 0;
      if (cur < active.threshold) return 0;
      const nextSet = new Set(get().claimed);
      nextSet.add(type);
      saveClaimed(nextSet);
      set({ claimed: nextSet });
      return active.rewardP;
    },

    claimAllBonus: () => {
      if (get().bonusClaimed) return 0;
      const all = get().missions.every((m) => get().claimed.has(m.type));
      if (!all) return 0;
      saveBonus(true);
      set({ bonusClaimed: true });
      return WEEKLY_ALL_COMPLETE_BONUS_P;
    },

    reset: () => {
      safeStorage.remove(STORAGE_KEY_WEEK);
      safeStorage.remove(STORAGE_KEY_PROGRESS);
      safeStorage.remove(STORAGE_KEY_CLAIMED);
      safeStorage.remove(STORAGE_KEY_BONUS);
      safeStorage.remove(STORAGE_KEY_LAST_ATTEND);
      const fresh = bootstrap();
      set({
        week: fresh.week,
        missions: fresh.missions,
        progress: fresh.progress,
        claimed: fresh.claimed,
        bonusClaimed: fresh.bonusClaimed,
      });
    },
  };
});
