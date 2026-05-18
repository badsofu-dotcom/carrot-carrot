/**
 * streakStore pure-helper 테스트 (R34 PR-204).
 *
 * computeNextStreak / streakReward 의 day 비교 + 보상 산정 검증.
 * zustand store 자체는 safeStorage 의존이라 unit test 어려움 — 순수
 * helper 만 검증.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/collection/streakStore.ts",
  import.meta.url,
);
const {
  computeNextStreak,
  streakReward,
  STREAK_BASE_REWARD,
  STREAK_MAX_REWARD,
} = mod;

test("STREAK_BASE_REWARD === 5, STREAK_MAX_REWARD === 10", () => {
  assert.equal(STREAK_BASE_REWARD, 5);
  assert.equal(STREAK_MAX_REWARD, 10);
});

test("streakReward: day 1 → 5", () => {
  assert.equal(streakReward(1), 5);
});

test("streakReward: day 2 → 6, day 3 → 7, day 5 → 9, day 6 → 10", () => {
  assert.equal(streakReward(2), 6);
  assert.equal(streakReward(3), 7);
  assert.equal(streakReward(5), 9);
  assert.equal(streakReward(6), 10);
});

test("streakReward: day 7+ 모두 10 (cap)", () => {
  assert.equal(streakReward(7), 10);
  assert.equal(streakReward(10), 10);
  assert.equal(streakReward(30), 10);
});

test("streakReward: 0 / negative / NaN → 0", () => {
  assert.equal(streakReward(0), 0);
  assert.equal(streakReward(-1), 0);
  assert.equal(streakReward(NaN), 0);
});

test("computeNextStreak: 첫 로그인 (lastClaimedDay null) → streak 1", () => {
  const r = computeNextStreak("2026-05-18", null, 0);
  assert.equal(r.nextStreak, 1);
  assert.equal(r.alreadyClaimedToday, false);
});

test("computeNextStreak: 오늘 이미 수령 → no-op + alreadyClaimedToday true", () => {
  const r = computeNextStreak("2026-05-18", "2026-05-18", 5);
  assert.equal(r.nextStreak, 5);
  assert.equal(r.alreadyClaimedToday, true);
});

test("computeNextStreak: 어제 수령 → streak +1", () => {
  const r = computeNextStreak("2026-05-18", "2026-05-17", 3);
  assert.equal(r.nextStreak, 4);
  assert.equal(r.alreadyClaimedToday, false);
});

test("computeNextStreak: 2일 결석 → streak reset (1)", () => {
  const r = computeNextStreak("2026-05-18", "2026-05-15", 10);
  assert.equal(r.nextStreak, 1);
  assert.equal(r.alreadyClaimedToday, false);
});

test("computeNextStreak: 월 경계 (29 → 30) → streak +1", () => {
  const r = computeNextStreak("2026-05-30", "2026-05-29", 7);
  assert.equal(r.nextStreak, 8);
});

test("computeNextStreak: 월 경계 (마지막 날 → 1일) → streak +1", () => {
  const r = computeNextStreak("2026-06-01", "2026-05-31", 12);
  assert.equal(r.nextStreak, 13);
});

test("computeNextStreak: 년 경계 (12-31 → 01-01) → streak +1", () => {
  const r = computeNextStreak("2027-01-01", "2026-12-31", 20);
  assert.equal(r.nextStreak, 21);
});

test("computeNextStreak: 일주일 결석 → reset", () => {
  const r = computeNextStreak("2026-05-18", "2026-05-11", 7);
  assert.equal(r.nextStreak, 1);
});

test("computeNextStreak: 미래 lastClaimedDay (clock skew) → reset", () => {
  // 이론상 발생 안 되지만 시계 변경 / TZ bug 방어.
  const r = computeNextStreak("2026-05-18", "2026-05-20", 5);
  assert.equal(r.nextStreak, 1);
});

// 30일 streak 시나리오 — 사용자 1month 목표 시뮬레이션.
test("30일 시나리오: 총 보너스 carrot = 5+6+7+8+9+10 + 10*24 = 285", () => {
  let total = 0;
  for (let day = 1; day <= 30; day++) {
    total += streakReward(day);
  }
  // 5+6+7+8+9+10 = 45 (day 1-6), 10*24 = 240 (day 7-30) → 285.
  assert.equal(total, 285);
});
