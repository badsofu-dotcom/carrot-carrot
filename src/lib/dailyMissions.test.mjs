/**
 * dailyMissions — 학습 중심 고정 3 미션 검증 (PR-52 → PR-75).
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("../features/missions/dailyMissions.ts", import.meta.url);
const {
  MISSION_POOL,
  DAILY_MISSION_COUNT,
  ALL_COMPLETE_BONUS_P,
  pickDailyMissions,
  totalMissionEv,
} = mod;

test("MISSION_POOL: 고정 3개 학습 중심 미션", () => {
  assert.equal(MISSION_POOL.length, 3);
  const types = MISSION_POOL.map((m) => m.type).sort();
  assert.deepEqual(types, ["min25Sessions2", "perfectCombo1", "totalFocusMin50"]);
});

test("MISSION_POOL: 게임 강제 미션 제거 — tool_use, ad_watch 없음", () => {
  const types = new Set(MISSION_POOL.map((m) => m.type));
  assert.equal(types.has("tool_use"), false);
  assert.equal(types.has("ad_watch"), false);
  assert.equal(types.has("drop_pickup"), false);
  assert.equal(types.has("candy_harvest"), false);
});

test("DAILY_MISSION_COUNT === 3", () => {
  assert.equal(DAILY_MISSION_COUNT, 3);
});

test("ALL_COMPLETE_BONUS_P === 5", () => {
  assert.equal(ALL_COMPLETE_BONUS_P, 5);
});

test("미션 reward — min25Sessions2 +10P, totalFocusMin50 +15P, perfectCombo1 +5P", () => {
  const byType = Object.fromEntries(MISSION_POOL.map((m) => [m.type, m]));
  assert.equal(byType.min25Sessions2.rewardP, 10);
  assert.equal(byType.totalFocusMin50.rewardP, 15);
  assert.equal(byType.perfectCombo1.rewardP, 5);
});

test("미션 threshold — 2 / 50 / 1", () => {
  const byType = Object.fromEntries(MISSION_POOL.map((m) => [m.type, m]));
  assert.equal(byType.min25Sessions2.threshold, 2);
  assert.equal(byType.totalFocusMin50.threshold, 50);
  assert.equal(byType.perfectCombo1.threshold, 1);
});

test("pickDailyMissions: 어떤 day 도 같은 3개 반환 (고정)", () => {
  const a = pickDailyMissions("2026-05-16");
  const b = pickDailyMissions("2026-05-17");
  const c = pickDailyMissions("2027-01-01");
  for (let i = 0; i < 3; i++) {
    assert.equal(a[i].type, b[i].type);
    assert.equal(b[i].type, c[i].type);
  }
});

test("pickDailyMissions: 결과 3개", () => {
  const picks = pickDailyMissions("2026-05-16");
  assert.equal(picks.length, 3);
});

test("totalMissionEv: 10 + 15 + 5 + 5(bonus) = 35", () => {
  const picks = pickDailyMissions("2026-05-16");
  assert.equal(totalMissionEv(picks), 35);
});

test("미션 한국어 title — 사용자 친화", () => {
  const byType = Object.fromEntries(MISSION_POOL.map((m) => [m.type, m]));
  assert.equal(byType.min25Sessions2.title, "25분 이상 집중 2회");
  assert.equal(byType.totalFocusMin50.title, "오늘 누적 50분 집중");
  assert.equal(byType.perfectCombo1.title, "퍼펙트 콤보 1회");
});
