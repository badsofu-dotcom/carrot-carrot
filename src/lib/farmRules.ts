/**
 * Farm reward rules for focus completion.
 *
 * Two stages of enforcement:
 *   1. **5-minute gate** — sessions under 5 minutes grant nothing and the
 *      caller should show a friendly reminder toast.
 *   2. **Duration tier** — once a session clears the gate, it earns a
 *      stage-growth count according to the table below.
 *
 * Pure function. No imports. No side effects. Tree-shakeable from any
 * caller (HomePage, farmStore, tests, future worker logic).
 *
 * Tier table (PR-109 — 씨앗 자원 폐기):
 *
 *   minutes        | growSteps
 *   ---------------|-----------
 *   0     – 4.99   | 0   (BLOCKED — gate fail)
 *   5     – 14.99  | 1
 *   15    – 29.99  | 1
 *   30    – 49.99  | 2
 *   50    – +∞     | 3
 *
 * Stage growth still caps at 4 (ripe) inside the store — the rule object
 * just tells the store how many +1 steps to apply.
 *
 * 이전 (~PR-108): seedDelta (5분미만 0, 15분+ 1, 30분+ 2, 50분+ 3) 도
 * 함께 grant. PR-109 가 씨앗 자원 폐기 — caller 가 더 이상 seedDelta
 * 사용 안 함.
 */

export const MIN_VALID_MINUTES = 5;

export interface FocusFarmReward {
  /** Did the session clear the 5-minute gate? */
  valid: boolean;
  /** Stage growth steps to apply to every planted plot. 0 when blocked. */
  growSteps: number;
  /** Korean message suitable for `toast()`. Already cased. */
  message: string;
  /**
   * Stable identifier of the matched tier. Useful for analytics and tests.
   * `"gated"` when below the 5-minute gate.
   */
  tier: "gated" | "t5" | "t15" | "t30" | "t50";
}

/**
 * Resolve the farm reward for a focus session of `durationMinutes`.
 * Accepts fractional minutes; partial-minute durations are handled by
 * floor semantics so e.g. 4.999 still fails the gate.
 *
 * Caller is responsible for actually applying the steps to state and
 * surfacing the message. This function does NOT mutate anything.
 */
export function getFocusFarmReward(durationMinutes: number): FocusFarmReward {
  const m = Number.isFinite(durationMinutes) ? Math.floor(durationMinutes) : 0;

  if (m < MIN_VALID_MINUTES) {
    return {
      valid: false,
      growSteps: 0,
      message: "5분 이상 집중해야 작물이 자라요",
      tier: "gated",
    };
  }
  if (m < 15) {
    return {
      valid: true,
      growSteps: 1,
      message: "작물이 1단계 자랐어요",
      tier: "t5",
    };
  }
  if (m < 30) {
    return {
      valid: true,
      growSteps: 1,
      message: "작물이 1단계 자랐어요",
      tier: "t15",
    };
  }
  if (m < 50) {
    return {
      valid: true,
      growSteps: 2,
      message: "작물이 2단계 자랐어요",
      tier: "t30",
    };
  }
  return {
    valid: true,
    growSteps: 3,
    message: "작물이 3단계 자랐어요",
    tier: "t50",
  };
}

/** Convenience for callers holding `focusedMs` directly. */
export function getFocusFarmRewardFromMs(focusedMs: number): FocusFarmReward {
  if (!Number.isFinite(focusedMs) || focusedMs < 0) {
    return getFocusFarmReward(0);
  }
  return getFocusFarmReward(focusedMs / 60_000);
}
