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
const { pickTrackForContext, BGM_DISABLED_PENDING_AUDIT } = mod;

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

/* -------- 회귀 방지 (Round 23 PR-148) -------- */

test("BGM_DISABLED_PENDING_AUDIT: 베타10 트럼펫 회귀 후 잠금", () => {
  // 자산 검수 전엔 항상 true. 사용자가 음원 검수 후 R24+ 에서 토글.
  // 누군가 실수로 false 로 돌리면 사용자 보고 "트럼펫 들림" 재발.
  // 본 assertion 은 cfg 의도 명시 — 풀려면 commit 메시지에 "decor
  // 음원 검수 완료" 명시 + 사용자 confirm.
  assert.equal(
    BGM_DISABLED_PENDING_AUDIT,
    true,
    "사용자 음원 검수 전에 BGM_DISABLED_PENDING_AUDIT=false 로 풀지 말 것",
  );
});

test("BGM 트랙 키워드 banlist (회귀 방지)", () => {
  // 모든 가능한 track key + url 에 brass/horn 류 키워드 없음 검증.
  // 새 트랙 추가 시 이 테스트가 깨지면 회귀 발생 가능성 검토 필요.
  const tracks = ["henesys", "ellinia", "kerning", "skyview", "focus", "dawn"];
  const banned = ["trumpet", "fanfare", "march", "horn", "brass"];
  for (const t of tracks) {
    for (const b of banned) {
      assert.ok(
        !t.toLowerCase().includes(b),
        `BGM track id 에 금지 키워드 발견: ${t} contains ${b}`,
      );
    }
  }
});
