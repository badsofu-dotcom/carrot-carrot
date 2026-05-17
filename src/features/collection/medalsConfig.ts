/**
 * MedalsConfig (PR-49) — 11종 메달 디자인 정의.
 *
 * `MedalId` enum 은 `rewardsStore.ts` 가 SoT 로 유지 (기존 unlockMedal
 * 트리거 사이트들과 호환). 본 파일은 display 레이어 — 이름/설명/
 * 아이콘/등급/카테고리 매핑. AchievementsCard 가 이걸 사용해 정렬
 * 및 렌더링.
 *
 * 등급 매트릭스:
 *   bronze (3): 초기 진입 — first_session / first_harvest / five_carrots
 *   silver (5): 중급 도전 — perfect_combo / first_candy / dogam_25 / dogam_50 / quiet_sky
 *   gold   (3): 고급 도전 — first_golden / dogam_75 / dogam_100
 *
 * 카테고리:
 *   focus (집중): first_session, perfect_combo, quiet_sky
 *   farm  (수확): first_harvest, five_carrots, first_candy, first_golden
 *   dogam (수집): dogam_25, dogam_50, dogam_75, dogam_100
 *
 * iconRel 경로의 PNG 는 사용자가 별도 자산 추가 작업 중. 자산 미존재
 * 시 AchievementsCard 가 onError fallback (medal_bronze/silver/gold).
 */
import type { MedalId } from "./rewardsStore";

export type MedalTier = "bronze" | "silver" | "gold";
export type MedalCategory = "focus" | "farm" | "dogam";

export interface MedalDef {
  id: MedalId;
  displayName: string;
  description: string;
  /** Public/asset path resolved via BASE_URL at render time. */
  iconRel: string;
  tier: MedalTier;
  category: MedalCategory;
  /** "획득 방법" 안내 (lock 상태 hover/tap hint). */
  unlockHint: string;
}

export const MEDALS: readonly MedalDef[] = [
  // ── BRONZE (입문) ────────────────────────────────────────────────
  {
    id: "first_session",
    displayName: "첫 호흡",
    description: "처음으로 25분 집중을 마쳤어요",
    iconRel: "assets/farm/rewards/medal-first-breath.png",
    tier: "bronze",
    category: "focus",
    unlockHint: "25분 집중 세션 1회 완료",
  },
  {
    id: "first_harvest",
    displayName: "첫 수확",
    description: "농장에서 처음 당근을 수확했어요",
    iconRel: "assets/farm/rewards/medal-first-harvest.png",
    tier: "bronze",
    category: "farm",
    unlockHint: "익은 작물을 한 번 수확",
  },
  {
    id: "five_carrots",
    displayName: "새싹 농부",
    description: "당근 5개를 모았어요",
    iconRel: "assets/farm/rewards/medal-sprout-farmer.png",
    tier: "bronze",
    category: "farm",
    unlockHint: "누적 당근 5개 이상",
  },

  // ── SILVER (중급) ────────────────────────────────────────────────
  {
    id: "perfect_combo",
    displayName: "완벽주의자",
    description: "9개 plot 을 모두 동시에 익혀 한 번에 수확했어요",
    iconRel: "assets/farm/rewards/medal-perfectionist.png",
    tier: "silver",
    category: "focus",
    unlockHint: "퍼펙트 콤보 1회 달성",
  },
  {
    id: "first_candy",
    displayName: "달콤한 발견",
    description: "처음으로 캔디 당근을 찾았어요",
    iconRel: "assets/farm/rewards/medal-sweet-find.png",
    tier: "silver",
    category: "farm",
    unlockHint: "수확 시 캔디 당근 1개 획득",
  },
  {
    id: "dogam_25",
    displayName: "호기심쟁이",
    description: "도감 1/4 (25%) 를 채웠어요",
    iconRel: "assets/farm/rewards/ribbon-curious.png",
    tier: "silver",
    category: "dogam",
    unlockHint: "도감 25% 진행",
  },
  {
    id: "dogam_50",
    displayName: "친구들의 친구",
    description: "도감 절반 (50%) 을 채웠어요",
    iconRel: "assets/farm/rewards/ribbon-friend-of-friends.png",
    tier: "silver",
    category: "dogam",
    unlockHint: "도감 50% 진행",
  },
  {
    id: "quiet_sky",
    displayName: "밤의 숲지기",
    description: "한밤중 (22시~새벽 6시) 집중을 7회 누적했어요",
    iconRel: "assets/farm/rewards/ribbon-night-keeper.png",
    tier: "silver",
    category: "focus",
    unlockHint: "야간 KST 22:00-06:00 집중 누적 7회",
  },

  // ── GOLD (고급) ──────────────────────────────────────────────────
  {
    id: "first_golden",
    displayName: "황금의 손",
    description: "처음으로 황금 당근을 손에 넣었어요",
    iconRel: "assets/farm/rewards/medal-golden-hand.png",
    tier: "gold",
    category: "farm",
    unlockHint: "수확 시 황금 당근 1개 획득",
  },
  {
    id: "dogam_75",
    displayName: "마을 영웅",
    description: "도감 3/4 (75%) 를 채운 진짜 영웅",
    iconRel: "assets/farm/rewards/trophy-village-hero.png",
    tier: "gold",
    category: "dogam",
    unlockHint: "도감 75% 진행",
  },
  {
    id: "dogam_100",
    displayName: "전설의 수집가",
    description: "모든 토끼를 만난 전설. 일일 P 캡 +10 보너스 영구 적용.",
    iconRel: "assets/farm/rewards/trophy-legend.png",
    tier: "gold",
    category: "dogam",
    unlockHint: "도감 100% 완성",
  },
];

/** Tier 정렬 우선순위 — AchievementsCard 가 이 순서대로 렌더. */
const TIER_ORDER: Record<MedalTier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
};

/** Tier 정렬된 메달 목록 — 도감 페이지가 이걸 직접 사용. */
export const SORTED_MEDALS: readonly MedalDef[] = [...MEDALS].sort(
  (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier],
);

/** Quick lookup. */
export const MEDAL_BY_ID: Record<MedalId, MedalDef> = Object.fromEntries(
  MEDALS.map((m) => [m.id, m]),
) as Record<MedalId, MedalDef>;

/** Tier 별 카운트 — 테스트 / UI 헤더 검증용. */
export function tierCounts(): Record<MedalTier, number> {
  const out: Record<MedalTier, number> = { bronze: 0, silver: 0, gold: 0 };
  for (const m of MEDALS) out[m.tier]++;
  return out;
}

/** Tier → fallback 자산 (개별 PNG 미존재 시 사용). */
export function tierFallbackAsset(tier: MedalTier): string {
  switch (tier) {
    case "gold":
      return "assets/farm/rewards/medal_gold.png";
    case "silver":
      return "assets/farm/rewards/medal_silver.png";
    case "bronze":
    default:
      return "assets/farm/rewards/medal_bronze.png";
  }
}
