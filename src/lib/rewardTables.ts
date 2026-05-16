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

export type RewardKind =
  | "seed"      // 0 P, local-only farm seeds
  | "candy"     // 5 P
  | "golden"    // 10 P
  | "carrot"    // 1 P
  | "star"      // 0 P, used to buy legendary bunny
  | "gem"       // 0 P, future shop currency (PR-7)
  | "treasure_progress"; // 0 P, advances treasure chest

export interface TableEntry {
  p: number;
  kind: RewardKind;
  amount: number;
  /** Convenience cached value — keep in sync with kind/amount manually. */
  points: number;
}

/**
 * Daily gift table. EV 2.0 P after PR-17c alignment.
 *
 * Mirrors `src/lib/giftRoll.ts → rollGift` band by band so the
 * doc-table (this) and the runtime roll function agree. The worker
 * `cloudflare/.../routes/boxes.ts → DAILY` is updated in lock-step.
 */
export const DAILY_GIFT_TABLE: readonly TableEntry[] = [
  { p: 0.6, kind: "seed", amount: 1, points: 0 },
  { p: 0.24, kind: "candy", amount: 1, points: 5 },
  { p: 0.08, kind: "golden", amount: 1, points: 10 },
  { p: 0.06, kind: "seed", amount: 3, points: 0 },
  { p: 0.02, kind: "gem", amount: 1, points: 0 },
];

/**
 * Weekly treasure table. Higher-value pool — opens after the player
 * accumulates 7 treasure_progress points. Sum 1.0.
 */
export const WEEKLY_TREASURE_TABLE: readonly TableEntry[] = [
  { p: 0.25, kind: "candy", amount: 2, points: 10 },
  { p: 0.2, kind: "golden", amount: 1, points: 10 },
  { p: 0.2, kind: "carrot", amount: 5, points: 5 },
  { p: 0.15, kind: "seed", amount: 3, points: 0 },
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
