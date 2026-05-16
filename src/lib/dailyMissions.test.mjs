/**
 * dailyMissions — pool + pick 결정성 검증 (PR-52).
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

test("MISSION_POOL: 12 missions, no duplicate types", () => {
  assert.equal(MISSION_POOL.length, 12);
  const types = new Set(MISSION_POOL.map((m) => m.type));
  assert.equal(types.size, MISSION_POOL.length);
});

test("DAILY_MISSION_COUNT === 3", () => {
  assert.equal(DAILY_MISSION_COUNT, 3);
});

test("ALL_COMPLETE_BONUS_P === 5", () => {
  assert.equal(ALL_COMPLETE_BONUS_P, 5);
});

test("모든 미션 reward 1~10 P 사이", () => {
  for (const m of MISSION_POOL) {
    assert.ok(m.rewardP >= 1 && m.rewardP <= 10, `${m.type} reward ${m.rewardP}`);
  }
});

test("pickDailyMissions: 같은 day → 같은 3개 (결정적)", () => {
  const day = "2026-05-16";
  const a = pickDailyMissions(day);
  const b = pickDailyMissions(day);
  assert.equal(a.length, 3);
  assert.equal(b.length, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(a[i].type, b[i].type);
  }
});

test("pickDailyMissions: 다른 day → 다른 (또는 부분 다른) pick", () => {
  const a = pickDailyMissions("2026-05-16");
  const b = pickDailyMissions("2026-05-17");
  const aTypes = new Set(a.map((m) => m.type));
  const bTypes = new Set(b.map((m) => m.type));
  // 일부라도 다르게 — 확률적으로 5%/일 같으면 통과 안 하므로 OK.
  let differs = false;
  for (const t of aTypes) if (!bTypes.has(t)) differs = true;
  assert.ok(differs, `같은 set: ${[...aTypes].join(",")}`);
});

test("pickDailyMissions: 결과 미션 중복 없음", () => {
  const picks = pickDailyMissions("2026-05-16");
  const types = new Set(picks.map((m) => m.type));
  assert.equal(types.size, picks.length);
});

test("totalMissionEv: missions reward 합 + bonus", () => {
  const picks = pickDailyMissions("2026-05-16");
  const expected = picks.reduce((s, m) => s + m.rewardP, 0) + 5;
  assert.equal(totalMissionEv(picks), expected);
});
