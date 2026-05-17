/**
 * Threshold tests for `getFocusFarmReward` and `getFocusFarmRewardFromMs`.
 *
 * PR-109 — 씨앗 자원 폐기. seedDelta 필드 제거됨. 모든 tier 가 growSteps
 * + tier 식별자만 grant.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./farmRules.ts", import.meta.url);
const { getFocusFarmReward, getFocusFarmRewardFromMs, MIN_VALID_MINUTES } = mod;

test("MIN_VALID_MINUTES constant", () => {
  assert.equal(MIN_VALID_MINUTES, 5);
});

test("gate boundary: 4 minutes → gated", () => {
  const r = getFocusFarmReward(4);
  assert.equal(r.valid, false);
  assert.equal(r.growSteps, 0);
  assert.equal(r.tier, "gated");
  assert.match(r.message, /5분/);
});

test("gate boundary: 4.999 minutes → gated (floor)", () => {
  assert.equal(getFocusFarmReward(4.999).tier, "gated");
});

test("tier t5 lower: 5 minutes → growSteps 1", () => {
  const r = getFocusFarmReward(5);
  assert.equal(r.valid, true);
  assert.equal(r.growSteps, 1);
  assert.equal(r.tier, "t5");
});

test("tier t5 upper: 14 minutes", () => {
  const r = getFocusFarmReward(14);
  assert.equal(r.growSteps, 1);
  assert.equal(r.tier, "t5");
});

test("tier t15 lower: 15 minutes", () => {
  const r = getFocusFarmReward(15);
  assert.equal(r.growSteps, 1);
  assert.equal(r.tier, "t15");
});

test("tier t15 upper: 29 minutes", () => {
  const r = getFocusFarmReward(29);
  assert.equal(r.growSteps, 1);
  assert.equal(r.tier, "t15");
});

test("tier t30 lower: 30 minutes", () => {
  const r = getFocusFarmReward(30);
  assert.equal(r.growSteps, 2);
  assert.equal(r.tier, "t30");
});

test("tier t30 upper: 49 minutes", () => {
  const r = getFocusFarmReward(49);
  assert.equal(r.growSteps, 2);
  assert.equal(r.tier, "t30");
});

test("tier t50 lower: 50 minutes", () => {
  const r = getFocusFarmReward(50);
  assert.equal(r.growSteps, 3);
  assert.equal(r.tier, "t50");
});

test("tier t50 upper: 120 minutes still t50", () => {
  const r = getFocusFarmReward(120);
  assert.equal(r.tier, "t50");
  assert.equal(r.growSteps, 3);
});

test("negative / NaN minutes → gated", () => {
  assert.equal(getFocusFarmReward(-1).tier, "gated");
  assert.equal(getFocusFarmReward(NaN).tier, "gated");
});

test("from ms helper: 4*60_000 → gated", () => {
  assert.equal(getFocusFarmRewardFromMs(4 * 60_000).tier, "gated");
});

test("from ms helper: 25*60_000 → t15", () => {
  assert.equal(getFocusFarmRewardFromMs(25 * 60_000).tier, "t15");
});

test("from ms helper: 50*60_000 → t50", () => {
  assert.equal(getFocusFarmRewardFromMs(50 * 60_000).tier, "t50");
});

test("PR-109: seedDelta 필드 더 이상 존재 안 함", () => {
  const r = getFocusFarmReward(50);
  assert.equal(r.seedDelta, undefined);
});

test("PR-109: message 에 '씨앗' 단어 없음", () => {
  for (const min of [5, 15, 30, 50]) {
    const r = getFocusFarmReward(min);
    assert.equal(r.message.includes("씨앗"), false, `${min}분 message 에 씨앗 잔여`);
  }
});
