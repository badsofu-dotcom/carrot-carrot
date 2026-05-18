/**
 * POINT_VALUES + MIN_PAYOUT 보존 검증.
 *
 * R34 PR-203 — pointsFor / totalPoints / canWithdraw 모두 제거 (호출
 * 사이트 0건 확인). POINT_VALUES (internal accounting unit) 와
 * MIN_PAYOUT (정식 출시 시 출금 단위) 만 유지.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./points.ts", import.meta.url);
const { MIN_PAYOUT, POINT_VALUES } = mod;

test("POINT_VALUES table — carrot=1 / candy=5 / golden=10", () => {
  assert.equal(POINT_VALUES.carrot, 1);
  assert.equal(POINT_VALUES.candy, 5);
  assert.equal(POINT_VALUES.golden, 10);
});

test("POINT_VALUES — 3 종만 정의 (carrot/candy/golden)", () => {
  assert.equal(Object.keys(POINT_VALUES).length, 3);
});

test("MIN_PAYOUT === 50 (dormant — 정식 출시 시 출금 단위)", () => {
  assert.equal(MIN_PAYOUT, 50);
});
