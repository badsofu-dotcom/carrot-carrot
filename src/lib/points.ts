/**
 * Toss-points helpers — pure, no side effects.
 *
 * Conversion is intentionally simple and matches ECONOMY_DESIGN.md:
 *   carrot →  1 P
 *   candy  →  5 P
 *   golden → 10 P
 *
 * R32 (2026-05-18) status — 토스포인트 환산은 **dormant** (RewardsPanel
 * 의 출금 진입점 제거 + 워커 시크릿 미등록). 본 모듈의 표값
 * (`POINT_VALUES`) 은 그대로 유지되어 다음 용도로 활용:
 *
 *   1. **자원 간 상대 가치 단위 (in-app value unit)** — 일일 자원 캡
 *      (`lib/economy/dailyCap.ts`) 의 합산 기준.
 *   2. **레퍼런스 환산표** — 정식 출시 시점 토스포인트 환산 재활성화
 *      시 그대로 적용 가능하도록 보존.
 *
 * `pointsFor` / `totalPoints` / `canWithdraw` / `MIN_PAYOUT` 는 R32
 * 시점에 **활성 호출 사이트 없음** (PR-145 에서 RewardsPanel / 출금
 * 흐름 제거). export 는 유지하되 신규 코드에서 호출하지 말 것 —
 * 정식 출시 시점에 재활성화 검토.
 *
 * 신규 in-app sink (프리미엄 가구 / 가챠 pity) 는 P 단위가 아닌 자원
 * 자체 (`candyCarrots` / `goldenCarrots`) 를 직접 차감 — `farmStore`
 * 의 `spendCarrots` / `spendCandyCarrots` / `spendGoldenCarrots` CAS
 * 액션 사용.
 */

export const POINT_VALUES = {
  carrot: 1,
  candy: 5,
  golden: 10,
} as const;

export type CarrotKind = keyof typeof POINT_VALUES;

/**
 * Minimum pending balance the player can withdraw to Toss points.
 *
 * @deprecated R32 — 토스포인트 환산 dormant. 정식 출시 시점에 재활성화
 * 검토 시 본 상수 그대로 활용 예정. 베타 단계에서는 미사용.
 */
export const MIN_PAYOUT = 50;

export function pointsFor(kind: CarrotKind, count = 1): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return POINT_VALUES[kind] * Math.floor(count);
}

/**
 * Aggregate the player's three carrot counters into a pending point
 * total.
 *
 * @deprecated R32 — 활성 호출 사이트 없음. RewardsPanel 의 "P 합산
 * chip" 제거 (PR-185) 이후 사용 안 됨. 정식 출시 시점에 환산 재활성화
 * 시 다시 사용 가능. 그 사이 신규 코드는 자원 자체 (`candyCarrots` /
 * `goldenCarrots`) 를 직접 표시.
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

/**
 * @deprecated R32 — 토스포인트 환산 dormant 으로 호출 사이트 없음.
 * 정식 출시 시점에 출금 UI 재활성화 시 다시 사용.
 */
export function canWithdraw(points: number): boolean {
  return Number.isFinite(points) && points >= MIN_PAYOUT;
}
