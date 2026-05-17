/**
 * fragmentStore tests (Round 24, PR-151).
 *
 * pickExchangeCandidate pure helper — store 호출 없이 검증.
 *   - 모든 가구 owned → null
 *   - 일부 owned → 미보유 가구 중 1개 반환
 *   - unlockCondition 가구 (golden_carrot_statue) 절대 반환 X
 *   - 결정성 (seedable rng)
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../features/decor/fragmentPicker.ts",
  import.meta.url,
);
const { pickExchangeCandidate, FRAGMENTS_PER_FURNITURE } = mod;

const catMod = await loadTs(
  "../features/decor/catalog.ts",
  import.meta.url,
);
const { FURNITURE_CATALOG } = catMod;

test("FRAGMENTS_PER_FURNITURE: 5 (R24 spec)", () => {
  assert.equal(FRAGMENTS_PER_FURNITURE, 5);
});

test("pickExchangeCandidate: 빈 owned → 일반 가구 중 1개", () => {
  const seedRng = () => 0; // 항상 첫 entry
  const picked = pickExchangeCandidate(new Set(), seedRng);
  assert.ok(picked != null, "should pick");
  // 첫 일반 가구는 desk (catalog 순서: indoor 먼저, desk 가 첫 row).
  // unlockCondition 가구는 skip 되므로 desk 가 정상 first.
  const def = FURNITURE_CATALOG.find((f) => f.id === picked);
  assert.ok(def, "picked id in catalog");
  assert.ok(!def.unlockCondition, `unlocked-only entry picked: ${picked}`);
});

test("pickExchangeCandidate: unlockCondition 가구 절대 안 뽑음", () => {
  const ownedNothing = new Set();
  // 100 회 시뮬 with various rng → unlockCondition entry 한 번도 안 나옴.
  for (let i = 0; i < 100; i++) {
    const rng = () => i / 100;
    const id = pickExchangeCandidate(ownedNothing, rng);
    const def = FURNITURE_CATALOG.find((f) => f.id === id);
    assert.ok(!def.unlockCondition, `picked unlock-gated: ${id}`);
  }
});

test("pickExchangeCandidate: 일반 가구 모두 owned → null (all_owned)", () => {
  const allRegular = new Set(
    FURNITURE_CATALOG.filter((f) => !f.unlockCondition).map((f) => f.id),
  );
  const picked = pickExchangeCandidate(allRegular);
  assert.equal(picked, null, "no eligible left");
});

test("pickExchangeCandidate: 일부 owned 시 나머지 중에서만 뽑음", () => {
  const owned = new Set(["desk", "chair", "bed"]);
  const rng = () => 0;
  const picked = pickExchangeCandidate(owned, rng);
  assert.ok(picked != null);
  assert.ok(!owned.has(picked), `picked already-owned: ${picked}`);
});

test("pickExchangeCandidate: 같은 owned + rng → 결정성 (idempotent)", () => {
  const owned = new Set(["desk"]);
  const fixed = () => 0.33;
  const a = pickExchangeCandidate(owned, fixed);
  const b = pickExchangeCandidate(owned, fixed);
  assert.equal(a, b);
});

test("pickExchangeCandidate: 분포 — 미보유 가구 모두 hit 가능", () => {
  // RNG 를 sweep 해서 nontrivial 분포 검증.
  const owned = new Set();
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const rng = () => i / 1000;
    seen.add(pickExchangeCandidate(owned, rng));
  }
  const eligibleCount = FURNITURE_CATALOG.filter(
    (f) => !f.unlockCondition,
  ).length;
  // 22 - 1 unlock entry = 21 일반. 1000 회 sweep 이면 모두 hit.
  assert.equal(
    seen.size,
    eligibleCount,
    `expected ${eligibleCount} distinct picks, got ${seen.size}`,
  );
});
