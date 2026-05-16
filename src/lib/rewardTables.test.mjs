/**
 * Probability + EV tests for DAILY_GIFT_TABLE / WEEKLY_TREASURE_TABLE.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./rewardTables.ts", import.meta.url);
const {
  DAILY_GIFT_TABLE,
  WEEKLY_TREASURE_TABLE,
  tableSum,
  expectedValuePoints,
  rollTable,
} = mod;

const TOL = 1e-9;

test("DAILY_GIFT_TABLE probabilities sum to 1.0", () => {
  const s = tableSum(DAILY_GIFT_TABLE);
  assert.ok(Math.abs(s - 1.0) < TOL, `got ${s}`);
});

test("WEEKLY_TREASURE_TABLE probabilities sum to 1.0", () => {
  const s = tableSum(WEEKLY_TREASURE_TABLE);
  assert.ok(Math.abs(s - 1.0) < TOL, `got ${s}`);
});

test("DAILY_GIFT_TABLE EV is computed and reported", () => {
  const ev = expectedValuePoints(DAILY_GIFT_TABLE);
  // PR-17c alignment with giftRoll.ts:
  // 0.6*0 + 0.24*5 + 0.08*10 + 0.06*0 + 0.02*0
  // = 0 + 1.2 + 0.8 + 0 + 0 = 2.0 P
  assert.ok(Math.abs(ev - 2.0) < TOL, `got ${ev}`);
});

test("WEEKLY_TREASURE_TABLE EV is computed", () => {
  const ev = expectedValuePoints(WEEKLY_TREASURE_TABLE);
  // 0.25*10 + 0.2*10 + 0.2*5 + 0.15*0 + 0.15*0 + 0.05*30
  // = 2.5 + 2.0 + 1.0 + 0 + 0 + 1.5 = 7.0 P
  assert.ok(Math.abs(ev - 7.0) < TOL, `got ${ev}`);
});

test("rollTable: rng=0 returns first entry", () => {
  const e = rollTable(DAILY_GIFT_TABLE, () => 0);
  assert.equal(e.kind, "seed");
});

test("rollTable: rng=0.999 returns last entry", () => {
  // PR-17c: last entry is now gem (replaced star).
  const e = rollTable(DAILY_GIFT_TABLE, () => 0.999);
  assert.equal(e.kind, "gem");
});

test("rollTable: rng covers the golden bucket", () => {
  // PR-17c: golden bucket is [0.84, 0.92). rng 0.88 → golden.
  const e = rollTable(DAILY_GIFT_TABLE, () => 0.88);
  assert.equal(e.kind, "golden");
});

test("rollTable: clamps out-of-range rng (no throw)", () => {
  assert.equal(rollTable(DAILY_GIFT_TABLE, () => -1).kind, "seed");
  assert.equal(rollTable(DAILY_GIFT_TABLE, () => 2).kind, "gem");
});
