/**
 * bgmEngine pure-helper tests — Round 24 (PR-149).
 *
 * 사용자 검수 완료: focus / henesys 영구 제거. dawn / ellinia / kerning /
 * skyview 만 활성. pickTrackForContext 4트랙 routing 검증 + banlist 회귀
 * 방지 강화.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./bgmEngine.ts", import.meta.url);
const { pickTrackForContext, ACTIVE_BGM_TRACKS } = mod;

const BASE_CTX = {
  firstVisit: false,
  skyOpen: false,
  focusActive: false,
  readyCrops: 0,
  growingCrops: 0,
};

test("ACTIVE_BGM_TRACKS: 4 트랙 (dawn / ellinia / kerning / skyview)", () => {
  assert.equal(ACTIVE_BGM_TRACKS.length, 4);
  for (const t of ["dawn", "ellinia", "kerning", "skyview"]) {
    assert.ok(ACTIVE_BGM_TRACKS.includes(t), `missing track: ${t}`);
  }
});

test("ACTIVE_BGM_TRACKS: focus / henesys 영구 제거됨", () => {
  // R24 사용자 검수 결과 — 다시 추가되면 사용자 보고 트럼펫 회귀.
  assert.ok(
    !ACTIVE_BGM_TRACKS.includes("focus"),
    "focus 트랙 재추가됨 — 사용자 검수 위반",
  );
  assert.ok(
    !ACTIVE_BGM_TRACKS.includes("henesys"),
    "henesys 트랙 재추가됨 — 사용자 검수 위반",
  );
});

test("pickTrackForContext: firstVisit → dawn (모든 다른 ctx 무관)", () => {
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, firstVisit: true }),
    "dawn",
  );
  assert.equal(
    pickTrackForContext({
      ...BASE_CTX,
      firstVisit: true,
      skyOpen: true,
      readyCrops: 9,
    }),
    "dawn",
  );
});

test("pickTrackForContext: skyOpen → skyview", () => {
  assert.equal(
    pickTrackForContext({ ...BASE_CTX, skyOpen: true }),
    "skyview",
  );
  // 작물 상태 무관
  assert.equal(
    pickTrackForContext({
      ...BASE_CTX,
      skyOpen: true,
      readyCrops: 9,
    }),
    "skyview",
  );
});

test("pickTrackForContext: crop 상태 변화에도 트랙 동일 (R26 회귀 방지)", () => {
  // R24 에선 readyCrops≥3 → kerning, all growing → ellinia 로 갈렸으나
  // 베타12 사용자 회귀 ("수확 단계마다 BGM 바뀜") 으로 R21 의 "한 트랙으로
  // 쭉" 원칙 회복. firstVisit / skyOpen 외에는 crop 상태 무관 dawn.
  const variants = [
    { readyCrops: 0, growingCrops: 0 },
    { readyCrops: 0, growingCrops: 1 },
    { readyCrops: 0, growingCrops: 9 },
    { readyCrops: 2, growingCrops: 5 },
    { readyCrops: 3, growingCrops: 0 },
    { readyCrops: 9, growingCrops: 0 },
  ];
  for (const v of variants) {
    assert.equal(
      pickTrackForContext({ ...BASE_CTX, ...v }),
      "dawn",
      `crop variant ${JSON.stringify(v)} should map to dawn`,
    );
  }
});

test("pickTrackForContext: 빈 농장 idle → dawn (default)", () => {
  assert.equal(pickTrackForContext(BASE_CTX), "dawn");
});

test("pickTrackForContext: 모든 ctx 조합 → focus/henesys 반환 금지", () => {
  // brute-force 64 ctx 조합 시뮬 (5 bool * 4 crop 변형 ≈ 충분).
  const cropCombos = [
    { readyCrops: 0, growingCrops: 0 },
    { readyCrops: 0, growingCrops: 5 },
    { readyCrops: 2, growingCrops: 3 },
    { readyCrops: 5, growingCrops: 0 },
  ];
  for (const firstVisit of [false, true]) {
    for (const skyOpen of [false, true]) {
      for (const focusActive of [false, true]) {
        for (const crops of cropCombos) {
          const t = pickTrackForContext({
            firstVisit,
            skyOpen,
            focusActive,
            ...crops,
          });
          assert.ok(
            ACTIVE_BGM_TRACKS.includes(t),
            `pickTrackForContext returned banned track: ${t}`,
          );
          assert.notEqual(t, "focus");
          assert.notEqual(t, "henesys");
        }
      }
    }
  }
});

test("BGM 트랙 키워드 banlist (회귀 방지)", () => {
  // 모든 활성 트랙 id 에 brass/horn 류 키워드 없음.
  const banned = [
    "trumpet",
    "fanfare",
    "march",
    "horn",
    "brass",
    // R24 사용자 검수 결과 영구 제거된 트랙명도 차단:
    "focus",
    "henesys",
  ];
  for (const t of ACTIVE_BGM_TRACKS) {
    for (const b of banned) {
      assert.ok(
        !t.toLowerCase().includes(b),
        `BGM track id 에 금지 키워드 발견: ${t} contains ${b}`,
      );
    }
  }
});
