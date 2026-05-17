/**
 * Decor feature flags (Round 23, PR-147).
 *
 * R22 PHASE 4 에서 OutdoorSlots placeholder 를 농장에 wire 했더니
 * 베타10 사용자에게 점선 박스 4개가 그대로 노출됨 → 시각적 혼란.
 * 자산 (인테리어 배경 + 가구 sprite) 도착 전까지 flag false 로 잠금.
 *
 * R24+ 에서 자산 도착 후 true 로 토글하면 즉시 노출 (코드 변경 없이).
 * 토글만 바꾸고 commit message 에 "decor 자산 도착 — outdoor slots
 * re-enable" 로 트래킹.
 */

/** 야외 가구 슬롯 4개 (점선 박스 + ＋ UI). */
export const ENABLE_DECOR_OUTDOOR_SLOTS = false;

/**
 * 버섯집 클릭 placeholder. R22 PR-146 에서 🍄 emoji 버튼으로 wire 했으나
 * R23 사용자 피드백: "저 버섯을 얘기한 게 아니라 배경화면에 있는 버섯
 * 집을 얘기한 거야" — 배경 아트의 진짜 버섯집 hit-region 이 필요.
 * 배경 좌표 매핑 도착 (R24+) 까지 placeholder 버튼 hidden.
 */
export const ENABLE_DECOR_MUSHROOM_HOUSE = false;

/** 가구 상점 모달 (RewardsPanel → 진입). emoji sprite 로 카탈로그 노출
 *  가능하므로 자산 도착 전이라도 활성. R24 에서 sprite 만 emoji → image
 *  로 전환. */
export const ENABLE_DECOR_SHOP = true;
