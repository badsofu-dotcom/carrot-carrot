/**
 * Weekly missions (PR-76) — 매주 월요일 04:00 KST 리셋 3 미션.
 *
 *   1) weeklyAttendDays5    : 주 5일 집중 출석 (+30P + 보물상자 보장)
 *   2) weeklyTotalFocusMin300 : 주 누적 5시간 (300분) 집중 (+50P)
 *   3) weeklyPerfectCombo5  : 주 퍼펙트 콤보 5회 (+20P)
 *
 * Reset 시점: 매주 월요일 04:00 KST. 사용자가 "새 주" 라고 인식하는
 * 자연스러운 경계 (밤늦게까지 공부 → 다음날 새벽 4시 전에 끝낸 세션
 * 은 같은 주에 카운트).
 *
 * 정합:
 *   - weeklyAttendDays5 claim → rewardsStore.addTreasureProgress(7) 로
 *     주간 보물상자 progress 강제 충족 (사용자 spec "보물상자 보장").
 *     단, 보물상자 자체의 reward 는 별도 (rewardsStore.claimTreasure
 *     로 사용자가 직접 open).
 */

export type WeeklyMissionType =
  | "weeklyAttendDays5"
  | "weeklyTotalFocusMin300"
  | "weeklyPerfectCombo5";

export interface WeeklyMissionDef {
  type: WeeklyMissionType;
  threshold: number;
  rewardP: number;
  title: string;
  emoji: string;
}

export const WEEKLY_MISSIONS: readonly WeeklyMissionDef[] = [
  {
    type: "weeklyAttendDays5",
    threshold: 5,
    rewardP: 30,
    title: "주 5일 집중 출석",
    emoji: "📅",
  },
  {
    type: "weeklyTotalFocusMin300",
    threshold: 300,
    rewardP: 50,
    title: "주 누적 5시간 집중",
    emoji: "📚",
  },
  {
    type: "weeklyPerfectCombo5",
    threshold: 5,
    rewardP: 20,
    title: "주 퍼펙트 콤보 5회",
    emoji: "🎯",
  },
];

/**
 * 주 키 — 해당 시점이 속한 "주" 의 월요일 KST 일자 (04:00 KST 기준).
 *
 * Examples (KST 시간 기준 in comments):
 *   2026-05-18 (Mon) 03:00 → "2026-05-11" (이전 주 월요일, 04:00 안 지남)
 *   2026-05-18 (Mon) 04:00 → "2026-05-18" (새 주 시작)
 *   2026-05-22 (Fri) 12:00 → "2026-05-18" (같은 주)
 *   2026-05-25 (Mon) 03:59 → "2026-05-18" (다음 주 시작 전)
 */
export function weekKey(now: Date = new Date()): string {
  // UTC ms → KST ms (UTC+9)
  const kstMs = now.getTime() + 9 * 3600 * 1000;
  // 04:00 anchor — KST 시간을 4 시간 앞으로 당겨서 04:00 KST 가 00:00 으로.
  const anchored = new Date(kstMs - 4 * 3600 * 1000);
  // anchored 의 UTC dow 가 anchored 일의 dow (이미 시간대 shifted)
  const dow = anchored.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = (dow + 6) % 7; // 0=Mon, 1=Tue, ..., 6=Sun
  const monday = new Date(anchored.getTime() - daysFromMonday * 86400 * 1000);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const WEEKLY_ALL_COMPLETE_BONUS_P = 20;

/**
 * 주간 모든 미션 클리어 시 보너스 포함 총 EV.
 *   30 + 50 + 20 + 20(bonus) = 120 P / 주
 */
export function totalWeeklyEv(): number {
  const sum = WEEKLY_MISSIONS.reduce((s, m) => s + m.rewardP, 0);
  return sum + WEEKLY_ALL_COMPLETE_BONUS_P;
}
