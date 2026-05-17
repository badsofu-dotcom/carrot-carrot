/**
 * farmHelpers (PR-91) — pure helpers for farm-state predicates.
 *
 * 도구 사용 전 가드 (모래시계 / 케이크 등) — 작물 상태 기반 사용
 * 가능 여부. inventory consume 전 호출해서 effect 없는 사용 차단.
 */

import type { CropStage } from "../features/collection/farmStore";

/**
 * 모래시계 효과 (작물 +1 stage) 가 의미 있는지.
 * 즉 stage 1..3 (성장 중) plot 이 1개라도 있으면 true.
 *   - 모든 plot stage 0 (빈 밭) → false
 *   - 모든 plot stage 4 (만렙) → false
 *   - 일부 1..3 → true
 */
export function canGrowAnyStages(stages: readonly CropStage[]): boolean {
  for (const s of stages) {
    if (s >= 1 && s < 4) return true;
  }
  return false;
}

/**
 * 빈 밭 (모든 plot stage 0) 인지.
 */
export function isFarmEmpty(stages: readonly CropStage[]): boolean {
  for (const s of stages) {
    if (s > 0) return false;
  }
  return true;
}

/**
 * 모든 작물이 익은 상태 (stage 4) 인지.
 * 빈 plot 이 있으면 false.
 */
export function isFarmAllRipe(stages: readonly CropStage[]): boolean {
  let anyPlanted = false;
  for (const s of stages) {
    if (s === 0) return false;
    if (s > 0) anyPlanted = true;
    if (s < 4) return false;
  }
  return anyPlanted;
}

/**
 * 모래시계 사용 불가 사유 (UX 메시지용).
 *   - "empty": 심은 작물이 없음
 *   - "all-ripe": 모두 다 자람 (변경: 빈 plot 이 없고 모두 stage 4)
 *   - "all-grown-mixed": 빈 plot 도 있지만 모든 심은 작물이 만렙 (혼합)
 *   - null: 사용 가능
 */
export type HourglassBlockReason =
  | "empty"
  | "all-ripe"
  | "all-grown-mixed"
  | null;

export function hourglassBlockReason(
  stages: readonly CropStage[],
): HourglassBlockReason {
  if (canGrowAnyStages(stages)) return null;
  if (isFarmEmpty(stages)) return "empty";
  // 빈 plot 이 있을 수도, 없을 수도 있고, 심은 건 다 stage 4.
  if (isFarmAllRipe(stages)) return "all-ripe";
  return "all-grown-mixed";
}
