/**
 * Phase 5 — local-first stats + 도감 store.
 *
 * 책임:
 *  - 누적 당근 / 연속일 / 집중분 / dailyHistory / ownedCharacters / firstFiftyDone 보관.
 *  - 타이머 완료/포기 결과를 받아 stats 업데이트 + unlock 평가.
 *  - safeStorage 로 persist (cc.collection.v1).
 *
 * Phase 3 userStore 와 충돌 없도록:
 *  - userStore.stats 는 "서버에서 받은 통계" — 로그인된 사용자만 의미가 있음.
 *  - collectionStore.stats 는 "로컬 디바이스에서의 실측" — 항상 동작.
 *  - Home/Report 는 collectionStore 를 우선시하되, 비어있으면 userStore.stats fallback.
 */

import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { safeStorage } from "../../lib/safeStorage";
import {
  CHARACTERS,
  CHARACTER_BY_ID,
  type CharacterDef,
  type DailyEntry,
  type Rarity,
  todayLocal,
  yesterdayLocal,
} from "./collectionData";

const STORAGE_KEY = "cc.collection.v1";
const HISTORY_LIMIT = 60; // 최근 60일만 보존

interface PersistShape {
  totalCarrots: number;
  totalFocusMinutes: number;
  longestFocusMinutes: number;
  streakDays: number;
  /** YYYY-MM-DD — 마지막으로 당근을 한 개라도 잡은 날. streak 계산에 사용. */
  lastFocusDate: string | null;
  /** 첫 50분 세션을 완료했는지 — SR 마법사 unlock. */
  firstFiftyDone: boolean;
  /** unlock 된 캐릭터 id 리스트. */
  ownedCharacters: string[];
  /** 캐릭터별 획득일 YYYY-MM-DD. */
  ownedAt: Record<string, string>;
  /** 최근 N일 history — 차트용. */
  dailyHistory: DailyEntry[];
}

const EMPTY: PersistShape = {
  totalCarrots: 0,
  totalFocusMinutes: 0,
  longestFocusMinutes: 0,
  streakDays: 0,
  lastFocusDate: null,
  firstFiftyDone: false,
  ownedCharacters: [],
  ownedAt: {},
  dailyHistory: [],
};

