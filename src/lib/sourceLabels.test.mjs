/**
 * sourceLabels (PR-73) unit tests — 영어 토큰 → 한국어 변환.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./i18n/sourceLabels.ts", import.meta.url);
const { translateAcquisition, toLabel, KOREAN_TOKEN_LABELS } = mod;

test("toLabel: 알려진 토큰 매핑", () => {
  assert.equal(toLabel("daily-gift"), "일일 선물");
  assert.equal(toLabel("focus-tier"), "집중 보상 (25/50분)");
  assert.equal(toLabel("weekly-treasure"), "주간 보물상자");
  assert.equal(toLabel("cake"), "케이크 사용");
  // PR-109 — gem 5→9 (씨앗) → gem 5→3 (캔디당근).
  assert.equal(toLabel("gem 5→3"), "보석 5개 → 캔디당근 3개 교환");
});

test("toLabel: 모르는 토큰은 그대로 통과 (한국어 fallback)", () => {
  assert.equal(toLabel("수확"), "수확");
  assert.equal(toLabel("농장 드랍"), "농장 드랍");
  assert.equal(toLabel("자정 리필 + 이웃 토끼 wave"), "자정 리필 + 이웃 토끼 wave");
});

test("translateAcquisition: gem 교환 토큰 변환 (PR-109)", () => {
  const input = "daily-gift / focus-tier / cake / weekly-treasure / gem 5→3";
  const out = translateAcquisition(input);
  assert.equal(
    out,
    "일일 선물 / 집중 보상 (25/50분) / 케이크 사용 / 주간 보물상자 / 보석 5개 → 캔디당근 3개 교환",
  );
});

test("translateAcquisition: 이미 한국어 텍스트는 unchanged", () => {
  const input = "수확 / 수확 보너스 / 농장 드랍";
  // 첫 두개는 그대로 통과 (매핑 없음), 세번째도 그대로.
  // 단 harvest-bonus 가 매핑되어 있어 "수확 보너스" 와 별개라 그대로.
  assert.equal(translateAcquisition(input), "수확 / 수확 보너스 / 농장 드랍");
});

test("translateAcquisition: 단일 토큰", () => {
  assert.equal(translateAcquisition("daily-gift"), "일일 선물");
  assert.equal(translateAcquisition("수확"), "수확");
});

test("translateAcquisition: 빈 문자열 안전", () => {
  assert.equal(translateAcquisition(""), "");
});

test("KOREAN_TOKEN_LABELS: 최소 핵심 토큰 정의", () => {
  for (const t of ["daily-gift", "focus-tier", "weekly-treasure", "cake"]) {
    assert.ok(KOREAN_TOKEN_LABELS[t], `${t} 매핑 누락`);
  }
});
