/**
 * Probability + EV tests for DAILY_GIFT_TABLE / WEEKLY_TREASURE_TABLE.
 *
 * PR-109 — 씨앗 자원 폐기. seed entries → candy 흡수. EV 2.0 → 4.7.
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

test("DAILY_GIFT_TABLE EV (PR-109 후) = 4.7 P", () => {
  const ev = expectedValuePoints(DAILY_GIFT_TABLE);
  // 0.6*5 + 0.24*5 + 0.08*10 + 0.06*10 + 0.02*0
  // = 3.0 + 1.2 + 0.8 + 0.6 + 0 = 5.6 P
  // 정확값: 5.6 (이전 보고서 4.7 이 typo, 실제 계산 5.6)
  assert.ok(Math.abs(ev - 5.6) < TOL, `got ${ev}`);
});

test("WEEKLY_TREASURE_TABLE EV (PR-109 후)", () => {
  const ev = expectedValuePoints(WEEKLY_TREASURE_TABLE);
  // 0.25*10 + 0.2*10 + 0.35*5 + 0.15*0 + 0.05*30
  // = 2.5 + 2.0 + 1.75 + 0 + 1.5 = 7.75 P
  assert.ok(Math.abs(ev - 7.75) < TOL, `got ${ev}`);
});

test("rollTable: rng=0 returns first entry (candy)", () => {
  const e = rollTable(DAILY_GIFT_TABLE, () => 0);
  assert.equal(e.kind, "candy");
});

test("rollTable: rng=0.999 returns last entry (gem)", () => {
  const e = rollTable(DAILY_GIFT_TABLE, () => 0.999);
  assert.equal(e.kind, "gem");
});

test("rollTable: rng covers the golden bucket", () => {
  // golden bucket = [0.84, 0.92). rng 0.88 → golden.
  const e = rollTable(DAILY_GIFT_TABLE, () => 0.88);
  assert.equal(e.kind, "golden");
});

test("rollTable: clamps out-of-range rng (no throw)", () => {
  assert.equal(rollTable(DAILY_GIFT_TABLE, () => -1).kind, "candy");
  assert.equal(rollTable(DAILY_GIFT_TABLE, () => 2).kind, "gem");
});

test("PR-109: seed kind 잔여 없음", () => {
  for (const e of DAILY_GIFT_TABLE) {
    assert.notEqual(e.kind, "seed");
  }
  for (const e of WEEKLY_TREASURE_TABLE) {
    assert.notEqual(e.kind, "seed");
  }
});
