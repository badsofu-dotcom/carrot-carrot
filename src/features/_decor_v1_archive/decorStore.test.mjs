/**
 * decor catalog + types tests (Round 22, PR-145).
 *
 * decorStore 의 buy() 가 farmStore 와 safeStorage 둘 다에 의존하는데
 * `loadTs` 가 dependency-injection 미지원이라 store 통합 동작은 in-app
 * 으로 검증한다. 본 테스트는 카탈로그 데이터 완정성 + 타입 invariants
 * 만 검사 (정적 분석으로 잡히지 않는 런타임 일관성).
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const catMod = await loadTs(
  "../features/decor/catalog.ts",
  import.meta.url,
);
const { FURNITURE_CATALOG, FURNITURE_BY_ID } = catMod;

test("catalog: 23 종 (10 실내 + 9 야외 [+1 한정] + 4 계절)", () => {
  // R24 PR-150 — golden_carrot_statue 한정 (outdoor) 추가.
  assert.equal(FURNITURE_CATALOG.length, 23);
  const indoor = FURNITURE_CATALOG.filter((f) => f.category === "indoor");
  const outdoor = FURNITURE_CATALOG.filter((f) => f.category === "outdoor");
  const seasonal = FURNITURE_CATALOG.filter((f) => f.category === "seasonal");
  assert.equal(indoor.length, 10, `indoor=${indoor.length}`);
  // 야외 8 일반 + 1 한정 = 9. 한정 entry 도 category=outdoor.
  assert.equal(outdoor.length, 9, `outdoor=${outdoor.length}`);
  assert.equal(seasonal.length, 4, `seasonal=${seasonal.length}`);

  // 한정 entry 정확히 1개 (dogam_100).
  const limited = FURNITURE_CATALOG.filter((f) => f.unlockCondition);
  assert.equal(limited.length, 1, "exactly 1 limited entry");
  assert.equal(limited[0].id, "golden_carrot_statue");
  assert.equal(limited[0].unlockCondition, "dogam_100");
});

test("catalog: id 유니크 + FURNITURE_BY_ID 완전 매핑", () => {
  const ids = new Set();
  for (const f of FURNITURE_CATALOG) {
    assert.ok(typeof f.id === "string" && f.id.length > 0, `bad id: ${f.id}`);
    assert.ok(!ids.has(f.id), `dup id: ${f.id}`);
    ids.add(f.id);
    assert.equal(FURNITURE_BY_ID[f.id], f, `BY_ID mismatch: ${f.id}`);
  }
  assert.equal(Object.keys(FURNITURE_BY_ID).length, FURNITURE_CATALOG.length);
});

test("catalog: 가격 양수 + 정수", () => {
  for (const f of FURNITURE_CATALOG) {
    assert.ok(Number.isInteger(f.price), `non-int price: ${f.id}`);
    assert.ok(f.price > 0, `non-positive price: ${f.id}`);
  }
});

test("catalog: rarity 합법값 ∈ {common, rare, epic}", () => {
  const ok = new Set(["common", "rare", "epic"]);
  for (const f of FURNITURE_CATALOG) {
    assert.ok(ok.has(f.rarity), `bad rarity: ${f.id}=${f.rarity}`);
  }
});

test("catalog: category 합법값 ∈ {indoor, outdoor, seasonal}", () => {
  const ok = new Set(["indoor", "outdoor", "seasonal"]);
  for (const f of FURNITURE_CATALOG) {
    assert.ok(ok.has(f.category), `bad category: ${f.id}=${f.category}`);
  }
});

test("catalog: size.w/h 양수 정수", () => {
  for (const f of FURNITURE_CATALOG) {
    assert.ok(Number.isInteger(f.size.w) && f.size.w > 0, `bad w: ${f.id}`);
    assert.ok(Number.isInteger(f.size.h) && f.size.h > 0, `bad h: ${f.id}`);
  }
});

test("catalog: sprite Sprite union (emoji 베타, image R24+)", () => {
  for (const f of FURNITURE_CATALOG) {
    assert.ok(
      f.sprite && typeof f.sprite === "object",
      `bad sprite shape: ${f.id}`,
    );
    if (f.sprite.kind === "emoji") {
      assert.ok(
        typeof f.sprite.value === "string" && f.sprite.value.length > 0,
        `empty emoji: ${f.id}`,
      );
    } else if (f.sprite.kind === "image") {
      assert.ok(
        typeof f.sprite.src === "string" && f.sprite.src.startsWith("/"),
        `bad image src: ${f.id}`,
      );
    } else {
      assert.fail(`unknown sprite kind: ${f.id} ${JSON.stringify(f.sprite)}`);
    }
  }
});

test("catalog: 일반 가구 가격 합산 (밸런스 sanity, 한정 제외)", () => {
  // 한정 (unlockCondition) entry 의 price 는 9999 표시용 — 합산에서 제외.
  // 일반 가구 다 사려면 ~1800 carrot 필요. 일일 100 cap 기준 ~18일.
  const total = FURNITURE_CATALOG.filter((f) => !f.unlockCondition).reduce(
    (s, f) => s + f.price,
    0,
  );
  assert.ok(total >= 1000, `regular catalog total too cheap: ${total}`);
  assert.ok(total <= 3000, `regular catalog total too expensive: ${total}`);
});

test("catalog: 카테고리별 평균가 (한정 제외, rarity 와 비례)", () => {
  const byCat = (cat) =>
    FURNITURE_CATALOG.filter(
      (f) => f.category === cat && !f.unlockCondition,
    );
  const avg = (arr) =>
    arr.reduce((s, f) => s + f.price, 0) / Math.max(1, arr.length);
  const ai = avg(byCat("indoor"));
  const ao = avg(byCat("outdoor"));
  const as = avg(byCat("seasonal"));
  assert.ok(ai > 0 && ao > 0 && as > 0);
  // seasonal 은 epic + rare 위주라 평균 비싸야. outdoor 중간.
  assert.ok(as >= ao, `seasonal avg ${as} < outdoor avg ${ao}`);
});
