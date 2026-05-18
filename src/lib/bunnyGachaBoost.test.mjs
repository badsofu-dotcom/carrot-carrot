/**
 * bunnyGacha boostTier 가챠 pity 테스트 (R32 PR-184).
 *
 * drawBunny 의 boostTier "rare" / "epic" 분기 검증. forceLegendary /
 * excludeLegendary 와의 우선순위 + 가중치 정규화 + tier 보장 + 비용
 * 상수 확인.
 *
 * CHARACTERS / SLOTS 의 실제 데이터에 의존하지 않도록 tier 결과만
 * 검사 (bunnyId 는 데이터 의존 — owned 비우면 일반적으로 non-null).
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./bunnyGacha.ts", import.meta.url);
const {
  drawBunny,
  TIER_WEIGHTS,
  CANDY_RARE_PITY_COST,
  GOLDEN_EPIC_PITY_COST,
  RARE_PITY_EPIC_MULTIPLIER,
  LEGENDARY_STAR_COST,
} = mod;

// 비용 상수 — R32 PR-184 결정 → R34 PR-202 조정 (30일 도감 완성 목표).
test("CANDY_RARE_PITY_COST === 8 (R34 PR-202 조정: 10→8)", () => {
  assert.equal(CANDY_RARE_PITY_COST, 8);
});

test("GOLDEN_EPIC_PITY_COST === 3 (R34 PR-202 조정: 5→3)", () => {
  assert.equal(GOLDEN_EPIC_PITY_COST, 3);
});

test("RARE_PITY_EPIC_MULTIPLIER === 2", () => {
  assert.equal(RARE_PITY_EPIC_MULTIPLIER, 2);
});

test("LEGENDARY_STAR_COST === 100 (기존, 변경 없음)", () => {
  assert.equal(LEGENDARY_STAR_COST, 100);
});

test("TIER_WEIGHTS 합 === 1.0 (기존, 변경 없음)", () => {
  const sum =
    TIER_WEIGHTS.common +
    TIER_WEIGHTS.rare +
    TIER_WEIGHTS.epic +
    TIER_WEIGHTS.legendary;
  assert.ok(Math.abs(sum - 1.0) < 1e-9, `got ${sum}`);
});

// ===== boostTier "rare" — 캔디당근 pity =====

test("boostTier 'rare' — rng=0 → rare tier (보장)", () => {
  const r = drawBunny({
    ownedIds: new Set(),
    boostTier: "rare",
    rng: () => 0,
  });
  // rare 가 buckets 첫 번째라 rng=0 은 rare 선택.
  assert.equal(r.tier, "rare");
});

test("boostTier 'rare' — rng=0.999 → epic tier (가중치 2x)", () => {
  const r = drawBunny({
    ownedIds: new Set(),
    boostTier: "rare",
    rng: () => 0.999,
  });
  // rare 0.22 + epic 0.07×2 = 0.14 → 정규화 합 0.36.
  // rare 0/0.36 ~ 0.611 → epic 0.611/0.36 ~ 1.0. rng=0.999 → epic.
  assert.equal(r.tier, "epic");
});

test("boostTier 'rare' — common / legendary 절대 안 나옴", () => {
  // 다양한 rng 값으로 100회 시도해도 항상 rare/epic 만.
  for (let i = 0; i < 100; i++) {
    const r = drawBunny({
      ownedIds: new Set(),
      boostTier: "rare",
      rng: () => i / 100,
    });
    assert.notEqual(r.tier, "common");
    assert.notEqual(r.tier, "legendary");
    assert.ok(r.tier === "rare" || r.tier === "epic", `i=${i} tier=${r.tier}`);
  }
});

test("boostTier 'rare' — epic 가중치 2x 확률 분포 (~38.9%)", () => {
  // 정규화: total = rare(0.22) + epic(0.14) = 0.36
  //   P(epic) = 0.14 / 0.36 ≈ 0.389
  let epicCount = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) {
    const r = drawBunny({
      ownedIds: new Set(),
      boostTier: "rare",
      rng: Math.random,
    });
    if (r.tier === "epic") epicCount++;
  }
  const observed = epicCount / N;
  // ±2.5% tolerance for 10k samples.
  assert.ok(
    Math.abs(observed - 0.389) < 0.025,
    `epic 분포: 기대 0.389, 관측 ${observed.toFixed(3)}`,
  );
});

// ===== boostTier "epic" — 황금당근 pity =====

test("boostTier 'epic' — rng=0 → epic tier (보장)", () => {
  const r = drawBunny({
    ownedIds: new Set(),
    boostTier: "epic",
    rng: () => 0,
  });
  assert.equal(r.tier, "epic");
});

test("boostTier 'epic' — rng=0.999 → legendary tier", () => {
  const r = drawBunny({
    ownedIds: new Set(),
    boostTier: "epic",
    rng: () => 0.999,
  });
  // epic 0.07 + legendary 0.01 = 0.08 정규화. rng=0.999 → legendary.
  assert.equal(r.tier, "legendary");
});

test("boostTier 'epic' — common / rare 절대 안 나옴", () => {
  for (let i = 0; i < 100; i++) {
    const r = drawBunny({
      ownedIds: new Set(),
      boostTier: "epic",
      rng: () => i / 100,
    });
    assert.notEqual(r.tier, "common");
    assert.notEqual(r.tier, "rare");
    assert.ok(
      r.tier === "epic" || r.tier === "legendary",
      `i=${i} tier=${r.tier}`,
    );
  }
});

test("boostTier 'epic' — legendary 확률 12.5% 분포", () => {
  // 정규화: total = epic(0.07) + legendary(0.01) = 0.08
  //   P(legendary) = 0.01 / 0.08 = 0.125
  let legCount = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) {
    const r = drawBunny({
      ownedIds: new Set(),
      boostTier: "epic",
      rng: Math.random,
    });
    if (r.tier === "legendary") legCount++;
  }
  const observed = legCount / N;
  assert.ok(
    Math.abs(observed - 0.125) < 0.02,
    `legendary 분포: 기대 0.125, 관측 ${observed.toFixed(3)}`,
  );
});

// ===== 우선순위 / 호환성 =====

test("boostTier 가 forceLegendary 보다 우선", () => {
  const r = drawBunny({
    ownedIds: new Set(),
    boostTier: "rare",
    forceLegendary: true,
    rng: () => 0,
  });
  assert.equal(r.tier, "rare", "boostTier 가 우선이라 rare 선택");
});

test("boostTier 가 excludeLegendary 무시 (epic pity 에서 legendary 가능)", () => {
  // excludeLegendary: true 라도 boostTier "epic" 이면 legendary 가능.
  const r = drawBunny({
    ownedIds: new Set(),
    boostTier: "epic",
    excludeLegendary: true,
    rng: () => 0.999,
  });
  assert.equal(r.tier, "legendary");
});

test("기존 forceLegendary 경로 — boostTier 없으면 그대로 작동", () => {
  const r = drawBunny({
    ownedIds: new Set(),
    forceLegendary: true,
    rng: () => 0,
  });
  assert.equal(r.tier, "legendary");
});

test("기존 excludeLegendary 경로 — boostTier 없으면 그대로 작동", () => {
  for (let i = 0; i < 20; i++) {
    const r = drawBunny({
      ownedIds: new Set(),
      excludeLegendary: true,
      rng: () => 0.999,
    });
    assert.notEqual(r.tier, "legendary");
  }
});
