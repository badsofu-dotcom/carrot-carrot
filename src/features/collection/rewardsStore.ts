/**
 * Rewards store — milestones (medal badges) and the once-per-day gift
 * box claim. Pure local state; persists via `safeStorage` so the claim
 * survives a tab reload but not a fresh-device install. The worker
 * (`/economy`) is the canonical source of truth for *points* — this
 * store just tracks the cosmetic claim flags + the gift-box roll
 * results so the UI can render badges and "이미 받음" states.
 *
 * The daily-gift roll table itself lives in `src/lib/giftRoll.ts` so
 * it can be unit-tested standalone.
 *
 * Milestones are deterministic from the farmStore stats and the focus
 * snapshot stream — see `evaluateMilestones()` for the trigger logic.
 */
import { create } from "zustand";
import { safeStorage } from "../../lib/safeStorage";
import { rollGift, type GiftReward } from "../../lib/giftRoll";
import {
  WEEKLY_TREASURE_TABLE,
  rollTable,
  type TableEntry,
} from "../../lib/rewardTables";

export type { GiftReward };

export const WEEKLY_TREASURE_GOAL = 7;

export type MedalId =
  | "first_harvest"
  | "five_carrots"
  | "first_session"
  | "perfect_combo"
  | "first_candy"
  | "first_golden"
  /** Dogam progress: 25 / 50 / 75 / 100. */
  | "dogam_25"
  | "dogam_50"
  | "dogam_75"
  | "dogam_100"
  /** Sky-view 누적 5분 이상. */
  | "quiet_sky";

interface Milestone {
  id: MedalId;
  label: string;
  unlocked: boolean;
}

interface RewardsState {
  /** KST day key for which the gift box was claimed (`YYYY-MM-DD`). */
  giftClaimedDay: string | null;
  /** Result of the most recent claim, for the claim modal. */
  lastGiftReward: GiftReward | null;
  /** Medal IDs unlocked so far. */
  medals: ReadonlySet<MedalId>;
  /** Treasure-chest progress 0..7 (PR-17b). Reset to 0 on open. */
  treasureProgress: number;
  /** Last treasure roll result (for the claim banner). */
  lastTreasureReward: TableEntry | null;
  /** PR-49 — KST 22-06 시간대 집중 세션 누적 카운터 (lifetime).
   *  7회 도달 시 `quiet_sky` 메달 unlock. */
  nightSessions: number;

  /** Returns the gift reward if a claim succeeded; null when already claimed. */
  claimDailyGift: (rng?: () => number) => GiftReward | null;
  /** Unlock a medal idempotently. Returns true if newly unlocked. */
  unlockMedal: (id: MedalId) => boolean;
  /** PR-49 — unlock 11 모든 메달 (DEV cheat). 신규 unlock 개수 반환. */
  unlockAllMedals: () => number;
  /** PR-49 — 야간 집중 세션 +1, 누적 카운트 반환. quiet_sky 임계 7. */
  bumpNightSession: () => number;
  /** Add N progress to the weekly treasure chest. Capped at GOAL. */
  addTreasureProgress: (n?: number) => void;
  /** Open the treasure chest. Returns the rolled reward, or null when
   *  progress < GOAL. Caller is responsible for granting the reward
   *  into farmStore / itemsStore. */
  openTreasureChest: (rng?: () => number) => TableEntry | null;
  /** DEV — clear the daily gift claim flag so "오늘의 선물" reopens. */
  resetDailyGiftClaim: () => void;
  /** Reset for tests / data-wipe. */
  reset: () => void;
}

const STORAGE_KEY_DAY = "cc.rewards.giftDay.v1";
const STORAGE_KEY_MEDALS = "cc.rewards.medals.v1";
const STORAGE_KEY_TREASURE = "cc.rewards.treasureProgress.v1";
// PR-49 — quiet_sky "밤의 숲지기" 트리거. KST 22-06 시간대 집중 누적 카운터.
const STORAGE_KEY_NIGHT_SESSIONS = "cc.rewards.nightSessions.v1";

function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const VALID_MEDAL_IDS = new Set<MedalId>([
  "first_harvest",
  "five_carrots",
  "first_session",
  "perfect_combo",
  "first_candy",
  "first_golden",
  "dogam_25",
  "dogam_50",
  "dogam_75",
  "dogam_100",
  "quiet_sky",
]);

function loadMedals(): Set<MedalId> {
  const raw = safeStorage.get(STORAGE_KEY_MEDALS);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const out = new Set<MedalId>();
      for (const v of arr) {
        if (typeof v === "string" && VALID_MEDAL_IDS.has(v as MedalId)) {
          out.add(v as MedalId);
        }
      }
      return out;
    }
  } catch {
    /* corrupted — reset */
  }
  return new Set();
}

function saveMedals(medals: ReadonlySet<MedalId>) {
  safeStorage.set(STORAGE_KEY_MEDALS, JSON.stringify(Array.from(medals)));
}

