/**
 * Daily missions (PR-52) — 매일 KST 자정 3개 random pick.
 *
 * 12개 pool. 사용자 spec EV ~15~20 P/일 추가 → 100 P 캡 시너지.
 *
 * Mission type 별 트리거 사이트:
 *   - focus_25       : 25분 이상 집중 완료 (HomePage)
 *   - focus_50       : 50분 이상 집중 완료 (HomePage)
 *   - focus_night    : KST 22-06 시간대 집중 (HomePage)
 *   - ad_watch       : 광고 보상 채널 claim (AdRewardChannelModal)
 *   - bunny_new      : 도감 토끼 신규 unlock (collectionStore)
 *   - golden_harvest : 황금당근 수확 (FarmHub)
 *   - candy_harvest  : 캔디당근 수확 (FarmHub)
 *   - drop_pickup    : 농장 드랍 줍기 (FarmDropLayer)
 *   - medal_unlock   : 메달 신규 unlock (rewardsStore)
 *   - perfect_combo  : 퍼펙트 콤보 1회 (FarmHub)
 *   - tool_use       : 도구 아이템 사용 (InventoryModal)
 *   - friend_invite  : 친구 초대 (PR-54 stub)
 */

export type MissionType =
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

export const MISSION_POOL: readonly MissionDef[] = [
  { type: "focus_25", threshold: 1, rewardP: 5, title: "25분 집중 1회", emoji: "⏱" },
  { type: "focus_50", threshold: 1, rewardP: 10, title: "50분 집중 1회", emoji: "⌛" },
  { type: "focus_night", threshold: 1, rewardP: 5, title: "야간 집중 1회 (22-06시)", emoji: "🌙" },
  { type: "ad_watch", threshold: 3, rewardP: 5, title: "광고 3회 시청", emoji: "🎬" },
  { type: "bunny_new", threshold: 1, rewardP: 3, title: "토끼 1마리 새로 만나기", emoji: "🐰" },
  { type: "golden_harvest", threshold: 1, rewardP: 5, title: "황금당근 1개 수확", emoji: "✨" },
  { type: "candy_harvest", threshold: 3, rewardP: 3, title: "캔디당근 3개 수확", emoji: "🍬" },
  { type: "drop_pickup", threshold: 5, rewardP: 3, title: "농장 드랍 5개 줍기", emoji: "💎" },
  { type: "medal_unlock", threshold: 1, rewardP: 5, title: "메달 1개 신규 unlock", emoji: "🏅" },
  { type: "perfect_combo", threshold: 1, rewardP: 5, title: "퍼펙트 콤보 1회", emoji: "🎯" },
  { type: "tool_use", threshold: 3, rewardP: 3, title: "도구 아이템 3개 사용", emoji: "🔧" },
  { type: "friend_invite", threshold: 1, rewardP: 10, title: "친구 1명 초대", emoji: "💌" },
];

export const DAILY_MISSION_COUNT = 3;
export const ALL_COMPLETE_BONUS_P = 5;

export function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Deterministic hash — `(day, userKey?)` 같은 입력으로 같은 pick 보장.
 *  PR-5 의 fnv1a 와 같은 결정성 보장 패턴. */
function fnv1aHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Daily pick — KST 일자 기반 결정적 3개 선택. 같은 일자 같은 사용자는
 * 항상 같은 3개. 정렬 후 pop 으로 중복 없이.
 */
export function pickDailyMissions(
  day: string = kstDayKey(),
  count: number = DAILY_MISSION_COUNT,
  pool: readonly MissionDef[] = MISSION_POOL,
): readonly MissionDef[] {
  const base = fnv1aHash(day);
  // Fisher-Yates 변형 — base + i 로 seeded index pick.
  const indices = pool.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = fnv1aHash(`${day}#${i}`) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  void base;
  const picked: MissionDef[] = [];
  for (let i = 0; i < count && i < indices.length; i++) {
    picked.push(pool[indices[i]]!);
  }
  return picked;
}

export function totalMissionEv(missions: readonly MissionDef[]): number {
  const sum = missions.reduce((s, m) => s + m.rewardP, 0);
  return sum + ALL_COMPLETE_BONUS_P; // 모든 미션 클리어 보너스 가정
}
