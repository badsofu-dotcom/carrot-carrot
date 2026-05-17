/**
 * Farm drop table — single source of truth (PR-112).
 *
 * 이전: FarmDropLayer.tsx 의 DROPS 인라인 const. PR-112 가 별도
 * module 로 추출 — 확률 audit / Round 13 PROB_AUDIT.md 후속.
 *
 * Drop pool:
 *   gem 30 / bolt 22 / heart 15 / hourglass 10 / juice 4 / soup 4 /
 *   cake 4 / candy 4 / golden 2 / hidden_bunny 1
 *
 * 합계 weight = 96 (sum 1.0 아님 — pickDrop 가 합계로 정규화).
 *
 * PR-109 — seed slot 제거. candy 로 대체 (weight 4 유지).
 */

export type DropKind =
  | "gem"
  | "bolt"
  | "heart"
  | "hourglass"
  | "juice"
  | "soup"
  | "cake"
  | "candy"
  | "golden"
  | "hidden_bunny";

export interface DropSpec {
  kind: DropKind;
  weight: number;
  emoji: string;
  /** Asset path (optional — fallback to emoji). */
  iconRel?: string;
  /** Korean toast on pickup. */
  toast: string;
}

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";

export const FARM_DROPS: readonly DropSpec[] = [
  {
    kind: "gem",
    weight: 30,
    emoji: "💎",
    iconRel: "assets/farm/icons/icon_gem.png",
    toast: "💎 보석 +1",
  },
  {
    kind: "bolt",
    weight: 22,
    emoji: "⚡",
    iconRel: "assets/farm/icons/icon_energy.png",
    toast: "⚡ 번개 +1",
  },
  {
    kind: "heart",
    weight: 15,
    emoji: "🩷",
    iconRel: "assets/farm/icons/icon_heart_hp.png",
    toast: "🩷 하트 +1",
  },
  {
    kind: "hourglass",
    weight: 10,
    emoji: "⏳",
    iconRel: "assets/farm/icons/icon_timer.png",
    toast: "⏳ 모래시계 +1",
  },
  {
    kind: "juice",
    weight: 4,
    emoji: "🥤",
    iconRel: "assets/farm/foods/food_carrot_juice.png",
    toast: "🥤 주스 +1",
  },
  {
    kind: "soup",
    weight: 4,
    emoji: "🍲",
    iconRel: "assets/farm/foods/food_carrot_soup.png",
    toast: "🍲 수프 +1",
  },
  {
    kind: "cake",
    weight: 4,
    emoji: "🍰",
    iconRel: "assets/farm/foods/food_carrot_cake.png",
    toast: "🍰 케이크 +1",
  },
  {
    kind: "candy",
    weight: 4,
    emoji: "🍬",
    iconRel: "assets/farm/currency/candy_carrot.png",
    toast: "🍬 캔디당근 +1 (+5 P)",
  },
  {
    kind: "golden",
    weight: 2,
    emoji: "✨",
    iconRel: "assets/farm/currency/golden_carrot.png",
    toast: "✨ 황금당근 +1 (+10 P)",
  },
  {
    kind: "hidden_bunny",
    weight: 1,
    emoji: "🐰",
    toast: "🐰 히든 토끼! 보석 +5 보너스",
  },
];

void BASE;

export const FARM_DROPS_TOTAL_WEIGHT = FARM_DROPS.reduce(
  (s, d) => s + d.weight,
  0,
);

/**
 * Pure: weighted pick from FARM_DROPS. Inject `rng` for tests.
 */
export function pickDrop(rng: () => number = Math.random): DropSpec {
  const r = rng() * FARM_DROPS_TOTAL_WEIGHT;
  let acc = 0;
  for (const d of FARM_DROPS) {
    acc += d.weight;
    if (r < acc) return d;
  }
  return FARM_DROPS[FARM_DROPS.length - 1]!;
}
