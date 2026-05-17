/**
 * bgmEngine pure-helper tests — Round 21 (PR-143).
 *
 * 베타7 피드백으로 routing 을 단순화: firstVisit / skyOpen / henesys
 * 3분기만. focus/kerning/ellinia 라우팅 제거 → 농장 세션 = 한 트랙으로
 * 쭉.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./bgmEngine.ts", import.meta.url);
const { pickTrackForContext } = mod;

const BASE_CTX = {
  firstVisit: false,
  skyOpen: false,
  focusActive: false,
  readyCrops: 0,
  growingCrops: 0,
};

test("pickTrackForContext: firstVisit overrides everything", () => {
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, firstVisit: true, focusActive: true }),
    "dawn",
  );
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, firstVisit: true, skyOpen: true }),
    "dawn",
  );
});

test("pickTrackForContext: skyOpen → skyview", () => {
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, skyOpen: true }),
    "skyview",
  );
  // crops / focus state 가 있어도 sky 가 우선
  assert.equal(
    pickTrackForContext({
      ...BASE_CTX,
      skyOpen: true,
      focusActive: true,
      readyCrops: 9,
    }),
    "skyview",
  );
});

test("pickTrackForContext: focusActive 무시 → henesys", () => {
  // R20 까지는 "focus" 였으나 R21 베타7 피드백으로 henesys 통일.
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, focusActive: true }),
    "henesys",
  );
});

test("pickTrackForContext: crops 상태 무시 → henesys", () => {
  // ≥3 ripe (이전 kerning), all growing (이전 ellinia) 모두 henesys.
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, readyCrops: 3 }),
    "henesys",
  );
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, readyCrops: 9 }),
    "henesys",
  );
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, growingCrops: 9 }),
    "henesys",
  );
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, growingCrops: 3, readyCrops: 1 }),
    "henesys",
  );
});

test("pickTrackForContext: 기본 idle → henesys", () => {
  assert.equal(pickTrackForContext(BASE_CTX), "henesys");
});
