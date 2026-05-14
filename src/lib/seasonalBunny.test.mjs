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

test("rollHarvestGacha: rng past bunny rate but inside golden → golden", () => {
  const out = rollHarvestGacha({ rng: () => 0.01 });
  assert.equal(out.kind, "golden");
});

test("rollHarvestGacha: rng in candy base → candy", () => {
  const out = rollHarvestGacha({ rng: () => 0.05 });
  assert.equal(out.kind, "candy");
});

test("rollHarvestGacha: rng above all → plain carrot", () => {
  const out = rollHarvestGacha({ rng: () => 0.9 });
  assert.equal(out.kind, "carrot");
});

test("rollHarvestGacha: perfect-combo widens candy bucket", () => {
  const baseline = rollHarvestGacha({ rng: () => 0.06 });
  const boosted = rollHarvestGacha({ rng: () => 0.06, perfectCombo: true });
  assert.equal(baseline.kind, "carrot");
  assert.equal(boosted.kind, "candy");
});

test("rollHarvestGacha: comboStreak ≥5 adds +1%p candy", () => {
  const out = rollHarvestGacha({ rng: () => 0.06, comboStreak: 5 });
  assert.equal(out.kind, "candy");
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
});
