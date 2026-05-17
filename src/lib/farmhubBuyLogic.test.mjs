/**
 * farmhubBuyLogic tests (R27 PHASE 2.B).
 *
 * evaluateBuyNextStep 의 5 fail reason + 통과 케이스 + 우선순위.
 * 순수 함수라 zustand mock 불필요.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/decor/farmhubBuyLogic.ts",
  import.meta.url,
);
const { evaluateBuyNextStep } = mod;

function ctx(over = {}) {
  return {
    step: 0,
    pendingFurnitureId: null,
    dogamCount: 12,
    carrots: 9999,
    ...over,
  };
}

test("정상 케이스: 통과 → targetStep + price + furnitureId 반환", () => {
  const r = evaluateBuyNextStep(ctx({ step: 0 }));
  assert.equal(r.ok, true);
  assert.equal(r.targetStep, 1);
  assert.equal(r.price, 50);
  assert.equal(r.furnitureId, "carpet");
});

test("step === 8 (FINAL) → max_step", () => {
  const r = evaluateBuyNextStep(ctx({ step: 8 }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "max_step");
});

test("pendingFurnitureId !== null → already_pending", () => {
  const r = evaluateBuyNextStep(
    ctx({ step: 0, pendingFurnitureId: "carpet" }),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "already_pending");
});

test("dogamCount < targetStep → step_locked", () => {
  // step 0, dogamCount 0 → targetStep 1, 자격 미달.
  let r = evaluateBuyNextStep(ctx({ step: 0, dogamCount: 0 }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "step_locked");

  // step 4, dogamCount 4 → targetStep 5, 자격 미달.
  r = evaluateBuyNextStep(ctx({ step: 4, dogamCount: 4 }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "step_locked");

  // step 7, dogamCount 7 → targetStep 8, 자격 미달.
  r = evaluateBuyNextStep(ctx({ step: 7, dogamCount: 7 }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "step_locked");
});

test("dogamCount === targetStep → 통과 (자격 정확히 만족)", () => {
  // step 0, dogamCount 1 → targetStep 1, 자격 OK.
  const r = evaluateBuyNextStep(ctx({ step: 0, dogamCount: 1 }));
  assert.equal(r.ok, true);
  assert.equal(r.targetStep, 1);
});

test("carrots < price → insufficient_carrot", () => {
  // step 0, dogamCount 1, carrots 49 (price 50) → 부족.
  const r = evaluateBuyNextStep(
    ctx({ step: 0, dogamCount: 1, carrots: 49 }),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "insufficient_carrot");
});

test("carrots === price → 통과 (경계값)", () => {
  const r = evaluateBuyNextStep(
    ctx({ step: 0, dogamCount: 1, carrots: 50 }),
  );
  assert.equal(r.ok, true);
});

test("우선순위: max_step > already_pending > step_locked > insufficient_carrot", () => {
  // 모든 조건 fail 시 max_step 가 먼저.
  let r = evaluateBuyNextStep(
    ctx({
      step: 8,
      pendingFurnitureId: "stoolchair",
      dogamCount: 0,
      carrots: 0,
    }),
  );
  assert.equal(r.reason, "max_step");

  // step OK, 나머지 fail → already_pending 먼저.
  r = evaluateBuyNextStep(
    ctx({
      step: 3,
      pendingFurnitureId: "bookcase",
      dogamCount: 0,
      carrots: 0,
    }),
  );
  assert.equal(r.reason, "already_pending");

  // pending null, 나머지 fail → step_locked 먼저.
  r = evaluateBuyNextStep(
    ctx({ step: 3, pendingFurnitureId: null, dogamCount: 0, carrots: 0 }),
  );
  assert.equal(r.reason, "step_locked");

  // pending null + 자격 OK + 당근 부족 → insufficient_carrot.
  r = evaluateBuyNextStep(
    ctx({ step: 3, pendingFurnitureId: null, dogamCount: 4, carrots: 0 }),
  );
  assert.equal(r.reason, "insufficient_carrot");
});

test("step 1..7 → 각 가격 50/100/150/200/250/300/350", () => {
  const expected = [50, 100, 150, 200, 250, 300, 350];
  for (let s = 0; s < 7; s++) {
    const r = evaluateBuyNextStep(
      ctx({ step: s, dogamCount: 12, carrots: 9999 }),
    );
    assert.equal(r.ok, true);
    assert.equal(r.price, expected[s], `step ${s + 1} price`);
  }
});

test("step 7 → step 8 (stoolchair) 가격 400", () => {
  const r = evaluateBuyNextStep(
    ctx({ step: 7, dogamCount: 8, carrots: 9999 }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.targetStep, 8);
  assert.equal(r.price, 400);
  assert.equal(r.furnitureId, "stoolchair");
});
