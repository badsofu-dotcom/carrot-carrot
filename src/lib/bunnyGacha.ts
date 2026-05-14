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
  const excludeLegendary = opts.excludeLegendary ?? true;

  if (opts.forceLegendary) {
    const pool = pickPool("legendary", opts.ownedIds);
    if (pool.length === 0) return { bunnyId: null, tier: "legendary" };
    return {
      bunnyId: pool[Math.floor(rng() * pool.length)]!,
      tier: "legendary",
    };
  }

  const buckets: GachaTier[] = excludeLegendary
    ? ["common", "rare", "epic"]
    : ["common", "rare", "epic", "legendary"];

  // Normalize weights so the buckets sum to 1.0 even when legendary is
  // excluded — keeps the per-tap drop floor unchanged.
  const total = buckets.reduce((s, t) => s + TIER_WEIGHTS[t], 0);
  const r = rng() * total;
  let acc = 0;
  let chosen: GachaTier = buckets[0]!;
  for (const t of buckets) {
    acc += TIER_WEIGHTS[t];
    if (r < acc) {
      chosen = t;
      break;
    }
  }

  const pool = pickPool(chosen, opts.ownedIds);
  if (pool.length === 0) {
    // Fall through tier-by-tier (lower-rarity-first) so we don't dead-
    // end the player when their chosen tier is already complete.
    for (const t of buckets) {
      if (t === chosen) continue;
      const fb = pickPool(t, opts.ownedIds);
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
