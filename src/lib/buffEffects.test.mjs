/**
 * buffEffects helpers — formatRemaining / isFinalCountdown / BUFF_META.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/buffs/buffEffects.ts",
  import.meta.url,
);
const { BUFF_META, formatRemaining, isFinalCountdown } = mod;

test("BUFF_META — 4 종 정의 (juice/soup/cake/heart)", () => {
  // R33 PR-191 — heart buff 추가.
  assert.equal(Object.keys(BUFF_META).length, 4);
  for (const k of ["juice", "soup", "cake", "heart"]) {
    const m = BUFF_META[k];
    assert.ok(m, `${k} entry missing`);
    assert.ok(m.displayName.includes("버프"), `${k} displayName missing "버프"`);
    assert.ok(m.durationMs > 0);
    assert.ok(m.color.startsWith("#"));
    assert.ok(m.description.length > 0);
    assert.ok(m.trigger.length > 0);
  }
});

test("formatRemaining — mm:ss 형식", () => {
  assert.equal(formatRemaining(0), "00:00");
  assert.equal(formatRemaining(1_000), "00:01");
  assert.equal(formatRemaining(59_999), "00:59");
  assert.equal(formatRemaining(60_000), "01:00");
  assert.equal(formatRemaining(125_500), "02:05");
  assert.equal(formatRemaining(3_600_000), "60:00");
});

test("formatRemaining — 음수 / 미세 음수도 00:00", () => {
  assert.equal(formatRemaining(-1), "00:00");
  assert.equal(formatRemaining(-9999), "00:00");
});

test("isFinalCountdown — 0~5초 사이 true", () => {
  assert.equal(isFinalCountdown(0), false); // 0 = 만료
  assert.equal(isFinalCountdown(1_000), true);
  assert.equal(isFinalCountdown(5_000), true);
  assert.equal(isFinalCountdown(5_001), false);
  assert.equal(isFinalCountdown(60_000), false);
  assert.equal(isFinalCountdown(-100), false);
});
