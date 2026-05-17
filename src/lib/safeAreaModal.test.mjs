/**
 * safeAreaModal (PR-79) — 공통 모달 스타일 유틸 검증.
 *
 * 본 테스트는 style 값이 안전 키 (safe-area, dvh, overflow auto) 를
 * 포함하는지 정적으로 검증. 실제 layout 은 visual / e2e 테스트 영역
 * 이지만 본 unit 으로 회귀 차단.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./ui/safeAreaModal.ts", import.meta.url);
const { safeAreaModalStyle, safeAreaBackdropStyle } = mod;

test("safeAreaModalStyle: default maxWidth 360", () => {
  const s = safeAreaModalStyle();
  assert.equal(s.maxWidth, 360);
});

test("safeAreaModalStyle: maxWidth override", () => {
  const s = safeAreaModalStyle({ maxWidth: 420 });
  assert.equal(s.maxWidth, 420);
});

test("safeAreaModalStyle: padding bottom 에 safe-area-inset-bottom", () => {
  const s = safeAreaModalStyle();
  // padding 문자열에 env(safe-area-inset-bottom) 포함.
  assert.match(s.padding, /env\(safe-area-inset-bottom\)/);
});

test("safeAreaModalStyle: maxHeight dvh + safe-area", () => {
  const s = safeAreaModalStyle();
  assert.match(s.maxHeight, /100dvh/);
  assert.match(s.maxHeight, /env\(safe-area-inset-top\)/);
  assert.match(s.maxHeight, /env\(safe-area-inset-bottom\)/);
});

test("safeAreaModalStyle: overflowY auto", () => {
  const s = safeAreaModalStyle();
  assert.equal(s.overflowY, "auto");
});

test("safeAreaModalStyle: boxSizing border-box", () => {
  const s = safeAreaModalStyle();
  assert.equal(s.boxSizing, "border-box");
});

test("safeAreaBackdropStyle: fixed inset:0 + flex centering", () => {
  assert.equal(safeAreaBackdropStyle.position, "fixed");
  assert.equal(safeAreaBackdropStyle.inset, 0);
  assert.equal(safeAreaBackdropStyle.display, "flex");
  assert.equal(safeAreaBackdropStyle.alignItems, "center");
  assert.equal(safeAreaBackdropStyle.justifyContent, "center");
});

test("safeAreaBackdropStyle: 4면 safe-area padding (PR-82 강화)", () => {
  assert.match(safeAreaBackdropStyle.padding, /env\(safe-area-inset-top\)/);
  assert.match(safeAreaBackdropStyle.padding, /env\(safe-area-inset-right\)/);
  assert.match(safeAreaBackdropStyle.padding, /env\(safe-area-inset-bottom\)/);
  assert.match(safeAreaBackdropStyle.padding, /env\(safe-area-inset-left\)/);
});

test("safeAreaModalStyle: gutter 32 default — small viewport 여유", () => {
  const s = safeAreaModalStyle();
  // gutter 가 32 면 maxHeight 식에 - 32px 가 들어감.
  assert.match(s.maxHeight, /32px/);
});

test("safeAreaModalStyle: gutter override", () => {
  const s = safeAreaModalStyle({ gutter: 64 });
  assert.match(s.maxHeight, /64px/);
});

// PR-82 — viewport-specific computation 시뮬레이션. 실 layout 은 jsdom
// 없이 검증 어려우므로 maxHeight CSS expression 이 viewport 기반 계산
// 인지만 정적 검증 (회귀 차단).

test("PR-82: safeAreaModalStyle maxHeight 식에 100dvh 포함 (viewport-relative)", () => {
  const s = safeAreaModalStyle();
  // 375x667 (iPhone SE) 등 small viewport 도 100dvh 가 그 viewport
  // 높이로 평가됨. maxHeight 가 fixed px 가 아니라 dvh 인지 검증.
  assert.match(s.maxHeight, /100dvh/);
  assert.equal(s.maxHeight.includes("90vh"), false, "고정 90vh 회귀");
});

test("PR-82: backdrop padding 4면 모두 16+safe-area", () => {
  // safeAreaBackdropStyle.padding 의 4 값 모두 calc(16px + ...).
  const padding = safeAreaBackdropStyle.padding;
  // 4 개의 "calc(16px" 조각 확인.
  const matches = padding.match(/calc\(16px \+ env/g);
  assert.equal(matches.length, 4, `padding 4면 모두 calc 아님: ${padding}`);
});
