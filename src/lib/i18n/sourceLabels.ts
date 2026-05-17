/**
 * sourceLabels (PR-73) — 자원/도구 detail 의 영어 토큰을 사용자 친화
 * 한국어로 변환.
 *
 * itemsStore.ITEMS 의 `acquisition` 필드가 일부 영어 token 식별자
 * (`daily-gift`, `focus-tier`, `weekly-treasure` 등) 를 직접 노출 →
 * 사용자 가방 detail 에서 그대로 보임. 본 모듈이 매핑 dict 와
 * `translateAcquisition()` 함수를 제공해서 render 시점에 한국어로 치환.
 *
 * 정책:
 *   - 모든 acquisition 텍스트는 render 직전 translateAcquisition() 통과.
 *   - 알려진 token 은 dict 로 변환, 모르는 token 은 그대로 통과 (이미
 *     한국어로 작성된 텍스트는 영향 없음).
 *   - 새 token 추가 시 KOREAN_TOKEN_LABELS 만 갱신.
 */

/** 영어 식별자 → 사용자 노출용 한국어 라벨. */
export const KOREAN_TOKEN_LABELS: Readonly<Record<string, string>> = {
  // 보상 채널
  "daily-gift": "일일 선물",
  "focus-tier": "집중 보상 (25/50분)",
  "weekly-treasure": "주간 보물상자",
  "ad-watch": "광고 시청 보상",
  "farm-drop": "농장 드랍",
  "harvest-bonus": "수확 보너스",

  // 도구/소비
  cake: "케이크 사용",
  juice: "주스 사용",
  soup: "수프 사용",
  hourglass: "모래시계 사용",
  bolt: "번개 사용",

  // 자원 교환 표현
  // PR-109 — gem 5→9 (씨앗) → gem 5→3 (캔디당근).
  "gem 5→3": "보석 5개 → 캔디당근 3개 교환",
  "gem-trade": "보석 사용 (교환 모달)",

  // 친구
  "friend-wave": "친구 wave",
  "friend-invite": "친구 초대",
};

/**
 * acquisition 문자열을 token 분할 → 매핑 → 재조합.
 *
 * 입력 예: "daily-gift / focus-tier / cake / weekly-treasure / gem 5→3"
 * 출력 예: "일일 선물 / 집중 보상 (25/50분) / 케이크 사용 / 주간 보물상자 / 보석 5개 → 캔디당근 3개 교환"
 *
 * 이미 한국어로 작성된 부분 ("수확", "농장 드랍" 등 직접 한국어 텍스트)
 * 은 그대로 통과. 따라서 모든 acquisition 에 안전하게 적용 가능.
 */
export function translateAcquisition(input: string): string {
  if (!input) return input;
  return input
    .split(" / ")
    .map((seg) => toLabel(seg.trim()))
    .join(" / ");
}

/**
 * Single token → label. 매핑 없으면 원본 그대로 (이미 한국어 추정).
 *
 * Export 해서 detail 컴포넌트가 비-list 형식의 단일 토큰에도 사용 가능.
 */
export function toLabel(token: string): string {
  return KOREAN_TOKEN_LABELS[token] ?? token;
}
