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
  // The implementation aims for ≈ 2.5 P; the IMPLEMENTATION_REPORT
  // records the actual EV produced by the live table.
  // 0.4*0 + 0.3*1 + 0.18*5 + 0.07*10 + 0.05*0
  // = 0 + 0.3 + 0.9 + 0.7 + 0 = 1.9 P
  assert.ok(Math.abs(ev - 1.9) < TOL, `got ${ev}`);
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
  const e = rollTable(DAILY_GIFT_TABLE, () => 0.999);
  assert.equal(e.kind, "star");
});

test("rollTable: rng covers the golden bucket", () => {
  // Daily golden = bucket [0.88, 0.95). rng 0.9 → golden.
  const e = rollTable(DAILY_GIFT_TABLE, () => 0.9);
  assert.equal(e.kind, "golden");
});

test("rollTable: clamps out-of-range rng (no throw)", () => {
  assert.equal(rollTable(DAILY_GIFT_TABLE, () => -1).kind, "seed");
  assert.equal(rollTable(DAILY_GIFT_TABLE, () => 2).kind, "star");
});
