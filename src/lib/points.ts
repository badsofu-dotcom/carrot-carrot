/**
 * Toss-points helpers — pure, no side effects.
 *
 * Conversion is intentionally simple and matches ECONOMY_DESIGN.md:
 *   carrot →  1 P
 *   candy  →  5 P
 *   golden → 10 P
 *
 * The server (worker `/economy` route) is the SoT for the pending
 * balance — the client mirrors what it has locally for instant UI
 * feedback, then reconciles on `/economy/balance` reads. This module
 * keeps the math out of the components so tests can verify the table
 * without a React renderer.
 */

export const POINT_VALUES = {
  carrot: 1,
  candy: 5,
  golden: 10,
} as const;

export type CarrotKind = keyof typeof POINT_VALUES;

/** Minimum pending balance the player can withdraw to Toss points. */
export const MIN_PAYOUT = 50;

export function pointsFor(kind: CarrotKind, count = 1): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return POINT_VALUES[kind] * Math.floor(count);
}

/**
 * Aggregate the player's three carrot counters into a pending point
 * total. Used by the header chip + the withdraw modal. Pure.
 */
export function totalPoints(inv: {
  carrots: number;
  candyCarrots: number;
  goldenCarrots: number;
}): number {
  return (
    pointsFor("carrot", inv.carrots) +
    pointsFor("candy", inv.candyCarrots) +
    pointsFor("golden", inv.goldenCarrots)
  );
}

export function canWithdraw(points: number): boolean {
  return Number.isFinite(points) && points >= MIN_PAYOUT;
}
