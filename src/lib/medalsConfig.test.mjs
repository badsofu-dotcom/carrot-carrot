/**
 * medalsConfig — PR-49 메달 정의 + 정렬/그룹화 helper 검증.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/collection/medalsConfig.ts",
  import.meta.url,
);
const { MEDALS, SORTED_MEDALS, MEDAL_BY_ID, tierCounts, tierFallbackAsset } =
  mod;

test("MEDALS 정확히 11개 정의", () => {
  assert.equal(MEDALS.length, 11);
});

test("tier 합계 — bronze 3 / silver 5 / gold 3", () => {
  const counts = tierCounts();
  assert.equal(counts.bronze, 3);
  assert.equal(counts.silver, 5);
  assert.equal(counts.gold, 3);
  assert.equal(counts.bronze + counts.silver + counts.gold, 11);
});

test("MedalId 중복 없음", () => {
  const ids = new Set(MEDALS.map((m) => m.id));
  assert.equal(ids.size, MEDALS.length);
});

test("SORTED_MEDALS — bronze→silver→gold 순서", () => {
  const tiers = SORTED_MEDALS.map((m) => m.tier);
  // bronze (3) 가 먼저, silver (5) 가 중간, gold (3) 가 마지막.
  for (let i = 0; i < 3; i++) assert.equal(tiers[i], "bronze");
  for (let i = 3; i < 8; i++) assert.equal(tiers[i], "silver");
  for (let i = 8; i < 11; i++) assert.equal(tiers[i], "gold");
});

test("MEDAL_BY_ID lookup — 모든 정의 retrievable", () => {
  for (const m of MEDALS) {
    assert.equal(MEDAL_BY_ID[m.id]?.id, m.id);
  }
});

test("모든 메달 displayName / description / iconRel / unlockHint 채워짐", () => {
  for (const m of MEDALS) {
    assert.ok(m.displayName.length > 0, `${m.id} displayName empty`);
    assert.ok(m.description.length > 0, `${m.id} description empty`);
    assert.ok(m.iconRel.length > 0, `${m.id} iconRel empty`);
    assert.ok(m.unlockHint.length > 0, `${m.id} unlockHint empty`);
  }
});

test("iconRel — assets/farm/rewards/ 경로 일관성", () => {
  for (const m of MEDALS) {
    assert.match(m.iconRel, /^assets\/farm\/rewards\/.+\.png$/);
  }
});

test("tierFallbackAsset — 각 tier 가 medal_{tier}.png 경로 반환", () => {
  assert.equal(tierFallbackAsset("bronze"), "assets/farm/rewards/medal_bronze.png");
  assert.equal(tierFallbackAsset("silver"), "assets/farm/rewards/medal_silver.png");
  assert.equal(tierFallbackAsset("gold"), "assets/farm/rewards/medal_gold.png");
});

test("category — focus/farm/dogam 만 사용", () => {
  const valid = new Set(["focus", "farm", "dogam"]);
  for (const m of MEDALS) {
    assert.ok(valid.has(m.category), `${m.id} bad category ${m.category}`);
  }
});
