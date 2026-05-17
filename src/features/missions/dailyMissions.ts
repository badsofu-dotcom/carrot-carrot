/**
 * Daily missions (PR-52 → PR-75) — 게임 중심에서 공부 중심으로 재설계.
 *
 * PR-52 (구버전): 12-pool 에서 KST 자정 결정적 3개 random pick.
 *   - 도구 사용, 광고 시청, 캔디 수확 등 게임 plays 강제하는 미션 포함.
 *   - 학습 도구 톤과 어긋남 (학습 무관 활동 강제).
 *
 * PR-75: **고정 3개 일일 미션**. 학습 중심 — 집중 세션 수 / 누적 시간 /
 * 퍼펙트 콤보. 매일 같은 3개 (랜덤 X), 클리어 시 보상.
 *
 *   1) min25Sessions2  : 25분+ 집중 세션 2회 (+10P)
 *   2) totalFocusMin50 : 오늘 누적 50분 집중   (+15P)
 *   3) perfectCombo1   : 퍼펙트 콤보 1회       (+5P)
 *
 * 구 MissionType (focus_25 / focus_50 / ad_watch / tool_use 등) 은
 * 유지되지만 MISSION_POOL 에 포함 안 됨 → 호출되는 incrementProgress 가
 * silent no-op. 기존 trigger 사이트 코드는 손대지 않아도 안전.
 */

export type MissionType =
  // PR-75 — 신규 학습 중심 (active pool).
  | "min25Sessions2"
  | "totalFocusMin50"
  | "perfectCombo1"
  // PR-52 (legacy, inactive pool — silent no-op):
  | "focus_25"
  | "focus_50"
  | "focus_night"
  | "ad_watch"
  | "bunny_new"
  | "golden_harvest"
  | "candy_harvest"
  | "drop_pickup"
  | "medal_unlock"
  | "perfect_combo"
  | "tool_use"
  | "friend_invite";

export interface MissionDef {
  type: MissionType;
  threshold: number;
  rewardP: number;
  title: string;
  emoji: string;
}

/**
 * PR-75 — 매일 고정 3개. pickDailyMissions 는 단순 반환.
 */
export const MISSION_POOL: readonly MissionDef[] = [
  {
    type: "min25Sessions2",
    threshold: 2,
    rewardP: 10,
    title: "25분 이상 집중 2회",
    emoji: "⏱",
  },
  {
    type: "totalFocusMin50",
    threshold: 50,
    rewardP: 15,
    title: "오늘 누적 50분 집중",
    emoji: "📚",
  },
  {
    type: "perfectCombo1",
    threshold: 1,
    rewardP: 5,
    title: "퍼펙트 콤보 1회",
    emoji: "🎯",
  },
];

export const DAILY_MISSION_COUNT = 3;
export const ALL_COMPLETE_BONUS_P = 5;

// PR-102 — kstDayKey re-export from single helper (lib/kst.ts).
// 기존 import 위치 (`./dailyMissions`) 들과의 backward compat 유지.
import { kstDayKey } from "../../lib/kst";
export { kstDayKey };

/**
 * PR-75 — 일일 미션은 매일 고정 3개. 입력 `day` 는 결정적 시그니처
 * 유지를 위해 받지만 결과는 모든 day 동일.
 */
export function pickDailyMissions(
  _day: string = kstDayKey(),
  count: number = DAILY_MISSION_COUNT,
  pool: readonly MissionDef[] = MISSION_POOL,
): readonly MissionDef[] {
  return pool.slice(0, count);
}

export function totalMissionEv(missions: readonly MissionDef[]): number {
  const sum = missions.reduce((s, m) => s + m.rewardP, 0);
  return sum + ALL_COMPLETE_BONUS_P; // 모든 미션 클리어 보너스 가정
}
