/**
 * Seasonal bunny gacha + combo bonus rules.
 *
 * Pure helpers. No imports. Tree-shakeable.
 *
 * Two pieces of logic:
 *   1. `rollHarvestGacha()` — every harvest has a small chance of
 *      revealing a seasonal bunny instead of the usual carrot.
 *      Probabilities follow the design table below, with a candy boost
 *      applied while a "perfect combo" buff is active and a small batch
 *      bonus while the player is mid-combo.
 *   2. `computePerfectCombo(stages, prevStages)` — given the farm's
 *      plot stages before and after a focus completion, returns true
 *      when the snapshot just turned every plot ripe (stage 4).
 *
 * Persistence isn't implemented here — see the comments in
 * `farmStore.ts`. The combo flag lives in memory only today; cross-
 * session memory belongs to a follow-up DB migration.
 */

// PR-32 calibration — daily 100 P 캡 가이드라인 정합. EV (per harvest):
//   base candy 7% × 5 P = 0.35 P/harvest
//   golden 0.6% × 10 P = 0.06 P/harvest
//   carrot 91.9% × 1 P = 0.919 P/harvest
//   = 1.33 P/harvest. 100 harvests/day ≈ 133 P 잠재 → 워커 daily cap 100 P 가
//   anti-abuse 자연 차단. 광고 50P + 일일 gift 5P + 주간/7 5P → 110 P EV
//   (집중 ratio 0.75 기준).
export const HARVEST_BASE_CANDY = 0.07; // PR-32: 4% → 7%
export const HARVEST_BOOST_CANDY = 0.12; // perfect-combo 시 (변경 없음)
export const HARVEST_BUNNY_RATE = 0.005; // 0.5%
export const HARVEST_GOLD = 0.006; // PR-32: 1% → 0.6%
export const COMBO_BATCH_BONUS = 0.01; // +1%p per harvest while combo ≥ 5
export const JUICE_CANDY_BONUS = 0.05; // +5%p next harvest after 당근 주스 사용

export interface HarvestOutcome {
  kind: "carrot" | "candy" | "golden" | "bunny";
  /** Set only when kind === "bunny". */
  bunnyId?: string;
}

export interface RollOpts {
  /** Random in [0,1). Inject for tests; defaults to `Math.random()`. */
  rng?: () => number;
  /** `month` in [1,12]; defaults to "now" KST. */
  month?: number;
  /** Set of bunny ids the player already owns; excluded from rolls. */
  ownedBunnyIds?: ReadonlySet<string>;
  /** True while a perfect-combo buff is active. */
  perfectCombo?: boolean;
  /** Current combo streak length (last N consecutive harvests). */
  comboStreak?: number;
  /**
   * True iff a `juice` (당근 주스) buff is active. Adds
   * `JUICE_CANDY_BONUS` (+5%p) to the candy band on top of any
   * perfect-combo / batch boost. Caller is responsible for clearing
   * the buff after a single roll.
   */
  juiceActive?: boolean;
}

/**
 * Seasonal bunny pools, KST month-anchored. When dedicated seasonal
 * art lands, update this table — the `bunnyId`s match collection
 * registration; the strings here are placeholders to keep the gacha
 * deterministic without crashing on the rest of the app.
 */
export const SEASONAL_POOLS: Record<string, readonly string[]> = {
  spring: ["seasonal_cherry_blossom"],
  summer: ["seasonal_beach"],
  autumn: ["seasonal_maple"],
  winter: ["seasonal_snowman"],
  general: ["seasonal_basic"],
};

export function seasonForMonth(month: number): keyof typeof SEASONAL_POOLS {
  if (month === 3 || month === 4 || month === 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter"; // 12, 1, 2
}

function kstMonth(d: Date = new Date()): number {
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.getUTCMonth() + 1;
}

/**
 * Roll the harvest outcome. Ordering: bunny first (rarest), then
 * golden, then candy, then plain carrot.
 *
 * Combo / perfect-combo buffs only push the candy line — bunny and
 * golden rates are stable so the rare drops stay rare.
 */
export function rollHarvestGacha(opts: RollOpts = {}): HarvestOutcome {
  const rng = opts.rng ?? Math.random;
  const month = opts.month ?? kstMonth();
  const r = rng();

  // 1) Seasonal bunny (0.5%) — only fires when the seasonal pool has
  //    at least one un-owned bunny. Falls through to candy/golden/
  //    carrot otherwise.
  if (r < HARVEST_BUNNY_RATE) {
    const season = seasonForMonth(month);
    const pool = SEASONAL_POOLS[season] ?? SEASONAL_POOLS.general;
    const owned = opts.ownedBunnyIds;
    const available = owned ? pool.filter((id) => !owned.has(id)) : [...pool];
    if (available.length > 0) {
      const pick = available[Math.floor(rng() * available.length)];
      return { kind: "bunny", bunnyId: pick };
    }
    // No un-owned seasonal bunny — fall through.
  }

  // 2) Golden carrot.
  if (r < HARVEST_BUNNY_RATE + HARVEST_GOLD) {
    return { kind: "golden" };
  }

  // 3) Candy carrot — boosted while perfect-combo or mid-batch.
  //    Juice buff stacks on top of whichever base / boost is active.
  let candyP = opts.perfectCombo ? HARVEST_BOOST_CANDY : HARVEST_BASE_CANDY;
  if ((opts.comboStreak ?? 0) >= 5) candyP += COMBO_BATCH_BONUS;
  if (opts.juiceActive) candyP += JUICE_CANDY_BONUS;
  if (r < HARVEST_BUNNY_RATE + HARVEST_GOLD + candyP) {
    return { kind: "candy" };
  }
  return { kind: "carrot" };
}

/**
 * `prev` is the plot stages before a focus completion; `next` is
 * after. Returns true when the focus session JUST turned every plot
 * ripe — i.e. all 9 entries in `next` are 4 AND `prev` had at least
 * one non-4 plot. Idempotent across re-fires.
 */
export function computePerfectCombo(
  next: readonly number[],
  prev: readonly number[] = [],
): boolean {
  if (next.length !== 9) return false;
  if (!next.every((s) => s === 4)) return false;
  if (prev.length === 9 && prev.every((s) => s === 4)) return false;
  return true;
}
