/**
 * Pure-function tests for seasonalBunny.ts.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./seasonalBunny.ts", import.meta.url);
const {
  rollHarvestGacha,
  computePerfectCombo,
  seasonForMonth,
  HARVEST_BASE_CANDY,
  HARVEST_BOOST_CANDY,
  HARVEST_BUNNY_RATE,
  HARVEST_GOLD,
  JUICE_CANDY_BONUS,
} = mod;

test("seasonForMonth covers all 12", () => {
  assert.equal(seasonForMonth(3), "spring");
  assert.equal(seasonForMonth(5), "spring");
  assert.equal(seasonForMonth(6), "summer");
  assert.equal(seasonForMonth(8), "summer");
  assert.equal(seasonForMonth(9), "autumn");
  assert.equal(seasonForMonth(11), "autumn");
  assert.equal(seasonForMonth(12), "winter");
  assert.equal(seasonForMonth(1), "winter");
  assert.equal(seasonForMonth(2), "winter");
});

test("rollHarvestGacha: very low rng → seasonal bunny", () => {
  const out = rollHarvestGacha({ rng: () => 0.001, month: 3 });
  assert.equal(out.kind, "bunny");
  assert.match(out.bunnyId, /^seasonal_/);
});

// PR-32 calibration — bands:
//   [0, 0.005): bunny (0.5%)
//   [0.005, 0.011): golden (0.6%)
//   [0.011, 0.081): candy (7%)
//   [0.081, 1): carrot (91.9%)

test("rollHarvestGacha: rng past bunny rate but inside golden → golden", () => {
  // golden band [0.005, 0.011). rng 0.008 → golden.
  const out = rollHarvestGacha({ rng: () => 0.008 });
  assert.equal(out.kind, "golden");
});

test("rollHarvestGacha: rng in candy base → candy", () => {
  // candy band [0.011, 0.081). rng 0.05 → candy.
  const out = rollHarvestGacha({ rng: () => 0.05 });
  assert.equal(out.kind, "candy");
});

test("rollHarvestGacha: rng above all → plain carrot", () => {
  const out = rollHarvestGacha({ rng: () => 0.9 });
  assert.equal(out.kind, "carrot");
});

test("rollHarvestGacha: perfect-combo widens candy bucket", () => {
  // base candy ends at 0.081; with boost ends at 0.131. rng 0.10 → carrot
  // baseline, candy with boost.
  const baseline = rollHarvestGacha({ rng: () => 0.1 });
  const boosted = rollHarvestGacha({ rng: () => 0.1, perfectCombo: true });
  assert.equal(baseline.kind, "carrot");
  assert.equal(boosted.kind, "candy");
});

test("rollHarvestGacha: comboStreak ≥5 adds +1%p candy", () => {
  // base candy ends at 0.081; +1%p = 0.091. rng 0.085 → carrot baseline,
  // candy with streak.
  const baseline = rollHarvestGacha({ rng: () => 0.085 });
  const streak = rollHarvestGacha({ rng: () => 0.085, comboStreak: 5 });
  assert.equal(baseline.kind, "carrot");
  assert.equal(streak.kind, "candy");
});

test("rollHarvestGacha: owned bunny excluded → falls through", () => {
  const owned = new Set(["seasonal_cherry_blossom"]);
  const out = rollHarvestGacha({
    rng: () => 0.001,
    month: 3,
    ownedBunnyIds: owned,
  });
  assert.notEqual(out.kind, "bunny");
});

test("computePerfectCombo: all-ripe after non-all-ripe", () => {
  const prev = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  const next = [4, 4, 4, 4, 4, 4, 4, 4, 4];
  assert.equal(computePerfectCombo(next, prev), true);
});

test("computePerfectCombo: all-ripe→all-ripe is false", () => {
  const all = [4, 4, 4, 4, 4, 4, 4, 4, 4];
  assert.equal(computePerfectCombo(all, all), false);
});

test("computePerfectCombo: any non-4 in next is false", () => {
  const prev = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  const next = [4, 4, 4, 4, 4, 4, 4, 4, 3];
  assert.equal(computePerfectCombo(next, prev), false);
});

test("computePerfectCombo: wrong length is false", () => {
  assert.equal(computePerfectCombo([4, 4, 4]), false);
});

test("constants are non-zero and sane", () => {
  assert.ok(HARVEST_BASE_CANDY > 0 && HARVEST_BASE_CANDY < 1);
  assert.ok(HARVEST_BOOST_CANDY > HARVEST_BASE_CANDY);
  assert.ok(HARVEST_BUNNY_RATE > 0 && HARVEST_BUNNY_RATE < 0.05);
  assert.ok(HARVEST_GOLD > 0 && HARVEST_GOLD < 0.1);
  assert.ok(JUICE_CANDY_BONUS > 0 && JUICE_CANDY_BONUS < 0.2);
});

// PR-32 — Base candy band ends at 0.005 + 0.006 + 0.07 = 0.081.
// With juice (+0.05): ends at 0.131.

test("rollHarvestGacha: juice buff widens candy bucket past base", () => {
  // r = 0.1 → past base candy cutoff (0.081) but inside juice cutoff (0.131)
  const baseline = rollHarvestGacha({ rng: () => 0.1 });
  const juiced = rollHarvestGacha({ rng: () => 0.1, juiceActive: true });
  assert.equal(baseline.kind, "carrot");
  assert.equal(juiced.kind, "candy");
});

test("rollHarvestGacha: juice stacks on top of perfect-combo boost", () => {
  // PR-32 cumulative cutoffs:
  //   bunny + gold = 0.011
  //   bunny + gold + boost = 0.131
  //   bunny + gold + boost + juice = 0.181
  // r = 0.16 → carrot (boost only), candy (boost + juice).
  const boostOnly = rollHarvestGacha({ rng: () => 0.16, perfectCombo: true });
  const stacked = rollHarvestGacha({
    rng: () => 0.16,
    perfectCombo: true,
    juiceActive: true,
  });
  assert.equal(boostOnly.kind, "carrot");
  assert.equal(stacked.kind, "candy");
});

test("rollHarvestGacha: juice does not push bunny or golden", () => {
  // r = 0.003 < bunny rate → bunny regardless of juice
  const bunny = rollHarvestGacha({
    rng: () => 0.003,
    juiceActive: true,
    month: 3,
  });
  assert.equal(bunny.kind, "bunny");
  // r = 0.008 → past bunny, inside golden (PR-32 [0.005, 0.011))
  const gold = rollHarvestGacha({ rng: () => 0.008, juiceActive: true });
  assert.equal(gold.kind, "golden");
});
