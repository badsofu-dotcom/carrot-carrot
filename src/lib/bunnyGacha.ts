/**
 * Bunny gacha — rarity pool + draw logic.
 *
 * Rarity weights (sum 1.0):
 *   common    70 %
 *   rare      22 %
 *   epic       7 %
 *   legendary  1 %   (NOT eligible from harvest — 100-star purchase only)
 *
 * `drawBunny` reads the CHARACTERS list and partitions placeholders +
 * defined chars into the 4-tier groups. Already-owned IDs are excluded.
 * `excludeLegendary: true` is set by the harvest call site so the
 * legendary group is unreachable; the star-purchase call site uses
 * `{ excludeLegendary: false, forceLegendary: true }` to pick from the
 * legendary group directly.
 *
 * R32 PR-184 — pity 보조 통화 (candy/golden):
 *   boostTier: "rare"  → 캔디당근 10개 pity. buckets = [rare, epic],
 *                        epic 가중치 2x (rare 보장, epic+ 확률 강화).
 *   boostTier: "epic"  → 황금당근 5개 pity. buckets = [epic, legendary]
 *                        (epic 보장, legendary 12.5% 확률).
 *   두 경우 모두 excludeLegendary / forceLegendary 무시.
 *   legendary 보장은 기존 star 100 path (forceLegendary) 만 유지 →
 *   legendary 희소성 보존.
 */

import { CHARACTERS, SLOTS, type Rarity } from "../features/collection/collectionData";

export type GachaTier = "common" | "rare" | "epic" | "legendary";

export const TIER_WEIGHTS: Record<GachaTier, number> = {
  common: 0.7,
  rare: 0.22,
  epic: 0.07,
  legendary: 0.01,
};

/** 0.5% chance per harvest tap. Spec target. */
export const HARVEST_BUNNY_CHANCE = 0.005;

/** Cost to buy a guaranteed legendary draw. */
export const LEGENDARY_STAR_COST = 100;

/** R32 PR-184 — 캔디당근 → rare 보장 가챠 1회 비용. */
export const CANDY_RARE_PITY_COST = 10;

/** R32 PR-184 — 황금당근 → epic 보장 가챠 1회 비용. */
export const GOLDEN_EPIC_PITY_COST = 5;

/** R32 PR-184 — boostTier === "rare" 경우 epic 가중치 배수. */
export const RARE_PITY_EPIC_MULTIPLIER = 2;

/** Map raw character rarity into the 4-tier gacha pool. */
function tierOf(r: Rarity): GachaTier {
  switch (r) {
    case "common":
      return "common";
    case "rare":
      return "rare";
    case "sr":
    case "ssr":
      return "epic";
    case "legendary":
      return "legendary";
  }
}

interface DrawOpts {
  ownedIds: ReadonlySet<string>;
  /** Forces tier to legendary (star purchase path). */
  forceLegendary?: boolean;
  /** Removes the legendary tier from the rarity roll. Default true. */
  excludeLegendary?: boolean;
  /**
   * R32 PR-184 — pity 보조 통화 가챠.
   *   "rare"  → buckets [rare, epic], epic weight ×2 (rare 보장).
   *   "epic"  → buckets [epic, legendary], 정상 weight (epic 보장).
   * 설정 시 excludeLegendary / forceLegendary 무시.
   */
  boostTier?: "rare" | "epic";
  /** Inject for tests. */
  rng?: () => number;
}

export interface DrawResult {
  /** `null` if every bunny in every eligible tier is already owned. */
  bunnyId: string | null;
  tier: GachaTier | null;
}

