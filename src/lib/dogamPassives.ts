/**
 * Dogam-owned-count passives (PR-38 → PR-71 → R34 PR-205).
 *
 * 토끼 unlock 카운트가 늘수록 누적 패시브 효과. 도감을 "장식" 이
 * 아니라 "메타 진행" 으로 의미 부여.
 *
 * R34 PR-205 — DOGAM_TOTAL 12 → 35 (transparent v2 23종 추가). 모든
 * 패시브는 12 마리에서 saturate (12+ 추가 unlock 은 콜렉션 자체 매력
 * 으로 retention). 12 마리가 "기본 패시브 완성", 13~35 마리는
 * "콜렉션 마스터" 진행도. 30일 1-2h/day 활성 사용자 기준 12 마리는
 * 3-4주 내 도달 가능, 35 마리는 60-90일 장기 retention 목표.
 *
 *    1마리:  캔디 +0.1%p           ( 가장 빠른 첫 패시브 cue)
 *    2마리:  황금 +0.1%p
 *    4마리:  세션 당근 ×1.05
 *    6마리:  광고 보상 +1 carrot
 *    9마리:  일일 gift ×1.5
 *   12마리:  일일 P 캡 100 → 110   (모든 패시브 활성)
 *   13~35:   콜렉션 진행도만 (추가 패시브 없음 — 도파민/자랑 가치)
 *
 * 모든 임계는 inclusive (≥ N). 캐스케이드 (1마리 가지면 1마리 효과
 * 도, 2마리 가지면 1+2 둘 다 활성).
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
    goldenBonusP: count >= 2 ? 0.001 : 0,
    sessionCarrotMul: count >= 4 ? 1.05 : 1,
    adRewardBonusCarrot: count >= 6 ? 1 : 0,
    giftBoostX: count >= 9 ? 1.5 : 1,
    dailyCapBoost: count >= 12 ? 10 : 0,
  };
}

/**
 * Pretty label for the "다음 unlock" 패시브. UI 의 도감 진행도
 * 카드에서 다음 이정표 hint 표시용.
 */
export function nextPassiveLabel(count: number): string | null {
  if (count < 1) return "1마리: 캔디 확률 +0.1%p";
  if (count < 2) return "2마리: 황금 확률 +0.1%p";
  if (count < 4) return "4마리: 세션 당근 +5%";
  if (count < 6) return "6마리: 광고 보상 +1 당근";
  if (count < 9) return "9마리: 오늘의 선물 보너스 +50%";
  if (count < 12) return "12마리: 일일 P 캡 100 → 110 (모든 패시브 활성)";
  return null;
}
