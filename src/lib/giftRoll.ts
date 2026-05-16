/**
 * Daily gift box roll — pure helper.
 *
 * Lives outside `rewardsStore` so it can be unit-tested under
 * `node --test` (zustand-free). The store imports `rollGift` from here.
 *
 * Roll table (KST-daily; the gate lives in `rewardsStore.claimDailyGift`):
 *   60 %  +1 seed
 *   24 %  +1 candy carrot   (+5 P)
 *    8 %  +1 golden carrot  (+10 P)
 *    6 %  +3 seeds
 *    2 %  +1 gem            (rare; spent via inventory: 5 gem → +1 seed)
 *
 * This frontend runtime table is intentionally separate from
 * `rewardTables.ts → DAILY_GIFT_TABLE` (which mirrors the worker table).
 * The two have always diverged on shape — preserved here so PR-7 doesn't
 * silently rebalance a sibling pool that the runtime never reads.
 */

export type GiftReward =
  | { kind: "seed"; amount: number }
  | { kind: "candy"; amount: number }
  | { kind: "golden"; amount: number }
  | { kind: "gem"; amount: number };

/**
 * Pure: roll a single gift outcome. Inject `rng` in tests.
 * Branches use cumulative thresholds so any `r ∈ [0, 1)` lands in
 * exactly one band.
 */
export function rollGift(rng: () => number = Math.random): GiftReward {
  const r = rng();
  if (r < 0.6) return { kind: "seed", amount: 1 };
  if (r < 0.84) return { kind: "candy", amount: 1 };
  if (r < 0.92) return { kind: "golden", amount: 1 };
  if (r < 0.98) return { kind: "seed", amount: 3 };
  return { kind: "gem", amount: 1 };
}
