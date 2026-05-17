/**
 * giftRoll unit tests — runtime daily-gift roll table.
 *
 * PR-109 — 씨앗 자원 폐기. seed entries → candy 흡수.
 * Bands (cumulative): candy 0..0.6 → candy 0.6..0.84 → golden 0.84..0.92 →
 * candy(+2) 0.92..0.98 → gem 0.98..1.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./giftRoll.ts", import.meta.url);
const { rollGift } = mod;

test("rng=0 → candy +1 (시작)", () => {
  const r = rollGift(() => 0);
  assert.equal(r.kind, "candy");
  assert.equal(r.amount, 1);
});

test("rng=0.5 stays in the 60% candy band", () => {
  const r = rollGift(() => 0.5);
  assert.equal(r.kind, "candy");
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

test("rng=0.95 → candy +2 (PR-109 — 이전 seed+3 자리)", () => {
  const r = rollGift(() => 0.95);
  assert.equal(r.kind, "candy");
  assert.equal(r.amount, 2);
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

test("boundary rng=0.92 → candy +2 (inclusive lower)", () => {
  const r = rollGift(() => 0.92);
  assert.equal(r.kind, "candy");
  assert.equal(r.amount, 2);
});

test("Monte-Carlo: 가시적 비율 검증 (PR-109)", () => {
  let gem = 0;
  let candy1 = 0;
  let golden = 0;
  let candy2 = 0;
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
    else if (r.kind === "candy" && r.amount === 1) candy1++;
    else if (r.kind === "candy" && r.amount === 2) candy2++;
    else if (r.kind === "golden") golden++;
  }
  assert.ok(Math.abs(gem / N - 0.02) < 0.005, `gem rate ${gem / N}`);
  // candy +1 합산 = 0.6 + 0.24 = 0.84
  assert.ok(Math.abs(candy1 / N - 0.84) < 0.01, `candy+1 rate ${candy1 / N}`);
  assert.ok(Math.abs(golden / N - 0.08) < 0.01, `golden rate ${golden / N}`);
  assert.ok(Math.abs(candy2 / N - 0.06) < 0.01, `candy+2 rate ${candy2 / N}`);
  assert.equal(gem + candy1 + golden + candy2, N);
});

test("PR-109: seed kind 잔여 없음", () => {
  for (const rng of [0, 0.3, 0.6, 0.85, 0.94, 0.99]) {
    const r = rollGift(() => rng);
    assert.notEqual(r.kind, "seed");
  }
});