export function drawBunny(opts: DrawOpts): DrawResult {
  const rng = opts.rng ?? Math.random;

  // R32 PR-184 — boostTier 가 forceLegendary 보다 우선. 둘 다 설정 시
  // boostTier 가 선택 (정상 흐름에서 동시 설정 없음).
  if (opts.boostTier) {
    return drawWithBoost(opts.boostTier, opts.ownedIds, rng);
  }

  if (opts.forceLegendary) {
    const pool = pickPool("legendary", opts.ownedIds);
    if (pool.length === 0) return { bunnyId: null, tier: "legendary" };
    return {
      bunnyId: pool[Math.floor(rng() * pool.length)]!,
      tier: "legendary",
    };
  }

  const excludeLegendary = opts.excludeLegendary ?? true;
  const buckets: GachaTier[] = excludeLegendary
    ? ["common", "rare", "epic"]
    : ["common", "rare", "epic", "legendary"];

  return rollAndPick(buckets, TIER_WEIGHTS, opts.ownedIds, rng);
}

/**
 * R32 PR-184 — boostTier pity 의 가챠 분기.
 * buckets / weights 를 boostTier 별로 별도 산정한 뒤 공통 rollAndPick
 * 으로 추첨. tier-by-tier fallback 그대로 작동 (선택된 tier 가 모두
 * owned 면 다음 tier 로 fallback).
 */
function drawWithBoost(
  boostTier: "rare" | "epic",
  ownedIds: ReadonlySet<string>,
  rng: () => number,
): DrawResult {
  if (boostTier === "rare") {
    // 캔디 pity — rare 보장, epic+ 확률 강화.
    const buckets: GachaTier[] = ["rare", "epic"];
    const weights: Record<GachaTier, number> = {
      common: 0,
      rare: TIER_WEIGHTS.rare,
      epic: TIER_WEIGHTS.epic * RARE_PITY_EPIC_MULTIPLIER,
      legendary: 0,
    };
    return rollAndPick(buckets, weights, ownedIds, rng);
  }
  // boostTier === "epic" — 황금 pity. epic 보장 + legendary 확률 보존.
  const buckets: GachaTier[] = ["epic", "legendary"];
  const weights: Record<GachaTier, number> = {
    common: 0,
    rare: 0,
    epic: TIER_WEIGHTS.epic,
    legendary: TIER_WEIGHTS.legendary,
  };
  return rollAndPick(buckets, weights, ownedIds, rng);
}

/**
 * 공통 추첨 헬퍼 — buckets 합산 가중치로 정규화한 뒤 1개 picking +
 * tier 가 모두 owned 면 buckets 순서대로 fallback.
 */
function rollAndPick(
  buckets: GachaTier[],
  weights: Record<GachaTier, number>,
  ownedIds: ReadonlySet<string>,
  rng: () => number,
): DrawResult {
  const total = buckets.reduce((s, t) => s + weights[t], 0);
  // Defensive — total 0 인 buckets 호출은 없어야 하지만 안전.
  if (total <= 0) return { bunnyId: null, tier: null };

  const r = rng() * total;
  let acc = 0;
  let chosen: GachaTier = buckets[0]!;
  for (const t of buckets) {
    acc += weights[t];
    if (r < acc) {
      chosen = t;
      break;
    }
  }

  const pool = pickPool(chosen, ownedIds);
  if (pool.length === 0) {
    for (const t of buckets) {
      if (t === chosen) continue;
      const fb = pickPool(t, ownedIds);
      if (fb.length > 0) {
        return { bunnyId: fb[Math.floor(rng() * fb.length)]!, tier: t };
      }
    }
    return { bunnyId: null, tier: chosen };
  }
  return { bunnyId: pool[Math.floor(rng() * pool.length)]!, tier: chosen };
}

function pickPool(tier: GachaTier, owned: ReadonlySet<string>): string[] {
  // The collection data has both an explicit `CHARACTERS` list and a
  // `SLOTS` array. SLOTS includes placeholder bunnies with their own
  // rarity stamps — the dogam grid renders from SLOTS, so the pool
  // must also draw from SLOTS to match what the player can actually
  // unlock.
  const ids = new Set<string>();
  for (const c of CHARACTERS) {
    if (tierOf(c.rarity) === tier) ids.add(c.id);
  }
  for (const s of SLOTS) {
    if (s.character && tierOf(s.character.rarity) === tier) {
      ids.add(s.character.id);
    }
  }
  return Array.from(ids).filter((id) => !owned.has(id));
}
