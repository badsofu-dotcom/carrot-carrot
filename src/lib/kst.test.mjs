/**
 * kst (PR-102) — single helper 검증.
 *
 * 이전 8 사이트의 인라인 동일 로직 → 단일 export. 본 테스트는 결정성
 * + KST UTC+9 정확 적용 + zero-padding 검증.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./kst.ts", import.meta.url);
const { kstDayKey } = mod;

test("kstDayKey: 정상 KST 시간", () => {
  // UTC 2026-05-17 00:00 → KST 2026-05-17 09:00 → key 2026-05-17
  const d = new Date(Date.UTC(2026, 4, 17, 0, 0, 0));
  assert.equal(kstDayKey(d), "2026-05-17");
});

test("kstDayKey: UTC 15:00 = KST 다음날 00:00 → 다음 일자 키", () => {
  const d = new Date(Date.UTC(2026, 4, 16, 15, 0, 0));
  assert.equal(kstDayKey(d), "2026-05-17");
});

test("kstDayKey: UTC 14:59 = KST 23:59 → 같은 일자 키", () => {
  const d = new Date(Date.UTC(2026, 4, 16, 14, 59, 59));
  assert.equal(kstDayKey(d), "2026-05-16");
});

test("kstDayKey: zero-pad 월/일 1자리", () => {
  const d = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)); // Jan 1 → KST Jan 1 09:00
  assert.equal(kstDayKey(d), "2026-01-01");
});

test("kstDayKey: 자정 KST boundary (UTC 14:59:59 → 15:00)", () => {
  const before = new Date(Date.UTC(2026, 4, 17, 14, 59, 59));
  const after = new Date(Date.UTC(2026, 4, 17, 15, 0, 0));
  assert.equal(kstDayKey(before), "2026-05-17");
  assert.equal(kstDayKey(after), "2026-05-18");
});

test("kstDayKey: default arg = now", () => {
  // 그냥 호출 시 string 반환
  const k = kstDayKey();
  assert.match(k, /^\d{4}-\d{2}-\d{2}$/);
});

test("kstDayKey: 결정적 — 같은 입력 같은 결과", () => {
  const d = new Date(Date.UTC(2026, 4, 17, 12, 0, 0));
  assert.equal(kstDayKey(d), kstDayKey(d));
});
