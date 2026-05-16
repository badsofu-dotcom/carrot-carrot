/**
 * bunnyDex — 100마리 풀 검증 (PR-50).
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/collection/bunnyDex.ts",
  import.meta.url,
);
const { BUNNY_DEX, DEX_BY_ID, dexRarityCounts, dexSeasonCounts } = mod;

test("BUNNY_DEX 정확히 100마리", () => {
  assert.equal(BUNNY_DEX.length, 100);
});

test("rarity 분포 60 / 25 / 10 / 5", () => {
  const c = dexRarityCounts();
  assert.equal(c.common, 60);
  assert.equal(c.rare, 25);
  assert.equal(c.sr, 10);
  assert.equal(c.legendary, 5);
  assert.equal(c.common + c.rare + c.sr + c.legendary, 100);
});

test("season 분포 25 / 25 / 25 / 25 균등", () => {
  const c = dexSeasonCounts();
  assert.equal(c.spring, 25);
  assert.equal(c.summer, 25);
  assert.equal(c.autumn, 25);
  assert.equal(c.winter, 25);
});

test("id 중복 없음", () => {
  const ids = new Set(BUNNY_DEX.map((b) => b.id));
  assert.equal(ids.size, BUNNY_DEX.length);
});

test("name 중복 없음", () => {
  const names = new Set(BUNNY_DEX.map((b) => b.name));
  assert.equal(names.size, BUNNY_DEX.length);
});

test("DEX_BY_ID lookup — 모든 entry retrievable", () => {
  for (const b of BUNNY_DEX) {
    assert.equal(DEX_BY_ID[b.id]?.id, b.id);
  }
});

test("모든 entry — name / theme / lore / iconRel 비어있지 않음", () => {
  for (const b of BUNNY_DEX) {
    assert.ok(b.name.length > 0, `${b.id} name`);
    assert.ok(b.theme.length > 0, `${b.id} theme`);
    assert.ok(b.lore.length > 5, `${b.id} lore`);
    assert.ok(b.iconRel.startsWith("assets/farm/bunnies/"), `${b.id} iconRel`);
  }
});

test("legendary 5마리 — 각 season 1마리 + 추가 1마리", () => {
  const legend = BUNNY_DEX.filter((b) => b.rarity === "legendary");
  assert.equal(legend.length, 5);
  const seasons = new Set(legend.map((b) => b.season));
  // 최소 4 시즌 모두 cover
  assert.equal(seasons.size, 4);
});