function loadPersist(): PersistShape {
  try {
    const raw = safeStorage.get(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    return {
      ...EMPTY,
      ...parsed,
      ownedCharacters: parsed.ownedCharacters ?? [],
      ownedAt: parsed.ownedAt ?? {},
      dailyHistory: parsed.dailyHistory ?? [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function savePersist(p: PersistShape) {
  try {
    safeStorage.set(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export interface SessionResult {
  /** 사용자가 선택한 preset (분). */
  presetMin: number;
  /** 실제 집중에 사용된 ms. */
  focusedMs: number;
  /** "complete" | "abandon". */
  type: "complete" | "abandon";
}

interface CollectionState extends PersistShape {
  /** session 결과 반영 — 당근 +1 (complete 한정), stats / streak / firstFifty 갱신.
   *  새로 unlock 된 캐릭터 id 배열을 반환. */
  applySession: (r: SessionResult) => string[];
  /** 단순 포기 기록 — 당근은 안 늘지만 cry 토끼 unlock 트리거. */
  applyAbandon: () => string[];
  /** dev 용 — 모든 데이터 wipe. */
  resetAll: () => void;
  /** dev 용 — 강제 owned 추가 후 unlock id 반환. */
  forceUnlock: (id: string) => string | null;
  /** /bunnies/collection 응답을 로컬 ownedCharacters 와 union. 새로 추가된 id 만 반환. */
  hydrateBunniesFromRemote: (ids: readonly string[]) => string[];
}

/** 두 YYYY-MM-DD 가 연속된 날인지. (b 가 a+1일?) */
function isNextDay(a: string | null, b: string): boolean {
  if (!a) return false;
  const d = new Date(a + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}` === b;
}

function pushHistory(history: DailyEntry[], date: string, carrots: number, focusMin: number): DailyEntry[] {
  const idx = history.findIndex((h) => h.date === date);
  if (idx >= 0) {
    const next = [...history];
    next[idx] = {
      date,
      carrots: next[idx].carrots + carrots,
      focusMinutes: next[idx].focusMinutes + focusMin,
    };
    return next.slice(-HISTORY_LIMIT);
  }
  return [...history, { date, carrots, focusMinutes: focusMin }].slice(-HISTORY_LIMIT);
}

/** unlock 평가 — 현재 stats 기반으로 새로 owned 가 되어야 할 캐릭터 id 반환.
 *  이미 ownedCharacters 에 있는 건 제외. */
export function computeNewUnlocks(
  stats: PersistShape,
  /** 이번 세션이 abandon 이었는지 — cry 토끼 unlock. */
  ctx: { abandonedThisSession?: boolean; nightTime?: boolean } = {},
): CharacterDef[] {
  const owned = new Set(stats.ownedCharacters);
  const unlocked: CharacterDef[] = [];
  for (const c of CHARACTERS) {
    if (owned.has(c.id)) continue;
    let pass = false;
    switch (c.unlockKind) {
      case "carrots-cumulative":
        pass = stats.totalCarrots >= (c.threshold ?? 1);
        break;
      case "streak-days":
        pass = stats.streakDays >= (c.threshold ?? 1);
        break;
      case "first-50min":
        pass = stats.firstFiftyDone;
        break;
      case "manual":
        // 수동 — cry 는 abandon 이후, sleep 은 야간 첫 만남 한정.
        if (c.id === "cry") pass = !!ctx.abandonedThisSession;
        else if (c.id === "sleep") pass = !!ctx.nightTime;
        else pass = false;
        break;
    }
    if (pass) unlocked.push(c);
  }
  return unlocked;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  ...loadPersist(),

  applySession: (r) => {
    const s = get();
    if (r.type !== "complete") {
      // abandon 은 별도 메서드
      return [];
    }
    const today = todayLocal();
    const focusMin = Math.round(r.focusedMs / 60000);

    // streak 계산: 오늘 이미 잡았으면 그대로, 어제였으면 +1, 그보다 오래면 1로 리셋.
    let nextStreak = s.streakDays;
    if (s.lastFocusDate === today) {
      // 오늘 안에서 한 번 더 — streak 증가 X
    } else if (s.lastFocusDate === null) {
      nextStreak = 1;
    } else if (isNextDay(s.lastFocusDate, today)) {
      nextStreak = s.streakDays + 1;
    } else if (s.lastFocusDate === yesterdayLocal()) {
      // 안전장치 — isNextDay 가 어떤 이유로 실패했을 때.
      nextStreak = s.streakDays + 1;
    } else {
      nextStreak = 1;
    }

    const nextStats: PersistShape = {
      ...s,
      totalCarrots: s.totalCarrots + 1,
      totalFocusMinutes: s.totalFocusMinutes + focusMin,
      longestFocusMinutes: Math.max(s.longestFocusMinutes, focusMin),
      streakDays: nextStreak,
      lastFocusDate: today,
      firstFiftyDone: s.firstFiftyDone || r.presetMin >= 50,
      dailyHistory: pushHistory(s.dailyHistory, today, 1, focusMin),
    };

    // unlock 평가
    const hour = new Date().getHours();
    const newUnlocks = computeNewUnlocks(nextStats, {
      nightTime: hour >= 22 || hour < 6,
    });
    if (newUnlocks.length) {
      const ownedAt = { ...nextStats.ownedAt };
      for (const c of newUnlocks) ownedAt[c.id] = today;
      nextStats.ownedCharacters = [
        ...nextStats.ownedCharacters,
        ...newUnlocks.map((c) => c.id),
      ];
      nextStats.ownedAt = ownedAt;
    }

    set(nextStats);
    savePersist(nextStats);
    return newUnlocks.map((c) => c.id);
  },

  applyAbandon: () => {
    const s = get();
    const today = todayLocal();
    const nextStats: PersistShape = { ...s };
    const newUnlocks = computeNewUnlocks(nextStats, {
      abandonedThisSession: true,
    });
    if (!newUnlocks.length) return [];
    const ownedAt = { ...nextStats.ownedAt };
    for (const c of newUnlocks) ownedAt[c.id] = today;
    nextStats.ownedCharacters = [
      ...nextStats.ownedCharacters,
      ...newUnlocks.map((c) => c.id),
    ];
    nextStats.ownedAt = ownedAt;
    set(nextStats);
    savePersist(nextStats);
    return newUnlocks.map((c) => c.id);
  },

  resetAll: () => {
    const blank: PersistShape = { ...EMPTY };
    set(blank);
    savePersist(blank);
  },

  forceUnlock: (id) => {
    const s = get();
    if (s.ownedCharacters.includes(id)) return null;
    const c = CHARACTER_BY_ID[id];
    if (!c) return null;
    const today = todayLocal();
    const next: PersistShape = {
      ...s,
      ownedCharacters: [...s.ownedCharacters, id],
      ownedAt: { ...s.ownedAt, [id]: today },
    };
    set(next);
    savePersist(next);
    return id;
  },

  hydrateBunniesFromRemote: (ids) => {
    const s = get();
    const ownedSet = new Set(s.ownedCharacters);
    const added: string[] = [];
    const nextOwnedAt = { ...s.ownedAt };
    const today = todayLocal();
    for (const id of ids) {
      if (typeof id !== "string" || ownedSet.has(id)) continue;
      // Only hydrate ids the client knows about; an unknown bunny id
      // from the server is recorded for analytics but ignored locally.
      if (!CHARACTER_BY_ID[id]) continue;
      ownedSet.add(id);
      added.push(id);
      if (!nextOwnedAt[id]) nextOwnedAt[id] = today;
    }
    if (added.length === 0) return [];
    const next: PersistShape = {
      ...s,
      ownedCharacters: Array.from(ownedSet),
      ownedAt: nextOwnedAt,
    };
    set(next);
    savePersist(next);
    return added;
  },
}));

/** 가벼운 셀렉터들 — Home/Report/Collection 에서 사용. */
export function useTotalCarrots(): number {
  return useCollectionStore((s) => s.totalCarrots);
}

export function useStreakDays(): number {
  return useCollectionStore((s) => s.streakDays);
}

export function useOwnedCount(): number {
  return useCollectionStore((s) => s.ownedCharacters.length);
}

export function useTodayCarrots(): number {
  return useCollectionStore((s) => {
    const today = todayLocal();
    const entry = s.dailyHistory.find((h) => h.date === today);
    return entry?.carrots ?? 0;
  });
}

export function useTodayFocusMinutes(): number {
  return useCollectionStore((s) => {
    const today = todayLocal();
    const entry = s.dailyHistory.find((h) => h.date === today);
    return entry?.focusMinutes ?? 0;
  });
}

/** 최근 7일 히스토리 — 빈 날짜는 0 으로 채워서 항상 7개 반환.
 *  dailyHistory 가 변하지 않으면 같은 참조를 반환 (useMemo). */
export function useWeek7History(): { date: string; weekday: string; carrots: number; focusMinutes: number }[] {
  const dailyHistory = useCollectionStore((s) => s.dailyHistory);
  return useMemo(() => {
    const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
    const out: { date: string; weekday: string; carrots: number; focusMinutes: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dd}`;
      const entry = dailyHistory.find((h) => h.date === dateStr);
      out.push({
        date: dateStr,
        weekday: WEEKDAYS[d.getDay()],
        carrots: entry?.carrots ?? 0,
        focusMinutes: entry?.focusMinutes ?? 0,
      });
    }
    return out;
  }, [dailyHistory]);
}

/** 캐릭터별 owned 정보 (없으면 null). */
export function useOwnedInfo(id: string): { ownedAt: string } | null {
  return useCollectionStore(
    useShallow((s) => {
      if (!s.ownedCharacters.includes(id)) return null;
      return { ownedAt: s.ownedAt[id] ?? "—" };
    }),
  );
}

/** 모든 보유 캐릭터 (rarity 별 카운트용). dailyHistory 처럼 list 자체가 안 바뀌면 같은 ref. */
export function useOwnedSet(): Set<string> {
  const ownedCharacters = useCollectionStore((s) => s.ownedCharacters);
  return useMemo(() => new Set(ownedCharacters), [ownedCharacters]);
}

/** 최근 30일 누적 집중 시간 (분). 데이터가 부족하면 user stats 기반 seed 로 채움.
 *  반환값은 length === 30, 마지막 원소가 오늘의 누적값.
 *  매 호출마다 같은 입력에 같은 출력 (useMemo).
 */
export function useCumulativeFocus30d(): { date: string; cumulative: number; daily: number }[] {
  const dailyHistory = useCollectionStore((s) => s.dailyHistory);
  const totalFocusMinutes = useCollectionStore((s) => s.totalFocusMinutes);
  return useMemo(() => {
    // 1) 최근 30일 일별 분 추출
    const dailyMap = new Map<string, number>();
    for (const h of dailyHistory) dailyMap.set(h.date, h.focusMinutes);

    const today = new Date();
    const days: { date: string; daily: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dd}`;
      days.push({ date: dateStr, daily: dailyMap.get(dateStr) ?? 0 });
    }

    const realSum = days.reduce((s, d) => s + d.daily, 0);

    // 2) 데이터가 부족하면 (5일 미만) seed-like 값으로 채워 totalFocusMinutes 와 일관되게.
    //    사인파 + 약간의 랜덤 — 결정적 (date 기반 해시) 으로.
    if (realSum < 30 && totalFocusMinutes > 0) {
      // 30일 가상 분포로 totalFocusMinutes 를 펼치되 끝쪽이 더 짙도록.
      const target = Math.max(totalFocusMinutes, 30);
      const weights = days.map((_, i) => {
        // 주기적 변동 + 우상향
        const base = 0.6 + (i / 29) * 0.6;
        const wave = 0.18 * Math.sin(i / 2.3) + 0.10 * Math.cos(i / 1.7);
        return Math.max(0.05, base + wave);
      });
      const wSum = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < days.length; i++) {
        if (days[i].daily === 0) {
          days[i].daily = Math.round((weights[i] / wSum) * target);
        }
      }
    }

    let cum = 0;
    return days.map((d) => {
      cum += d.daily;
      return { date: d.date, daily: d.daily, cumulative: cum };
    });
  }, [dailyHistory, totalFocusMinutes]);
}

/** rarity 별 보유 카운트. */
export function useOwnedByRarity(): Record<Rarity, number> {
  const ownedCharacters = useCollectionStore((s) => s.ownedCharacters);
  return useMemo(() => {
    const out: Record<Rarity, number> = { common: 0, rare: 0, sr: 0, ssr: 0, legendary: 0 };
    for (const id of ownedCharacters) {
      const c = CHARACTER_BY_ID[id];
      if (c) out[c.rarity] += 1;
    }
    return out;
  }, [ownedCharacters]);
}
