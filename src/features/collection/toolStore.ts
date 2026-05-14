/**
 * Tool state — actively-selected tool plus the watering-can daily charges.
 *
 * Watering can:
 *   - 10 charges per KST day.
 *   - Each watering decrements by 1.
 *   - Up to 3 ad-refill bursts per day, +3 charges each.
 *   - Auto-reset at the next KST midnight on access.
 *
 * Reset bookkeeping uses the KST day key (`YYYY-MM-DD`) so a session
 * that crosses midnight still picks up a fresh quota the next time the
 * store is read. The user's local TZ is irrelevant — the gameplay
 * model is KST-anchored.
 *
 * The store is session-local. When migration 0005 lands and the user is
 * logged in, the worker becomes the SoT and pre-hydrates via
 * `loadFromRemote()`. For preview / guest mode the store is purely
 * client-side and that's fine — the rest of the farm already works
 * the same way.
 */
import { create } from "zustand";

export type ToolId = "shovel" | "watering_can" | "basket";

const MAX_DAILY = 10;
const MAX_AD_REFILLS = 3;
const AD_REFILL_AMOUNT = 3;

/** YYYY-MM-DD in KST. Used as the daily-reset key. */
function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface ToolState {
  /** null = no tool selected; clicks fall back to default plant/harvest. */
  selected: ToolId | null;
  /** Charges left for the watering can today (0..10). */
  wateringCanLeft: number;
  /** Ad refills used today (0..3). */
  adRefillsToday: number;
  /** Day key the above counters are anchored to. */
  dayKey: string;

  select: (id: ToolId | null) => void;
  /**
   * Try to spend 1 watering charge. Returns true on success.
   * Auto-rolls the day boundary if `dayKey` is stale.
   */
  spendWatering: () => boolean;
  /**
   * Apply one ad refill (+3 charges, max MAX_DAILY, increments
   * `adRefillsToday`). Returns true on success.
   */
  refillFromAd: () => boolean;
  /** Force the daily-reset check (idempotent). */
  rolloverIfNeeded: () => void;
  /** Replace state from a server snapshot (back-compat optional). */
  hydrateFromRemote: (snap: {
    watering_can_left: number;
    ad_refills_today: number;
    /** ISO day key the snapshot is anchored to, KST. */
    day_key?: string;
  }) => void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  selected: null,
  wateringCanLeft: MAX_DAILY,
  adRefillsToday: 0,
  dayKey: kstDayKey(),

  select: (id) => set({ selected: id }),

  rolloverIfNeeded: () => {
    const today = kstDayKey();
    if (today !== get().dayKey) {
      set({
        dayKey: today,
        wateringCanLeft: MAX_DAILY,
        adRefillsToday: 0,
      });
    }
  },

  spendWatering: () => {
    get().rolloverIfNeeded();
    const s = get();
    if (s.wateringCanLeft <= 0) return false;
    set({ wateringCanLeft: s.wateringCanLeft - 1 });
    return true;
  },

  refillFromAd: () => {
    get().rolloverIfNeeded();
    const s = get();
    if (s.adRefillsToday >= MAX_AD_REFILLS) return false;
    const next = Math.min(MAX_DAILY, s.wateringCanLeft + AD_REFILL_AMOUNT);
    set({
      wateringCanLeft: next,
      adRefillsToday: s.adRefillsToday + 1,
    });
    return true;
  },

  hydrateFromRemote: (snap) => {
    const today = kstDayKey();
    set({
      wateringCanLeft: Math.max(
        0,
        Math.min(MAX_DAILY, snap.watering_can_left ?? MAX_DAILY),
      ),
      adRefillsToday: Math.max(
        0,
        Math.min(MAX_AD_REFILLS, snap.ad_refills_today ?? 0),
      ),
      // Trust the server's day key if provided; otherwise our own today
      // is fine. A drift between client clock and KST midnight resolves
      // on the next call via rolloverIfNeeded().
      dayKey: snap.day_key ?? today,
    });
  },
}));

export const TOOL_CONSTANTS = {
  MAX_DAILY,
  MAX_AD_REFILLS,
  AD_REFILL_AMOUNT,
};
