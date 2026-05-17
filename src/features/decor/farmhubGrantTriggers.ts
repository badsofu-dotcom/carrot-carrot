/**
 * farmhubGrantTriggers (Round 26, PR-155) — 도감 N마리 → 버섯집 가구
 * 자동 지급 매핑. 옵션 A1 (1:1).
 *
 *   도감 owned >= 1 → step 1 (carpet)
 *   도감 owned >= 2 → step 2 (bed)
 *   ...
 *   도감 owned >= 8 → step 8 (stoolchair, 풀세트)
 *   도감 owned >= 9~12 → 추가 X (도감 만족만)
 *
 * 즉시 grant 가 아니라 useFarmhubDogamGrant hook 이 다음 조건에서만:
 *   - dogamCount > currentStep (다음 가구 unlock 자격)
 *   - currentStep < 8 (풀세트 아님)
 *   - pendingFurnitureId === null (보관함 비어있음)
 * → 1 step 만 grantNext(). 사용자가 배치하면 hook 이 다시 동일 조건
 *   검사 → 다음 step grant. R25 사용자가 도감 12 / step 0 인 상태로
 *   진입해도 carpet 1개만 도착, 차분히 1개씩.
 *
 * 본 파일은 pure helper 만. hook 은 useFarmhubDogamGrant.ts.
 */
import { FARMHUB_FINAL_STEP } from "./farmhubCatalog";

/**
 * 도감 N 마리 + 현재 step + pending 보유 여부 → 다음 step 자격.
 *
 * Returns:
 *   - null  : 지급 자격 없음 (조건 불충족 또는 풀세트)
 *   - 1..8  : grantNext() 호출 시 해당 step 의 가구가 보관함에 도착해야
 *             자연스러운 시점
 */
export function getNextGrantStep(
  dogamCount: number,
  currentStep: number,
  hasPending: boolean,
): number | null {
  if (hasPending) return null;
  if (currentStep >= FARMHUB_FINAL_STEP) return null;
  if (dogamCount <= currentStep) return null;
  return currentStep + 1;
}
