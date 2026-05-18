/**
 * Toss-points value table — in-app accounting unit.
 *
 * Conversion (ECONOMY_DESIGN.md 기준):
 *   carrot →  1 P
 *   candy  →  5 P
 *   golden → 10 P
 *
 * R32 (2026-05-18) status — 토스포인트 환산은 **dormant** (RewardsPanel
 * 의 출금 진입점 제거 + 워커 시크릿 미등록). R34 PR-203 — deprecated
 * helper 함수 (`pointsFor` / `totalPoints` / `canWithdraw`) 모두 제거
 * (호출 사이트 0 건 확인). `POINT_VALUES` / `MIN_PAYOUT` 는 보존:
 *
 *   - `POINT_VALUES`: 일일 자원 캡 (`lib/economy/dailyCap.ts`) 의 internal
 *     accounting unit + 정식 출시 시 재활성화 시 환산표 그대로.
 *   - `MIN_PAYOUT`: 정식 출시 시 출금 최소 단위 — 그대로 보존.
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
 * 정식 출시 시 토스포인트 출금 최소 단위. 베타 단계에서는 미사용 —
 * dormant 상태로 보존.
 */
export const MIN_PAYOUT = 50;
