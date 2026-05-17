/**
 * Reward drop tables — shared between client and (future) worker.
 *
 * Two tables today:
 *   - `DAILY_GIFT_TABLE`     once-per-KST-day gift box
 *   - `WEEKLY_TREASURE_TABLE` weekly treasure chest (7 progress points → open)
 *
 * Each entry: { p: probability 0..1, kind, amount, points }
 *   - `p` values MUST sum to exactly 1.0 (validated in the test).
 *   - `points` is the Toss-points value at MIN_PAYOUT conversion
 *     (carrot=1P, candy=5P, golden=10P, stars/seeds local-only=0P).
 *
 * Helpers:
 *   - `expectedValuePoints(table)` returns the EV in P (test-asserts).
 *   - `rollTable(table, rng)` picks an entry deterministically given
 *     a uniform RNG; tests inject `() => 0.X` to exercise boundaries.
 */

// PR-109 — seed kind 제거 (씨앗 자원 폐기).
export type RewardKind =
  | "candy"     // 5 P
  | "golden"    // 10 P
  | "carrot"    // 1 P
  | "star"      // 0 P, used to buy legendary bunny
  | "gem"       // 0 P, future shop currency
  | "treasure_progress"; // 0 P, advances treasure chest

export interface TableEntry {
  p: number;
  kind: RewardKind;
  amount: number;
  /** Convenience cached value — keep in sync with kind/amount manually. */
  points: number;
}

/**
 * Daily gift table. PR-109 — 씨앗 자원 폐기. seed 엔트리 (0P) → candy
 * 로 흡수. EV 2.0 P → 4.7 P 상향 (사용자 가치 ↑).
 */
export const DAILY_GIFT_TABLE: readonly TableEntry[] = [
  { p: 0.6, kind: "candy", amount: 1, points: 5 },
  { p: 0.24, kind: "candy", amount: 1, points: 5 },
  { p: 0.08, kind: "golden", amount: 1, points: 10 },
  { p: 0.06, kind: "candy", amount: 2, points: 10 },
  { p: 0.02, kind: "gem", amount: 1, points: 0 },
];

/**
 * Weekly treasure table. Higher-value pool — opens after the player
 * accumulates 7 treasure_progress points. Sum 1.0.
 *
 * PR-109 — seed 엔트리 (0P) → carrot 5개 로 흡수.
 */
export const WEEKLY_TREASURE_TABLE: readonly TableEntry[] = [
  { p: 0.25, kind: "candy", amount: 2, points: 10 },
  { p: 0.2, kind: "golden", amount: 1, points: 10 },
  { p: 0.35, kind: "carrot", amount: 5, points: 5 },
  { p: 0.15, kind: "star", amount: 3, points: 0 },
  { p: 0.05, kind: "golden", amount: 3, points: 30 },
];

/** Sum of `p` values — should be 1.0 within float tolerance. */
export function tableSum(t: readonly TableEntry[]): number {
  return t.reduce((s, e) => s + e.p, 0);
}

/** Expected points value per single roll. */
export function expectedValuePoints(t: readonly TableEntry[]): number {
  return t.reduce((s, e) => s + e.p * e.points, 0);
}

/** Pure RNG roll. Returns the first entry whose cumulative-p covers r. */
export function rollTable(
  t: readonly TableEntry[],
  rng: () => number = Math.random,
): TableEntry {
  const r = Math.max(0, Math.min(1, rng()));
  let acc = 0;
  for (const e of t) {
    acc += e.p;
    if (r < acc) return e;
  }
  return t[t.length - 1]!;
}
