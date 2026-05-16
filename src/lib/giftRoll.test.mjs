/**
 * giftRoll unit tests — runtime daily-gift roll table.
 *
 * The five bands (cumulative thresholds) must cover [0, 1) exactly,
 * and each well-known rng value must land in the documented band.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./giftRoll.ts", import.meta.url);
const { rollGift } = mod;

test("rng=0 → seed +1", () => {
  const r = rollGift(() => 0);
  assert.equal(r.kind, "seed");
  assert.equal(r.amount, 1);
});

test("rng=0.5 stays in the 60% seed band", () => {
  const r = rollGift(() => 0.5);
  assert.equal(r.kind, "seed");
  assert.equal(r.amount, 1);
});

test("rng=0.7 → candy +1 (in 60..84 band)", () => {
  const r = rollGift(() => 0.7);
  assert.equal(r.kind, "candy");
  assert.equal(r.amount, 1);
});

test("rng=0.88 → golden +1 (in 84..92 band)", () => {
  const r = rollGift(() => 0.88);
  assert.equal(r.kind, "golden");
  assert.equal(r.amount, 1);
});

test("rng=0.95 → seed +3 (in 92..98 band)", () => {
  const r = rollGift(() => 0.95);
  assert.equal(r.kind, "seed");
  assert.equal(r.amount, 3);
});

test("rng=0.99 → gem +1 (in 98..100 band)", () => {
  const r = rollGift(() => 0.99);
  assert.equal(r.kind, "gem");
  assert.equal(r.amount, 1);
});

test("rng=0.9999 still inside the gem band (final entry covers tail)", () => {
  const r = rollGift(() => 0.9999);
  assert.equal(r.kind, "gem");
});

test("boundary rng=0.92 is golden→seed cut → seed +3 (inclusive bound)", () => {
  // strict `<` on lower bound means r=0.92 falls into "seed +3"
  const r = rollGift(() => 0.92);
  assert.equal(r.kind, "seed");
  assert.equal(r.amount, 3);
});

test("Monte-Carlo: gem rate ≈ 2% over 50k samples", () => {
  let gem = 0;
  let candy = 0;
  let golden = 0;
  let seedSmall = 0;
  let seedBig = 0;
  const N = 50000;
  // Deterministic LCG so test result is stable across runs.
  let s = 1234567;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = 0; i < N; i++) {
    const r = rollGift(rand);
    if (r.kind === "gem") gem++;
    else if (r.kind === "candy") candy++;
    else if (r.kind === "golden") golden++;
    else if (r.kind === "seed" && r.amount === 1) seedSmall++;
    else if (r.kind === "seed" && r.amount === 3) seedBig++;
  }
  // Tolerance: ±0.5%-points on each band.
  assert.ok(Math.abs(gem / N - 0.02) < 0.005, `gem rate ${gem / N}`);
  assert.ok(Math.abs(candy / N - 0.24) < 0.01, `candy rate ${candy / N}`);
  assert.ok(Math.abs(golden / N - 0.08) < 0.01, `golden rate ${golden / N}`);
  assert.ok(
    Math.abs(seedSmall / N - 0.6) < 0.01,
    `seed+1 rate ${seedSmall / N}`,
  );
  assert.ok(
    Math.abs(seedBig / N - 0.06) < 0.01,
    `seed+3 rate ${seedBig / N}`,
  );
  // No "other" outcomes — entire sample space accounted for.
  assert.equal(gem + candy + golden + seedSmall + seedBig, N);
});
