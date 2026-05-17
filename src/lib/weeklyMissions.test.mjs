/**
 * weeklyMissions (PR-76) — defs + weekKey 결정성.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/missions/weeklyMissions.ts",
  import.meta.url,
);
const {
  WEEKLY_MISSIONS,
  WEEKLY_ALL_COMPLETE_BONUS_P,
  weekKey,
  totalWeeklyEv,
} = mod;

test("WEEKLY_MISSIONS: 3개", () => {
  assert.equal(WEEKLY_MISSIONS.length, 3);
});

test("WEEKLY_MISSIONS: 학습 중심 type 매트릭스", () => {
  const types = WEEKLY_MISSIONS.map((m) => m.type).sort();
  assert.deepEqual(types, [
    "weeklyAttendDays5",
    "weeklyPerfectCombo5",
    "weeklyTotalFocusMin300",
  ]);
});

test("WEEKLY_MISSIONS: rewardP — 30 / 50 / 20", () => {
  const byType = Object.fromEntries(WEEKLY_MISSIONS.map((m) => [m.type, m]));
  assert.equal(byType.weeklyAttendDays5.rewardP, 30);
  assert.equal(byType.weeklyTotalFocusMin300.rewardP, 50);
  assert.equal(byType.weeklyPerfectCombo5.rewardP, 20);
});

test("WEEKLY_MISSIONS: threshold — 5 / 300 / 5", () => {
  const byType = Object.fromEntries(WEEKLY_MISSIONS.map((m) => [m.type, m]));
  assert.equal(byType.weeklyAttendDays5.threshold, 5);
  assert.equal(byType.weeklyTotalFocusMin300.threshold, 300);
  assert.equal(byType.weeklyPerfectCombo5.threshold, 5);
});

test("totalWeeklyEv: 30 + 50 + 20 + 20(bonus) = 120", () => {
  assert.equal(totalWeeklyEv(), 120);
});

test("WEEKLY_ALL_COMPLETE_BONUS_P === 20", () => {
  assert.equal(WEEKLY_ALL_COMPLETE_BONUS_P, 20);
});

// ─────────── weekKey 결정성 ───────────

function kstDateForUtc(y, m, d, h, mm) {
  // 입력은 KST. UTC = KST - 9.
  return new Date(Date.UTC(y, m - 1, d, h - 9, mm));
}

test("weekKey: 월요일 04:00 KST 가 anchor", () => {
  // 월요일 (2026-05-18) 03:59 KST → 이전 주 (2026-05-11)
  const before = kstDateForUtc(2026, 5, 18, 3, 59);
  assert.equal(weekKey(before), "2026-05-11");

  // 월요일 (2026-05-18) 04:00 KST → 이 주 시작
  const at = kstDateForUtc(2026, 5, 18, 4, 0);
  assert.equal(weekKey(at), "2026-05-18");

  // 월요일 (2026-05-18) 04:01 KST → 같음
  const after = kstDateForUtc(2026, 5, 18, 4, 1);
  assert.equal(weekKey(after), "2026-05-18");
});

test("weekKey: 주중 평일 → 같은 월요일", () => {
  // 2026-05-20 (Wed) 14:00 KST
  const wed = kstDateForUtc(2026, 5, 20, 14, 0);
  assert.equal(weekKey(wed), "2026-05-18");

  // 2026-05-22 (Fri) 23:30 KST
  const fri = kstDateForUtc(2026, 5, 22, 23, 30);
  assert.equal(weekKey(fri), "2026-05-18");
});

test("weekKey: 일요일 늦은 시간 → 같은 주 (월요일 새벽 4시 전)", () => {
  // 2026-05-24 (Sun) 23:00 KST
  const sun = kstDateForUtc(2026, 5, 24, 23, 0);
  assert.equal(weekKey(sun), "2026-05-18");

  // 2026-05-25 (Mon) 03:59 KST — 아직 이전 주
  const monEarly = kstDateForUtc(2026, 5, 25, 3, 59);
  assert.equal(weekKey(monEarly), "2026-05-18");

  // 2026-05-25 (Mon) 04:00 KST — 새 주
  const monStart = kstDateForUtc(2026, 5, 25, 4, 0);
  assert.equal(weekKey(monStart), "2026-05-25");
});

test("weekKey: 결정적 — 같은 입력 같은 결과", () => {
  const t = kstDateForUtc(2026, 5, 20, 14, 0);
  const a = weekKey(t);
  const b = weekKey(t);
  assert.equal(a, b);
});
