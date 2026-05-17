/**
 * Daily gift box roll — pure helper.
 *
 * PR-109 — 씨앗 자원 폐기. seed 엔트리 모두 candy 로 흡수. EV 1.5 → 4.7 P.
 *
 * Roll table (KST-daily; the gate lives in `rewardsStore.claimDailyGift`):
 *   60 %  +1 candy carrot   (+5 P)
 *   24 %  +1 candy carrot   (+5 P)   (seed slot 흡수, 동일 reward)
 *    8 %  +1 golden carrot  (+10 P)
 *    6 %  +2 candy carrot   (+10 P)  (seed 3개 → candy 2개 흡수)
 *    2 %  +1 gem            (rare)
 */

export type GiftReward =
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
  if (r < 0.6) return { kind: "candy", amount: 1 };
  if (r < 0.84) return { kind: "candy", amount: 1 };
  if (r < 0.92) return { kind: "golden", amount: 1 };
  if (r < 0.98) return { kind: "candy", amount: 2 };
  return { kind: "gem", amount: 1 };
}
