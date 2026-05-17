/**
 * Dark mode contrast (PR-80) — WCAG AA 검증.
 *
 * PR-80 이 `--text-tertiary` dark variant 를 `#807260` → `#b3a691` 로
 * 상향. WCAG normal text AA = 4.5:1. 본 테스트는 tokens.css 의 dark
 * mode 변수 값들이 `--bg-elevated` 대비 4.5:1 이상임을 보장.
 *
 * 회귀 차단 — 향후 dark mode token 변경 시 contrast 자동 검증.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";

const tokensPath = new URL(
  "../design-system/tokens.css",
  import.meta.url,
);
const css = await readFile(tokensPath, "utf8");

function hexToRgb(hex) {
  // 3-digit shorthand (#abc) 도 지원 — `#666` 같은 입력 안전.
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const s = short[1];
    return [
      parseInt(s[0] + s[0], 16),
      parseInt(s[1] + s[1], 16),
      parseInt(s[2] + s[2], 16),
    ];
  }
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad hex: ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function relativeLuminance([r, g, b]) {
  const toLin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLin(r);
  const G = toLin(g);
  const B = toLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(fg, bg) {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractDarkVar(name) {
  // [data-theme="dark"] { ... --VAR: VALUE; ... } block 안에서 추출.
  const blockRe = /\[data-theme="dark"\]\s*\{([\s\S]*?)\}/;
  const block = css.match(blockRe);
  if (!block) throw new Error("dark theme block not found");
  const re = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`);
  const m = block[1].match(re);
  if (!m) throw new Error(`${name} not found in dark block`);
  return hexToRgb(m[1]);
}

function extractLightVar(name) {
  // :root, [data-theme="light"] { ... } block. :root 가 light 선언.
  const blockRe = /:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\}/;
  const block = css.match(blockRe);
  if (!block) throw new Error("light theme block not found");
  const re = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`);
  const m = block[1].match(re);
  if (!m) throw new Error(`${name} not found in light block`);
  return hexToRgb(m[1]);
}

test("dark theme: --text-tertiary contrast >= 4.5 on --bg-elevated (WCAG AA)", () => {
  const bg = extractDarkVar("bg-elevated");
  const fg = extractDarkVar("text-tertiary");
  const ratio = contrastRatio(fg, bg);
  assert.ok(
    ratio >= 4.5,
    `text-tertiary contrast ${ratio.toFixed(2)}:1 < 4.5 (실제 색 분석 필요)`,
  );
});

test("dark theme: --text-secondary contrast >= 4.5 on --bg-elevated", () => {
  const bg = extractDarkVar("bg-elevated");
  const fg = extractDarkVar("text-secondary");
  const ratio = contrastRatio(fg, bg);
  assert.ok(
    ratio >= 4.5,
    `text-secondary contrast ${ratio.toFixed(2)}:1 < 4.5`,
  );
});

test("dark theme: --text-primary contrast >= 7 on --bg-elevated (AAA)", () => {
  const bg = extractDarkVar("bg-elevated");
  const fg = extractDarkVar("text-primary");
  const ratio = contrastRatio(fg, bg);
  assert.ok(
    ratio >= 7,
    `text-primary contrast ${ratio.toFixed(2)}:1 < 7 (AAA threshold)`,
  );
});

test("dark theme: --accent-carrot contrast >= 3 on --bg-elevated (button text AA)", () => {
  // 광고 보기 등 accent 텍스트. 3:1 은 large text AA. 4.5 권장이나
  // 광고 보기는 보통 14pt+ bold → 3 충족 시 acceptable.
  const bg = extractDarkVar("bg-elevated");
  const fg = extractDarkVar("accent-carrot");
  const ratio = contrastRatio(fg, bg);
  assert.ok(
    ratio >= 3,
    `accent-carrot contrast ${ratio.toFixed(2)}:1 < 3`,
  );
});

test("PR-80: 구 #807260 (dark text-tertiary) 잔여 없음 — 회귀 차단", () => {
  // 만약 미래에 누군가 #807260 으로 되돌리면 contrast fail. 양쪽
  // dark block 모두 검사.
  assert.equal(
    css.includes("#807260"),
    false,
    "#807260 잔여 — text-tertiary dark contrast 회귀",
  );
});

// PR-83 — fixed-light surface (#FFF8EE / #fff) 위에서의 텍스트 contrast.
// var(--text-tertiary) 는 theme-aware 라 dark mode 에서 light gray 가
// 되는데, 모달 bg 는 fixed #FFF8EE 이므로 light+light = contrast 실패.
// fixed `#6a6055` 로 5.8:1 보장.

test("PR-83: fixed #6a6055 on #FFF8EE contrast >= 4.5 (AA)", () => {
  const fg = hexToRgb("#6a6055");
  const bg = hexToRgb("#FFF8EE");
  const ratio = contrastRatio(fg, bg);
  assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 < 4.5`);
});

test("PR-83: fixed #2b2b2b on #fff contrast >= 7 (AAA)", () => {
  // AdRewardChannelModal ChannelRow label.
  const fg = hexToRgb("#2b2b2b");
  const bg = hexToRgb("#fff");
  const ratio = contrastRatio(fg, bg);
  assert.ok(ratio >= 7, `${ratio.toFixed(2)}:1 < 7`);
});

test("PR-83: fixed #666 on #fff contrast >= 5 (AA + 여유)", () => {
  // AdRewardChannelModal ChannelRow hint.
  const fg = hexToRgb("#666");
  const bg = hexToRgb("#fff");
  const ratio = contrastRatio(fg, bg);
  assert.ok(ratio >= 5, `${ratio.toFixed(2)}:1 < 5`);
});

test("PR-83: var(--text-tertiary, #888) 잔여가 fixed light bg modal 에 없음", async () => {
  // 8 modal/mission sites 가 fixed #FFF8EE / #fff bg 인데 var token
  // 쓰면 dark mode contrast 깨짐. 회귀 차단 — fixed dark grey 사용.
  const { readFile } = await import("node:fs/promises");
  const filesToCheck = [
    "../components/Inventory/InventoryModal.tsx",
    "../components/Inventory/GemTradeModal.tsx",
    "../components/Inventory/AdRewardChannelModal.tsx",
    "../components/Farm/RewardsPanel.tsx",
  ];
  for (const rel of filesToCheck) {
    const src = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.equal(
      src.includes('color: "var(--text-tertiary, #888)"'),
      false,
      `${rel} 에 var(--text-tertiary) 잔여 — PR-83 회귀`,
    );
  }
});

// PR-96 — light mode contrast 검증. Round 10 PR-80 의 dark fix 가
// light 도 동일 문제 가졌음을 audit 발견.

test("PR-96 light theme: --text-tertiary >= 4.5 on --bg-elevated (AA)", () => {
  const fg = extractLightVar("text-tertiary");
  const bg = extractLightVar("bg-elevated");
  const ratio = contrastRatio(fg, bg);
  assert.ok(ratio >= 4.5, `light text-tertiary ${ratio.toFixed(2)}:1 < 4.5`);
});

test("PR-96 light theme: --text-secondary >= 4.5", () => {
  const fg = extractLightVar("text-secondary");
  const bg = extractLightVar("bg-elevated");
  const ratio = contrastRatio(fg, bg);
  assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 < 4.5`);
});

test("PR-96 light theme: --text-primary >= 7 (AAA)", () => {
  const fg = extractLightVar("text-primary");
  const bg = extractLightVar("bg-elevated");
  const ratio = contrastRatio(fg, bg);
  assert.ok(ratio >= 7, `${ratio.toFixed(2)}:1 < 7`);
});

test("PR-96: 구 #a99c87 light text-tertiary 잔여 없음 — 회귀 차단", () => {
  // tokens.css 의 light block 에서만 검사 (auto-dark prefers-color-scheme
  // 안에는 dark variant 가 있을 수 있음).
  const blockRe = /:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\}/;
  const block = css.match(blockRe);
  assert.equal(
    block[1].includes("#a99c87"),
    false,
    "#a99c87 잔여 — light text-tertiary contrast 회귀",
  );
});
