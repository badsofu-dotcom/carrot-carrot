/**
 * dogamPassives unit tests — 임계값별 누적 활성화 확인.
 * PR-71 — 12-char universe (CHARACTERS.length = 12) 기준 임계
 * 1/2/4/6/9/12.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./dogamPassives.ts", import.meta.url);
const { passivesFromOwned, nextPassiveLabel } = mod;

test("0 마리: 모든 패시브 0", () => {
  const p = passivesFromOwned(0);
  assert.equal(p.candyBonusP, 0);
  assert.equal(p.goldenBonusP, 0);
  assert.equal(p.sessionCarrotMul, 1);
  assert.equal(p.adRewardBonusCarrot, 0);
  assert.equal(p.giftBoostX, 1);
  assert.equal(p.dailyCapBoost, 0);
});

test("1 마리: 캔디 +0.1%p", () => {
  const p = passivesFromOwned(1);
  assert.equal(p.candyBonusP, 0.001);
  assert.equal(p.goldenBonusP, 0);
});

test("2 마리: 캔디 + 황금 +0.1%p", () => {
  const p = passivesFromOwned(2);
  assert.equal(p.candyBonusP, 0.001);
  assert.equal(p.goldenBonusP, 0.001);
  assert.equal(p.sessionCarrotMul, 1);
});

test("4 마리: 세션 carrot mul 1.05", () => {
  const p = passivesFromOwned(4);
  assert.equal(p.sessionCarrotMul, 1.05);
  assert.equal(p.adRewardBonusCarrot, 0);
});

test("6 마리: 광고 보상 +1 carrot", () => {
  const p = passivesFromOwned(6);
  assert.equal(p.adRewardBonusCarrot, 1);
  assert.equal(p.giftBoostX, 1);
});

test("9 마리: gift boost ×1.5", () => {
  const p = passivesFromOwned(9);
  assert.equal(p.giftBoostX, 1.5);
  assert.equal(p.dailyCapBoost, 0);
});

test("12 마리 (전체): 일일 P 캡 +10", () => {
  const p = passivesFromOwned(12);
  assert.equal(p.dailyCapBoost, 10);
  // 캐스케이드 — 모든 효과 활성
  assert.equal(p.candyBonusP, 0.001);
  assert.equal(p.goldenBonusP, 0.001);
  assert.equal(p.sessionCarrotMul, 1.05);
  assert.equal(p.adRewardBonusCarrot, 1);
  assert.equal(p.giftBoostX, 1.5);
});

test("nextPassiveLabel: 임계 직전 라벨", () => {
  assert.equal(nextPassiveLabel(0), "1마리: 캔디 확률 +0.1%p");
  assert.equal(nextPassiveLabel(1), "2마리: 황금 확률 +0.1%p");
  assert.equal(nextPassiveLabel(3), "4마리: 세션 당근 +5%");
  assert.equal(nextPassiveLabel(5), "6마리: 광고 보상 +1 당근");
  assert.equal(nextPassiveLabel(8), "9마리: 오늘의 선물 보너스 +50%");
  assert.equal(
    nextPassiveLabel(11),
    "12마리: 일일 P 캡 100 → 110 (도감 완성)",
  );
  assert.equal(nextPassiveLabel(12), null);
});
