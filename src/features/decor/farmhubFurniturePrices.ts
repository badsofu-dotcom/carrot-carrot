/**
 * Farmhub 가구 step 별 당근 가격표 (R27 PHASE 2.A).
 *
 * R26 PHASE 2 의 "도감 N마리 자동 지급" 흐름 폐기 (R27 PHASE 2.E):
 *   [도감 N마리 unlock] → [구매 자격 해금] → [당근 N개로 구매]
 *
 * 가격 곡선 v1 — 선형 50 증가. 누적 1800 당근 (R27 1주차 풀세트 budget).
 * R28 analytics funnel 분석 후 곡선 조정 예정.
 */

export const FARMHUB_PRICES: Readonly<Record<number, number>> = Object.freeze({
  1: 50, // carpet
  2: 100, // bed
  3: 150, // table
  4: 200, // bookcase
  5: 250, // pot
  6: 300, // drawer
  7: 350, // storagebox
  8: 400, // stoolchair
});

export const FARMHUB_PRICE_TOTAL = 1800;

/**
 * step (1..8) → 당근 가격. 범위 밖이면 null.
 * Math.floor + 범위 체크로 NaN / 음수 / 9+ 모두 null 안전.
 */
export function getFurniturePrice(step: number): number | null {
  if (!Number.isFinite(step)) return null;
  const k = Math.floor(step);
  if (k < 1 || k > 8) return null;
  return FARMHUB_PRICES[k] ?? null;
}
