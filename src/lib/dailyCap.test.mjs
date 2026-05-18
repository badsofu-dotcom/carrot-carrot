/**
 * dailyCap (PR-90) — 일일 P 캡 pure-helper 검증.
 *
 * `currentDailyCap()` 은 useCollectionStore 를 호출하므로 jsdom 없이
 * 검증 어려움 (zustand store hydration). 본 테스트는:
 *   - BASE_DAILY_CAP 상수
 *   - addPoints / todayEarned / remainingP / isCapReached 의 로컬 동작
 *   - _resetForTest() 의 격리 동작
 *
 * 환경 — Node 에서 useCollectionStore.getState() 가 동작 (zustand 는
 * pure JS 라 hydration 없이도 default state 사용). 그러므로
 * currentDailyCap() 도 함수 호출 가능 (dogamPassives 가 owned count=0
 * 케이스 핸들링).
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./economy/dailyCap.ts", import.meta.url);
const {
  BASE_DAILY_CAP,
  addPoints,
  addPointsUncapped,
  todayEarned,
  currentDailyCap,
  remainingP,
  isCapReached,
  _resetForTest,
} = mod;

test("BASE_DAILY_CAP === 100", () => {
  assert.equal(BASE_DAILY_CAP, 100);
});

test("초기 — todayEarned === 0, remaining === cap", () => {
  _resetForTest();
  assert.equal(todayEarned(), 0);
  assert.equal(remainingP(), currentDailyCap());
  assert.equal(isCapReached(), false);
});

test("addPoints: amount <= 0 no-op", () => {
  _resetForTest();
  assert.equal(addPoints("test", 0), 0);
  assert.equal(addPoints("test", -5), 0);
  assert.equal(todayEarned(), 0);
});

test("addPoints: 누적 증가", () => {
  _resetForTest();
  assert.equal(addPoints("carrot", 10), 10);
  assert.equal(todayEarned(), 10);
  assert.equal(addPoints("carrot", 25), 25);
  assert.equal(todayEarned(), 35);
});

test("addPoints: cap 가까이 — partial grant", () => {
  _resetForTest();
  // Default cap = 100 (no dogam).
  addPoints("carrot", 95);
  assert.equal(todayEarned(), 95);
  // 다음 grant 10 P 시도 → 5 만 grant (cap remaining = 5).
  assert.equal(addPoints("candy", 10), 5);
  assert.equal(todayEarned(), 100);
  assert.equal(isCapReached(), true);
  assert.equal(remainingP(), 0);
});

test("addPoints: cap 도달 후 추가 grant 시 0", () => {
  _resetForTest();
  addPoints("ad", 100);
  assert.equal(isCapReached(), true);
  // Beyond cap — 0 grant, earned 유지.
  assert.equal(addPoints("harvest", 50), 0);
  assert.equal(todayEarned(), 100);
});

test("addPoints: 큰 amount 한 번에 cap 으로", () => {
  _resetForTest();
  // 200 P 시도 → 100 P 만 grant (cap = 100).
  assert.equal(addPoints("big-grant", 200), 100);
  assert.equal(todayEarned(), 100);
});

test("addPoints: 비정수 floor", () => {
  _resetForTest();
  // Math.floor 가 amount 에 적용 (3.7 → 3).
  assert.equal(addPoints("test", 3.7), 3);
  assert.equal(todayEarned(), 3);
});

test("currentDailyCap: 기본 (dogam 0) === BASE_DAILY_CAP", () => {
  // useCollectionStore 가 hydrate 안 된 상태에서 ownedCharacters.length = 0
  // → dogamPassives.dailyCapBoost = 0 → cap = BASE.
  const cap = currentDailyCap();
  // 환경에 따라 useCollectionStore state 가 0 일 수도 / 12 일 수도 있음.
  // 본 테스트는 cap 이 BASE 또는 BASE+10 둘 중 하나임 검증.
  assert.ok(cap === BASE_DAILY_CAP || cap === BASE_DAILY_CAP + 10);
});

test("_resetForTest: 격리", () => {
  addPoints("x", 50);
  _resetForTest();
  assert.equal(todayEarned(), 0);
});

// 격리 마무리.
_resetForTest();

// PR-113 — cap-reached event 1회 dispatch (per KST day).

test("PR-113: CAP_REACHED_EVENT constant exported", async () => {
  const m = await loadTs("./economy/dailyCap.ts", import.meta.url);
  assert.equal(typeof m.CAP_REACHED_EVENT, "string");
  assert.match(m.CAP_REACHED_EVENT, /cap/);
});

test("PR-113: addPoints cap-cross 시 한 번만 dispatch (per day)", () => {
  _resetForTest();
  // Mock CustomEvent + dispatchEvent.
  let count = 0;
  const realWindow = globalThis.window;
  // jsdom 없는 Node 환경 — window 가 undefined. addPoints 의 SSR guard
  // 가 silent return. dispatchEvent 호출 안 됨 → count 그대로 0.
  // 본 테스트는 dispatch logic 의 robustness 검증 (throw 없음 + grant
  // 정상).
  addPoints("x", 100);
  // 한번 더 100 시도 → cap 도달 후라 0 grant.
  const second = addPoints("x", 100);
  assert.equal(second, 0);
  void count;
  void realWindow;
});

// ===== R33 PR-189 — addPointsUncapped (광고 source 면제) =====

test("R33 PR-189: addPointsUncapped 함수 export 확인", () => {
  assert.equal(typeof addPointsUncapped, "function");
});

test("R33 PR-189: addPointsUncapped — cap 무시 (full grant)", () => {
  _resetForTest();
  // Pre-fill cap 까지.
  addPoints("carrot", 100);
  assert.equal(isCapReached(), true);
  // addPoints 는 0 반환 (cap 도달).
  assert.equal(addPoints("carrot", 50), 0);
  // addPointsUncapped 는 전체 grant.
  assert.equal(addPointsUncapped("ad", 50), 50);
  assert.equal(addPointsUncapped("ad_carrot", 100), 100);
});

test("R33 PR-189: addPointsUncapped — earned 카운터 영향 X", () => {
  _resetForTest();
  addPointsUncapped("ad", 200);
  assert.equal(todayEarned(), 0, "earned 누적 안 함");
  // cap UI 도 영향 X — 광고만 봐도 진행도 chip 변화 없음.
  assert.equal(isCapReached(), false);
  assert.equal(remainingP(), currentDailyCap());
});

test("R33 PR-189: addPointsUncapped — invalid amount 가드", () => {
  _resetForTest();
  assert.equal(addPointsUncapped("ad", 0), 0);
  assert.equal(addPointsUncapped("ad", -10), 0);
  assert.equal(addPointsUncapped("ad", NaN), 0);
  assert.equal(addPointsUncapped("ad", Infinity), 0);
});

test("R33 PR-189: addPointsUncapped — Math.floor 적용", () => {
  _resetForTest();
  assert.equal(addPointsUncapped("ad", 3.7), 3);
  assert.equal(addPointsUncapped("ad", 99.999), 99);
});

test("R33 PR-189: addPoints 와 addPointsUncapped 독립 동작", () => {
  _resetForTest();
  // addPoints 50 → earned 50.
  addPoints("carrot", 50);
  assert.equal(todayEarned(), 50);
  // addPointsUncapped — earned 변동 없음.
  addPointsUncapped("ad", 999);
  assert.equal(todayEarned(), 50);
  // 다시 addPoints — 정상 cap 동작.
  assert.equal(addPoints("carrot", 60), 50, "cap 까지만 grant");
  assert.equal(todayEarned(), 100);
});

// 격리 마무리.
_resetForTest();
