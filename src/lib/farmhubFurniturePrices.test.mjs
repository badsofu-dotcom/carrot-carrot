/**
 * farmhubFurniturePrices tests (R27 PHASE 2.A).
 *
 * 가격표 50/100/.../400 선형 + 누적 1800. 범위 밖은 null.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/decor/farmhubFurniturePrices.ts",
  import.meta.url,
);
const { FARMHUB_PRICES, FARMHUB_PRICE_TOTAL, getFurniturePrice } = mod;

test("FARMHUB_PRICES: step 1..8 모두 정의", () => {
  for (let s = 1; s <= 8; s++) {
    assert.equal(typeof FARMHUB_PRICES[s], "number", `step ${s} missing`);
    assert.ok(FARMHUB_PRICES[s] > 0, `step ${s} must be positive`);
  }
});

test("가격 곡선: 50 / 100 / 150 / 200 / 250 / 300 / 350 / 400", () => {
  const expected = [50, 100, 150, 200, 250, 300, 350, 400];
  for (let s = 1; s <= 8; s++) {
    assert.equal(
      FARMHUB_PRICES[s],
      expected[s - 1],
      `step ${s} expected ${expected[s - 1]}`,
    );
  }
});

test("누적 총합 === FARMHUB_PRICE_TOTAL (1800)", () => {
  const sum = Object.values(FARMHUB_PRICES).reduce((a, b) => a + b, 0);
  assert.equal(sum, 1800);
  assert.equal(FARMHUB_PRICE_TOTAL, 1800);
});

test("getFurniturePrice: step 1..8 정상 반환", () => {
  assert.equal(getFurniturePrice(1), 50);
  assert.equal(getFurniturePrice(4), 200);
  assert.equal(getFurniturePrice(8), 400);
});

test("getFurniturePrice: 범위 밖 → null", () => {
  assert.equal(getFurniturePrice(0), null);
  assert.equal(getFurniturePrice(9), null);
  assert.equal(getFurniturePrice(-1), null);
  assert.equal(getFurniturePrice(100), null);
});

test("getFurniturePrice: NaN / Infinity → null", () => {
  assert.equal(getFurniturePrice(NaN), null);
  assert.equal(getFurniturePrice(Infinity), null);
  assert.equal(getFurniturePrice(-Infinity), null);
});

test("getFurniturePrice: 소수 입력 → floor 적용", () => {
  // 1.7 → 1 → 50.
  assert.equal(getFurniturePrice(1.7), 50);
  assert.equal(getFurniturePrice(8.999), 400);
  // 0.9 → 0 → 범위 밖.
  assert.equal(getFurniturePrice(0.9), null);
});

test("Object.freeze: FARMHUB_PRICES 변조 불가", () => {
  assert.ok(Object.isFrozen(FARMHUB_PRICES));
});
