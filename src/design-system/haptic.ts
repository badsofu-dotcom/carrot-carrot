/**
 * Haptic feedback (PR-78) — **no-op stub**.
 *
 * 이전 (PR-1~77): Web Vibration API / Toss SDK 진동 호출.
 * PR-78: 학습 도구 톤 강화 — 32개 호출 사이트 모두 진동 호출 안 함.
 *
 * Export 시그니처 (`haptic(intent)`) 는 유지 — caller 32개 사이트
 * 코드 변경 없이 자동으로 no-op 됨. 향후 mission/session 클리어 햅틱
 * 이 의도된 UX 로 다시 필요해지면 본 함수 본체에 분기 재추가 (예:
 * intent === "success" 만 fire).
 */

export type HapticIntent = "light" | "medium" | "heavy" | "success" | "warning";

export function haptic(_intent: HapticIntent = "light"): void {
  // intentionally empty — see header.
}
