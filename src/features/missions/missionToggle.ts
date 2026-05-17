/**
 * missionToggle (PR-104) — DailyMissionsCard / WeeklyMissionsCard 의
 * 접힘 토글 로직을 순수 함수로 추출 (테스트 가능 + 회귀 차단).
 *
 * 정책 (PR-100 → PR-104):
 *   - `forceCollapsed` true: toggle 차단, expanded 항상 false
 *   - `forceCollapsed` false: toggle 시 userExpanded 반전
 *
 * 회귀 history:
 *   PR-100: forceCollapsed = FOCUSING || PAUSED
 *   PR-104: forceCollapsed = FOCUSING (only) — PAUSED 에서 토글 허용
 */

/**
 * 현재 표시 상태 계산.
 * @returns 펼침 여부
 */
export function computeExpanded(
  forceCollapsed: boolean,
  userExpanded: boolean,
): boolean {
  if (forceCollapsed) return false;
  return userExpanded;
}

/**
 * 토글 시 다음 userExpanded 값. forceCollapsed 면 변경 없음.
 */
export function nextUserExpanded(
  forceCollapsed: boolean,
  currentUserExpanded: boolean,
): boolean {
  if (forceCollapsed) return currentUserExpanded;
  return !currentUserExpanded;
}

/**
 * 토글 가능 여부.
 */
export function canToggle(forceCollapsed: boolean): boolean {
  return !forceCollapsed;
}
