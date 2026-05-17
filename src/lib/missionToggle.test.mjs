/**
 * missionToggle (PR-104) — pure helper 검증.
 *
 * 회귀 차단: PR-100 의 PAUSED 토글 차단 → PR-104 에서 FOCUSING 만으로
 * 좁힌 정책. forceCollapsed 가 true 일 때만 toggle 차단.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/missions/missionToggle.ts",
  import.meta.url,
);
const { computeExpanded, nextUserExpanded, canToggle } = mod;

test("computeExpanded: forceCollapsed true → 항상 false", () => {
  assert.equal(computeExpanded(true, true), false);
  assert.equal(computeExpanded(true, false), false);
});

test("computeExpanded: forceCollapsed false → userExpanded 반영", () => {
  assert.equal(computeExpanded(false, true), true);
  assert.equal(computeExpanded(false, false), false);
});

test("nextUserExpanded: forceCollapsed false → 반전", () => {
  assert.equal(nextUserExpanded(false, false), true);
  assert.equal(nextUserExpanded(false, true), false);
});

test("nextUserExpanded: forceCollapsed true → 변경 없음", () => {
  assert.equal(nextUserExpanded(true, false), false);
  assert.equal(nextUserExpanded(true, true), true);
});

test("canToggle: forceCollapsed 의 NOT", () => {
  assert.equal(canToggle(false), true);
  assert.equal(canToggle(true), false);
});

test("PR-104 회귀 차단: IDLE 시 (forceCollapsed=false) toggle 작동", () => {
  // 초기 collapsed
  let userExp = false;
  const forceCol = false; // IDLE
  // 사용자 tap
  if (canToggle(forceCol)) {
    userExp = nextUserExpanded(forceCol, userExp);
  }
  assert.equal(userExp, true);
  assert.equal(computeExpanded(forceCol, userExp), true);
  // 다시 tap
  if (canToggle(forceCol)) {
    userExp = nextUserExpanded(forceCol, userExp);
  }
  assert.equal(userExp, false);
});

test("PR-104: PAUSED 시 (forceCollapsed=false) 토글 허용 (PR-100 회귀 fix)", () => {
  // HomePage 가 forceCollapsed=isFocusing 만 사용 (PAUSED 제외)
  // 본 helper 는 forceCollapsed 만 알면 됨 → PAUSED 가 false 면 토글 OK
  const forceCol = false; // PAUSED → HomePage 가 false 전달
  assert.equal(canToggle(forceCol), true);
});

test("PR-104: FOCUSING 시 (forceCollapsed=true) 토글 차단", () => {
  const forceCol = true;
  assert.equal(canToggle(forceCol), false);
  // 시도해도 state 안 바뀜
  let userExp = true;
  if (canToggle(forceCol)) {
    userExp = nextUserExpanded(forceCol, userExp);
  }
  assert.equal(userExp, true); // 변경 안 됨
  // 표시는 force collapsed
  assert.equal(computeExpanded(forceCol, userExp), false);
});
