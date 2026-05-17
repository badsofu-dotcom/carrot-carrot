/**
 * haptic (PR-78) — no-op stub 검증.
 *
 * 32 호출 사이트가 코드 변경 없이 진동 disabled. 본 테스트는:
 *   1) export 시그니처 존재
 *   2) 호출해도 throw 안 함
 *   3) navigator.vibrate (있다면) 호출 안 함
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("../design-system/haptic.ts", import.meta.url);
const { haptic } = mod;

test("haptic: function exported", () => {
  assert.equal(typeof haptic, "function");
});

test("haptic: all intents no-throw", () => {
  for (const intent of ["light", "medium", "heavy", "success", "warning"]) {
    assert.doesNotThrow(() => haptic(intent));
  }
});

test("haptic: default intent no-throw", () => {
  assert.doesNotThrow(() => haptic());
});

test("haptic: return undefined (void) — no-op 증거", () => {
  // no-op stub 은 항상 undefined 반환. 32 호출 사이트가 progressive
  // disabled 됨을 source 시그니처 검증 + 본 unit test 로 확정.
  assert.equal(haptic("light"), undefined);
  assert.equal(haptic("success"), undefined);
  assert.equal(haptic("warning"), undefined);
});

test("haptic: source 파일에 navigator.vibrate 호출 없음", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(
    new URL("../design-system/haptic.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    src.includes("navigator.vibrate"),
    false,
    "haptic.ts 에 navigator.vibrate 호출 잔여",
  );
  assert.equal(
    src.includes("TossApps"),
    false,
    "haptic.ts 에 TossApps haptic 호출 잔여",
  );
});
