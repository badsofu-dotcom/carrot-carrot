import { create } from "zustand";
import type { TossUser } from "../lib/toss";
import type { AuthMode } from "../services/authService";
import { todayStats } from "../lib/mockData";

/**
 * Phase 3 userStore.
 *  - auth 정보 + 서버에서 가져온 누적 stats 캐시.
 *  - 서버 실패 시 stats 는 mock fallback 유지 (UI 가 빈약해 보이지 않게).
 */

export interface UserStats {
  totalCarrots: number;
  totalFocusMinutes: number;
  streakDays: number;
  longestFocusMinutes: number;
}

const FALLBACK_STATS: UserStats = {
  totalCarrots: todayStats.carrots, // 임시 — 1일치만이지만 빈값보단 낫다
  totalFocusMinutes: todayStats.focusMinutes,
  streakDays: todayStats.streakDays,
  longestFocusMinutes: todayStats.longestFocusMinutes,
};

interface UserState {
  user: TossUser | null;
  mode: AuthMode;
  hint: string;
  loading: boolean;
  stats: UserStats;
  /** 서버에서 stats 를 받아왔는지. false 면 mock 사용 중. */
  statsFromServer: boolean;
  setUser: (user: TossUser | null) => void;
  setAuth: (a: { user: TossUser | null; mode: AuthMode; hint: string }) => void;
  setStats: (s: UserStats, fromServer: boolean) => void;
  setLoading: (v: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  mode: "loading",
  hint: "확인 중...",
  loading: true,
  stats: FALLBACK_STATS,
  statsFromServer: false,
  setUser: (user) => set({ user }),
  setAuth: ({ user, mode, hint }) => set({ user, mode, hint }),
  setStats: (stats, statsFromServer) => set({ stats, statsFromServer }),
  setLoading: (loading) => set({ loading }),
}));