function loadTreasureProgress(): number {
  const raw = safeStorage.get(STORAGE_KEY_TREASURE);
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(WEEKLY_TREASURE_GOAL, Math.round(n)));
}
function saveTreasureProgress(n: number) {
  try {
    safeStorage.set(STORAGE_KEY_TREASURE, String(n));
  } catch {
    /* ignore */
  }
}

function loadNightSessions(): number {
  const raw = safeStorage.get(STORAGE_KEY_NIGHT_SESSIONS);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
function saveNightSessions(n: number) {
  try {
    safeStorage.set(STORAGE_KEY_NIGHT_SESSIONS, String(n));
  } catch {
    /* ignore */
  }
}

const ALL_MEDAL_IDS: readonly MedalId[] = [
  "first_harvest",
  "five_carrots",
  "first_session",
  "perfect_combo",
  "first_candy",
  "first_golden",
  "dogam_25",
  "dogam_50",
  "dogam_75",
  "dogam_100",
  "quiet_sky",
];

export { rollGift };

export const MEDAL_LABELS: Record<MedalId, string> = {
  first_harvest: "첫 수확",
  five_carrots: "당근 5개",
  first_session: "첫 집중",
  perfect_combo: "퍼펙트 콤보",
  first_candy: "캔디 당근",
  first_golden: "황금 당근",
  dogam_25: "도감 25",
  dogam_50: "도감 50",
  dogam_75: "도감 75",
  dogam_100: "도감 100",
  quiet_sky: "조용한 시간",
};

export const useRewardsStore = create<RewardsState>((set, get) => ({
  giftClaimedDay: safeStorage.get(STORAGE_KEY_DAY),
  lastGiftReward: null,
  medals: loadMedals(),
  treasureProgress: loadTreasureProgress(),
  lastTreasureReward: null,
  nightSessions: loadNightSessions(),

  claimDailyGift: (rng = Math.random) => {
    const today = kstDayKey();
    if (get().giftClaimedDay === today) return null;
    const reward = rollGift(rng);
    safeStorage.set(STORAGE_KEY_DAY, today);
    set({ giftClaimedDay: today, lastGiftReward: reward });
    return reward;
  },

  unlockMedal: (id) => {
    const s = get();
    if (s.medals.has(id)) return false;
    const next = new Set(s.medals);
    next.add(id);
    saveMedals(next);
    set({ medals: next });
    // PR-13: dispatch cc:medal:unlocked so listeners (CollectionPage) can
    // play sfx_levelup / sfx_combo without coupling the store to React
    // audio. SSR / non-browser: silent.
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("cc:medal:unlocked", { detail: { id } }),
        );
      }
    } catch {
      /* ignore */
    }
    return true;
  },

  unlockAllMedals: () => {
    const cur = get().medals;
    let unlocked = 0;
    const next = new Set(cur);
    for (const id of ALL_MEDAL_IDS) {
      if (!next.has(id)) {
        next.add(id);
        unlocked++;
      }
    }
    if (unlocked > 0) {
      saveMedals(next);
      set({ medals: next });
      // Fire event for each newly unlocked id — SFX listener consistency.
      try {
        if (typeof window !== "undefined") {
          for (const id of ALL_MEDAL_IDS) {
            if (cur.has(id)) continue;
            window.dispatchEvent(
              new CustomEvent("cc:medal:unlocked", { detail: { id } }),
            );
          }
        }
      } catch {
        /* ignore */
      }
    }
    return unlocked;
  },

  bumpNightSession: () => {
    const next = get().nightSessions + 1;
    saveNightSessions(next);
    set({ nightSessions: next });
    return next;
  },

  addTreasureProgress: (n = 1) => {
    const inc = Math.max(0, Math.floor(n));
    if (inc === 0) return;
    const next = Math.min(WEEKLY_TREASURE_GOAL, get().treasureProgress + inc);
    saveTreasureProgress(next);
    set({ treasureProgress: next });
  },

  resetDailyGiftClaim: () => {
    safeStorage.remove(STORAGE_KEY_DAY);
    set({ giftClaimedDay: null, lastGiftReward: null });
  },

  openTreasureChest: (rng = Math.random) => {
    if (get().treasureProgress < WEEKLY_TREASURE_GOAL) return null;
    const reward = rollTable(WEEKLY_TREASURE_TABLE, rng);
    saveTreasureProgress(0);
    set({ treasureProgress: 0, lastTreasureReward: reward });
    return reward;
  },

  reset: () => {
    safeStorage.remove(STORAGE_KEY_DAY);
    safeStorage.remove(STORAGE_KEY_MEDALS);
    safeStorage.remove(STORAGE_KEY_TREASURE);
    safeStorage.remove(STORAGE_KEY_NIGHT_SESSIONS);
    set({
      giftClaimedDay: null,
      lastGiftReward: null,
      medals: new Set(),
      treasureProgress: 0,
      lastTreasureReward: null,
      nightSessions: 0,
    });
  },
}));

export function medalsCatalog(): readonly Milestone[] {
  return (Object.keys(MEDAL_LABELS) as MedalId[]).map((id) => ({
    id,
    label: MEDAL_LABELS[id],
    unlocked: false,
  }));
}
