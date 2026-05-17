/**
 * farmhubStore + farmhubCatalog tests (Round 25, PR-152).
 *
 * Pure helpers / catalog 검증 + 자산 path 존재 (build-time fs).
 * Store action 테스트는 zustand + safeStorage 의존이라 loadTs 가
 * `import.meta.env.DEV` 로 fail — 카탈로그/path 만 검사.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./_test-helpers.mjs";

const catMod = await loadTs(
  "../features/decor/farmhubCatalog.ts",
  import.meta.url,
);
const {
  FARMHUB_FURNITURE,
  FARMHUB_BG,
  FARMHUB_BY_ID,
  FARMHUB_BY_STEP,
  FARMHUB_FINAL_STEP,
} = catMod;

const PUBLIC_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../public",
);

test("FARMHUB_FINAL_STEP === 8", () => {
  assert.equal(FARMHUB_FINAL_STEP, 8);
});

test("FARMHUB_FURNITURE: 8 entry, step 1..8 모두 정의", () => {
  assert.equal(FARMHUB_FURNITURE.length, 8);
  const steps = new Set();
  for (const f of FARMHUB_FURNITURE) {
    assert.ok(Number.isInteger(f.step), `bad step: ${f.id}`);
    assert.ok(f.step >= 1 && f.step <= 8, `step out of range: ${f.id}`);
    assert.ok(!steps.has(f.step), `dup step: ${f.step}`);
    steps.add(f.step);
  }
  assert.equal(steps.size, 8);
});

test("FARMHUB_BY_ID / BY_STEP 룩업 일관성", () => {
  for (const f of FARMHUB_FURNITURE) {
    assert.equal(FARMHUB_BY_ID[f.id], f);
    assert.equal(FARMHUB_BY_STEP[f.step], f);
  }
});

test("FARMHUB_BG: step 0..8 모두 path 반환", () => {
  for (let s = 0; s <= 8; s++) {
    const p = FARMHUB_BG(s);
    assert.equal(p, `/assets/decor/farmhub/bg/bg_farmhub_${s}.jpg`);
  }
});

test("FARMHUB_BG: out-of-range step → clamp", () => {
  assert.equal(FARMHUB_BG(-1), `/assets/decor/farmhub/bg/bg_farmhub_0.jpg`);
  assert.equal(FARMHUB_BG(99), `/assets/decor/farmhub/bg/bg_farmhub_8.jpg`);
});

test("자산 파일 존재: bg 9개", () => {
  for (let s = 0; s <= 8; s++) {
    const path = resolve(PUBLIC_ROOT, `assets/decor/farmhub/bg/bg_farmhub_${s}.jpg`);
    assert.ok(existsSync(path), `missing: ${path}`);
  }
});

test("자산 파일 존재: items 8개 (catalog sprite path → public 파일)", () => {
  for (const f of FARMHUB_FURNITURE) {
    // sprite 는 /assets/... 절대 → public/ 아래로 매핑.
    const relative = f.sprite.replace(/^\//, "");
    const path = resolve(PUBLIC_ROOT, relative);
    assert.ok(existsSync(path), `missing sprite: ${path}`);
  }
});

test("catalog 명세 일치 (8 가구 순서 + id 매핑)", () => {
  // 사용자 자산 명단 ↔ id 매핑. step 1..8 순.
  const expected = [
    { id: "carpet", step: 1 },
    { id: "bed", step: 2 },
    { id: "table", step: 3 },
    { id: "bookcase", step: 4 },
    { id: "pot", step: 5 },
    { id: "drawer", step: 6 },
    { id: "storagebox", step: 7 },
    { id: "stoolchair", step: 8 },
  ];
  for (const e of expected) {
    const f = FARMHUB_BY_STEP[e.step];
    assert.ok(f, `step ${e.step} missing`);
    assert.equal(f.id, e.id, `step ${e.step} expected ${e.id}, got ${f.id}`);
  }
});
