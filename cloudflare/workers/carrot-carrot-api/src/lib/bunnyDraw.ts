/**
 * Pure bunny gacha helper — weighted tier draw with owned-set exclusion.
 *
 * Lives in `lib/` (not routes/) so unit tests can load it via the
 * esbuild TS transform without pulling in Hono. The HTTP route in
 * `routes/bunnies.ts` calls `drawFromRoster` after reading the user's
 * authoritative owned set from D1.
 *
 * Tier weights:
 *   common 70 / rare 22 / epic 7 / legendary 1
 * The harvest call site sets `excludeLegendary: true` so legendary is
 * only reachable via a star-purchase variant (not implemented in this
 * route yet).
 */

export type GachaTier = "common" | "rare" | "epic" | "legendary";

export interface BunnyRosterEntry {
  id: string;
  tier: GachaTier;
}

export const TIER_WEIGHTS: Record<GachaTier, number> = {
  common: 0.7,
  rare: 0.22,
  epic: 0.07,
  legendary: 0.01,
};

export interface DrawArgs {
  roster: ReadonlyArray<BunnyRosterEntry>;
  ownedIds: ReadonlySet<string>;
  excludeLegendary?: boolean;
  rng?: () => number;
}

export interface DrawDecision {
  bunnyId: string | null;
  tier: GachaTier | null;
}

export function drawFromRoster(args: DrawArgs): DrawDecision {
  const rng = args.rng ?? Math.random;
  const excludeLegendary = args.excludeLegendary ?? true;

  const buckets: GachaTier[] = excludeLegendary
    ? ["common", "rare", "epic"]
    : ["common", "rare", "epic", "legendary"];

  const totalW = buckets.reduce((s, t) => s + TIER_WEIGHTS[t], 0);
  const r = rng() * totalW;
  let acc = 0;
  let chosen: GachaTier = buckets[0]!;
  for (const t of buckets) {
    acc += TIER_WEIGHTS[t];
    if (r < acc) {
      chosen = t;
      break;
    }
  }

  const poolFor = (t: GachaTier): string[] =>
    args.roster
      .filter((e) => e.tier === t && !args.ownedIds.has(e.id))
      .map((e) => e.id);

  let pool = poolFor(chosen);
  if (pool.length === 0) {
    // Fallthrough: walk the remaining buckets until we find an un-owned bunny.
    for (const t of buckets) {
      if (t === chosen) continue;
      const fb = poolFor(t);
      if (fb.length > 0) {
        return { bunnyId: fb[Math.floor(rng() * fb.length)]!, tier: t };
      }
    }
    return { bunnyId: null, tier: null };
  }
  return { bunnyId: pool[Math.floor(rng() * pool.length)]!, tier: chosen };
}
