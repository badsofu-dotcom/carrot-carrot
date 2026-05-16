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

export type { GiftReward };

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

  /** Returns the gift reward if a claim succeeded; null when already claimed. */
  claimDailyGift: (rng?: () => number) => GiftReward | null;
  /** Unlock a medal idempotently. Returns true if newly unlocked. */
  unlockMedal: (id: MedalId) => boolean;
  /** Reset for tests / data-wipe. */
  reset: () => void;
}

const STORAGE_KEY_DAY = "cc.rewards.giftDay.v1";
const STORAGE_KEY_MEDALS = "cc.rewards.medals.v1";

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
    return true;
  },

  reset: () => {
    safeStorage.remove(STORAGE_KEY_DAY);
    safeStorage.remove(STORAGE_KEY_MEDALS);
    set({ giftClaimedDay: null, lastGiftReward: null, medals: new Set() });
  },
}));

export function medalsCatalog(): readonly Milestone[] {
  return (Object.keys(MEDAL_LABELS) as MedalId[]).map((id) => ({
    id,
    label: MEDAL_LABELS[id],
    unlocked: false,
  }));
}
