/**
 * Streak store (R34 PR-204) — 일일 출석 연속 기록 + 보상.
 *
 * 사용자 목표: 30일 × 1-2h/day = 모든 가구 + 도감 완성. 일일 활성도
 * incentive 강화용. 매일 farm 첫 진입 시 자동 체크 + 미수령 시 보너스
 * carrot grant.
 *
 * 규칙:
 *   - KST 자정 기준 day key 사용.
 *   - 오늘 === lastClaimedDay: no-op (이미 수령).
 *   - 오늘 === yesterday + 1: streak++ (연속 유지).
 *   - 그 외 (1일 이상 결석): streak = 1 (재시작).
 *   - 보너스 carrot = 5 + min(streak - 1, 5) = 5 ~ 10 carrots/day.
 *     day 1: +5, day 2: +6, ..., day 6+: +10.
 *
 * 영속: localStorage `cc.streak.v1` { lastClaimedDay, streak, best }.
 * 광고 source 아니라 일일 cap 적용 (다른 source 와 동일).
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import { kstDayKey } from "../../lib/kst";

const STORAGE_KEY = "cc.streak.v1";

export const STREAK_BASE_REWARD = 5;
export const STREAK_MAX_REWARD = 10;

interface PersistShape {
  lastClaimedDay: string | null;
  streak: number;
  best: number;
}

interface ClaimResult {
  ok: boolean;
  reward: number;
  streak: number;
  /** 이전 streak (claim 직전). */
  prevStreak: number;
  alreadyClaimedToday: boolean;
}

export interface StreakState {
  lastClaimedDay: string | null;
  streak: number;
  best: number;

  /**
   * 오늘 첫 진입 시 호출. 이미 오늘 수령했으면 no-op + alreadyClaimedToday:true.
   * 그렇지 않으면 streak 갱신 + 보너스 carrot 정보 반환. caller (FarmHub)
   * 가 incCarrots(reward) + toast 처리.
   */
  claimDaily: () => ClaimResult;
  /** Dev / debug reset. */
  reset: () => void;
}

function load(): PersistShape {
  const blank: PersistShape = {
    lastClaimedDay: null,
    streak: 0,
    best: 0,
  };
  const raw = safeStorage.get(STORAGE_KEY);
  if (!raw) return blank;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return blank;
    const lastClaimedDay =
      typeof parsed.lastClaimedDay === "string" ? parsed.lastClaimedDay : null;
    const streak =
      typeof parsed.streak === "number" && parsed.streak >= 0
        ? Math.floor(parsed.streak)
        : 0;
    const best =
      typeof parsed.best === "number" && parsed.best >= 0
        ? Math.floor(parsed.best)
        : 0;
    return { lastClaimedDay, streak, best };
  } catch {
    return blank;
  }
}

function save(s: PersistShape): void {
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Pure helper — claim 결과 계산. 테스트용. */
export function computeNextStreak(
  today: string,
  lastClaimedDay: string | null,
  currentStreak: number,
): { nextStreak: number; alreadyClaimedToday: boolean } {
  if (lastClaimedDay === today) {
    return { nextStreak: currentStreak, alreadyClaimedToday: true };
  }
  if (lastClaimedDay === null) {
    return { nextStreak: 1, alreadyClaimedToday: false };
  }
  // yesterday check — YYYY-MM-DD 형식 비교.
  const last = new Date(`${lastClaimedDay}T00:00:00Z`);
  const cur = new Date(`${today}T00:00:00Z`);
  const diffDays = Math.round(
    (cur.getTime() - last.getTime()) / (24 * 3600 * 1000),
  );
  if (diffDays === 1) {
    return { nextStreak: currentStreak + 1, alreadyClaimedToday: false };
  }
  // 결석 (2일 이상) → streak reset.
  return { nextStreak: 1, alreadyClaimedToday: false };
}

/** Pure helper — streak 기반 보너스 carrot 수량. */
export function streakReward(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 0) return 0;
  const bonus = Math.min(streak - 1, STREAK_MAX_REWARD - STREAK_BASE_REWARD);
  return STREAK_BASE_REWARD + bonus;
}

export const useStreakStore = create<StreakState>((set, get) => {
  const init = load();
  return {
    lastClaimedDay: init.lastClaimedDay,
    streak: init.streak,
    best: init.best,

    claimDaily: () => {
      const cur = get();
      const today = kstDayKey();
      const { nextStreak, alreadyClaimedToday } = computeNextStreak(
        today,
        cur.lastClaimedDay,
        cur.streak,
      );
      if (alreadyClaimedToday) {
        return {
          ok: false,
          reward: 0,
          streak: cur.streak,
          prevStreak: cur.streak,
          alreadyClaimedToday: true,
        };
      }
      const reward = streakReward(nextStreak);
      const nextBest = Math.max(cur.best, nextStreak);
      const next: PersistShape = {
        lastClaimedDay: today,
        streak: nextStreak,
        best: nextBest,
      };
      set({
        lastClaimedDay: today,
        streak: nextStreak,
        best: nextBest,
      });
      save(next);
      return {
        ok: true,
        reward,
        streak: nextStreak,
        prevStreak: cur.streak,
        alreadyClaimedToday: false,
      };
    },

    reset: () => {
      const blank: PersistShape = {
        lastClaimedDay: null,
        streak: 0,
        best: 0,
      };
      set(blank);
      save(blank);
    },
  };
});
