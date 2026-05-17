/**
 * farmHelpers (PR-91) — pure predicate 검증.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./farmHelpers.ts", import.meta.url);
const {
  canGrowAnyStages,
  isFarmEmpty,
  isFarmAllRipe,
  hourglassBlockReason,
} = mod;

test("canGrowAnyStages: 모두 0 → false (빈 밭)", () => {
  assert.equal(canGrowAnyStages([0, 0, 0, 0, 0, 0, 0, 0, 0]), false);
});

test("canGrowAnyStages: 모두 4 (만렙) → false", () => {
  assert.equal(canGrowAnyStages([4, 4, 4, 4, 4, 4, 4, 4, 4]), false);
});

test("canGrowAnyStages: 1..3 하나라도 → true", () => {
  assert.equal(canGrowAnyStages([0, 0, 1, 0, 0, 0, 0, 0, 0]), true);
  assert.equal(canGrowAnyStages([4, 4, 3, 4, 4, 4, 4, 4, 4]), true);
  assert.equal(canGrowAnyStages([0, 4, 2, 4, 0, 1, 0, 0, 0]), true);
});

test("isFarmEmpty: 모두 0 → true", () => {
  assert.equal(isFarmEmpty([0, 0, 0, 0, 0, 0, 0, 0, 0]), true);
});

test("isFarmEmpty: 하나라도 > 0 → false", () => {
  assert.equal(isFarmEmpty([0, 1, 0, 0, 0, 0, 0, 0, 0]), false);
  assert.equal(isFarmEmpty([0, 4, 0, 0, 0, 0, 0, 0, 0]), false);
});

test("isFarmAllRipe: 모두 4 → true", () => {
  assert.equal(isFarmAllRipe([4, 4, 4, 4, 4, 4, 4, 4, 4]), true);
});

test("isFarmAllRipe: 빈 plot 섞여있으면 false", () => {
  assert.equal(isFarmAllRipe([4, 4, 0, 4, 4, 4, 4, 4, 4]), false);
});

test("isFarmAllRipe: 빈 밭 (모두 0) → false (아무것도 심지 않음)", () => {
  assert.equal(isFarmAllRipe([0, 0, 0, 0, 0, 0, 0, 0, 0]), false);
});

test("hourglassBlockReason: 빈 밭 → 'empty'", () => {
  assert.equal(
    hourglassBlockReason([0, 0, 0, 0, 0, 0, 0, 0, 0]),
    "empty",
  );
});

test("hourglassBlockReason: 모두 만렙 → 'all-ripe'", () => {
  assert.equal(
    hourglassBlockReason([4, 4, 4, 4, 4, 4, 4, 4, 4]),
    "all-ripe",
  );
});

test("hourglassBlockReason: 빈 plot + 만렙 mixed → 'all-grown-mixed'", () => {
  // 일부 plot 빈, 나머지 모두 stage 4 → 성장 가능한 plot 없음.
  assert.equal(
    hourglassBlockReason([4, 0, 4, 4, 0, 4, 4, 4, 4]),
    "all-grown-mixed",
  );
});

test("hourglassBlockReason: 성장 가능 1..3 있으면 null", () => {
  assert.equal(
    hourglassBlockReason([0, 1, 2, 3, 4, 0, 0, 0, 0]),
    null,
  );
  assert.equal(
    hourglassBlockReason([4, 4, 2, 4, 4, 4, 4, 4, 4]),
    null,
  );
});
