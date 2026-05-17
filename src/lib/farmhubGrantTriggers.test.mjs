/**
 * farmhubGrantTriggers tests (Round 26, PR-155).
 *
 * 도감 N마리 → 버섯집 다음 step 매핑 invariants. 옵션 A1 (1:1).
 *
 * 핵심 룰:
 *   - hasPending 이면 null (이미 보관함 차 있음)
 *   - currentStep === FINAL (8) 이면 null (풀세트)
 *   - dogamCount <= currentStep 이면 null (자격 없음)
 *   - 외 모두 currentStep + 1
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

// R27 PHASE 2.E — auto-grant flow archived. Helper kept in
// _decor_v1_archive/ for historical reference; this test continues to
// pin the legacy invariants so future re-introduction isn't silent.
const mod = await loadTs(
  "../features/_decor_v1_archive/farmhubGrantTriggers.ts",
  import.meta.url,
);
const { getNextGrantStep } = mod;

test("hasPending → null (지급 자격이 있어도 보관함 차 있으면 차분히 대기)", () => {
  assert.equal(getNextGrantStep(12, 0, true), null);
  assert.equal(getNextGrantStep(5, 3, true), null);
});

test("currentStep === 8 (FINAL) → null (풀세트)", () => {
  assert.equal(getNextGrantStep(12, 8, false), null);
  assert.equal(getNextGrantStep(100, 8, false), null);
});

test("dogamCount <= currentStep → null (자격 미달)", () => {
  assert.equal(getNextGrantStep(0, 0, false), null);
  assert.equal(getNextGrantStep(1, 1, false), null);
  assert.equal(getNextGrantStep(3, 5, false), null);
});

test("자격 충분 + 보관함 비어있음 + step < 8 → currentStep+1", () => {
  // 도감 1, step 0, no pending → step 1 받을 자격.
  assert.equal(getNextGrantStep(1, 0, false), 1);
  assert.equal(getNextGrantStep(2, 1, false), 2);
  assert.equal(getNextGrantStep(5, 3, false), 4);
  assert.equal(getNextGrantStep(8, 7, false), 8);
});

test("R25 사용자 (도감 12, step 0) → step 1 만 (1:1 차분히)", () => {
  // 도감 12 모두 unlock 한 사용자가 R26 입장 → carpet 1개만 도착.
  // 사용자가 배치 후 step 1 → hook 이 다시 평가 → step 2.
  // 본 helper 는 한 번에 1 step 만 반환 — 폭주 X.
  assert.equal(getNextGrantStep(12, 0, false), 1);
  assert.equal(getNextGrantStep(12, 1, false), 2);
  assert.equal(getNextGrantStep(12, 7, false), 8);
  assert.equal(getNextGrantStep(12, 8, false), null);
});

test("도감 9~12 마리 (8 가구 풀세트 도달 후) 추가 X", () => {
  // dogamCount >= 9 이고 step === 8 이면 추가 가구 없음.
  for (let n = 8; n <= 12; n++) {
    assert.equal(
      getNextGrantStep(n, 8, false),
      null,
      `n=${n} should be null`,
    );
  }
});

test("음수 / NaN / 비정상 입력 안전 (defensive)", () => {
  // dogamCount 가 0 이고 currentStep 도 0 → null. (이미 <= 분기에 잡힘)
  assert.equal(getNextGrantStep(0, 0, false), null);
  // negative dogamCount → 음수 비교 자연스럽게 null
  assert.equal(getNextGrantStep(-1, 0, false), null);
});
