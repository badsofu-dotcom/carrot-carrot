/**
 * Dogam-owned-count passives (PR-38).
 *
 * 토끼 unlock 카운트가 늘수록 누적 패시브 효과. 도감을 "장식" 이
 * 아니라 "메타 진행" 으로 의미 부여.
 *
 *   1마리:  캔디 확률 +0.1%p
 *   5마리:  황금 확률 +0.1%p
 *  10마리:  세션 당근 +5%
 *  15마리:  광고 보상 +1P 추가
 *  20마리:  일일 gift 보너스 +50%
 *  25마리:  일일 P 캡 100 → 110
 *
 * 모든 임계는 inclusive (≥ N). 캐스케이드 (1마리 가지면 1마리 효과
 * 도, 5마리 가지면 1+5 둘 다 활성).
 */

export interface DogamPassives {
  /** rollHarvestGacha 의 candyP 에 추가될 %p. */
  candyBonusP: number;
  /** rollHarvestGacha 의 goldenP 에 추가될 %p. */
  goldenBonusP: number;
  /** HomePage focus 완료 시 carrot grant 에 곱해지는 multiplier. */
  sessionCarrotMul: number;
  /** AdRewardChannel N-th tier carrot grant 에 더해질 P (carrot 추가). */
  adRewardBonusCarrot: number;
  /** Daily gift roll 보상의 multiplier (amount × giftBoostX). */
  giftBoostX: number;
  /** Worker daily cap 의 추가 P (100 + dailyCapBoost). */
  dailyCapBoost: number;
}

export function passivesFromOwned(count: number): DogamPassives {
  return {
    candyBonusP: count >= 1 ? 0.001 : 0,
    goldenBonusP: count >= 5 ? 0.001 : 0,
    sessionCarrotMul: count >= 10 ? 1.05 : 1,
    adRewardBonusCarrot: count >= 15 ? 1 : 0,
    giftBoostX: count >= 20 ? 1.5 : 1,
    dailyCapBoost: count >= 25 ? 10 : 0,
  };
}

/**
 * Pretty label for the "다음 unlock" 패시브. UI 의 도감 진행도
 * 카드에서 다음 이정표 hint 표시용.
 */
export function nextPassiveLabel(count: number): string | null {
  if (count < 1) return "1마리: 캔디 확률 +0.1%p";
  if (count < 5) return "5마리: 황금 확률 +0.1%p";
  if (count < 10) return "10마리: 세션 당근 +5%";
  if (count < 15) return "15마리: 광고 보상 +1 당근";
  if (count < 20) return "20마리: 오늘의 선물 보너스 +50%";
  if (count < 25) return "25마리: 일일 P 캡 100 → 110";
  return null;
}
