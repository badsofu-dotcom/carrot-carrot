/**
 * Threshold tests for `pointsFor`, `totalPoints`, `canWithdraw`.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./points.ts", import.meta.url);
const { pointsFor, totalPoints, canWithdraw, MIN_PAYOUT, POINT_VALUES } = mod;

test("POINT_VALUES table", () => {
  assert.equal(POINT_VALUES.carrot, 1);
  assert.equal(POINT_VALUES.candy, 5);
  assert.equal(POINT_VALUES.golden, 10);
});

test("pointsFor: 0/1/N", () => {
  assert.equal(pointsFor("carrot", 0), 0);
  assert.equal(pointsFor("carrot"), 1);
  assert.equal(pointsFor("candy", 3), 15);
  assert.equal(pointsFor("golden", 2), 20);
});

test("pointsFor: negative / NaN → 0", () => {
  assert.equal(pointsFor("carrot", -1), 0);
  assert.equal(pointsFor("carrot", NaN), 0);
});

test("totalPoints: aggregates all three carrot types", () => {
  const inv = { carrots: 10, candyCarrots: 2, goldenCarrots: 1 };
  // 10*1 + 2*5 + 1*10 = 30
  assert.equal(totalPoints(inv), 30);
});

test("totalPoints: empty inventory → 0", () => {
  assert.equal(totalPoints({ carrots: 0, candyCarrots: 0, goldenCarrots: 0 }), 0);
});

test("canWithdraw boundary at MIN_PAYOUT", () => {
  assert.equal(MIN_PAYOUT, 50);
  assert.equal(canWithdraw(49), false);
  assert.equal(canWithdraw(50), true);
  assert.equal(canWithdraw(51), true);
});

test("canWithdraw rejects non-finite", () => {
  assert.equal(canWithdraw(NaN), false);
  assert.equal(canWithdraw(Infinity), false);
  assert.equal(canWithdraw(-Infinity), false);
});
