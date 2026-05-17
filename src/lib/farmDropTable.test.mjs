/**
 * farmDropTable (PR-112) — single source of truth for farm drops.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs("./farm/farmDropTable.ts", import.meta.url);
const { FARM_DROPS, FARM_DROPS_TOTAL_WEIGHT, pickDrop } = mod;

test("FARM_DROPS: 10 entries", () => {
  assert.equal(FARM_DROPS.length, 10);
});

test("FARM_DROPS_TOTAL_WEIGHT: 96 (gem30+bolt22+heart15+hg10+juice4+soup4+cake4+candy4+golden2+bunny1)", () => {
  assert.equal(FARM_DROPS_TOTAL_WEIGHT, 96);
});

test("FARM_DROPS: 모든 entry kind 고유", () => {
  const kinds = new Set(FARM_DROPS.map((d) => d.kind));
  assert.equal(kinds.size, FARM_DROPS.length);
});

test("FARM_DROPS: PR-109 seed kind 잔여 없음", () => {
  for (const d of FARM_DROPS) {
    assert.notEqual(d.kind, "seed");
  }
});

test("pickDrop: rng=0 → 첫 entry (gem)", () => {
  const d = pickDrop(() => 0);
  assert.equal(d.kind, "gem");
});

test("pickDrop: rng=0.99 → 마지막 entry (hidden_bunny)", () => {
  // 0.99 * 96 = 95.04, 95 까지 누적 후 hidden_bunny (weight 1) 안에.
  const d = pickDrop(() => 0.99);
  assert.equal(d.kind, "hidden_bunny");
});

test("pickDrop: 결정성 — 같은 rng 같은 결과", () => {
  const a = pickDrop(() => 0.5);
  const b = pickDrop(() => 0.5);
  assert.equal(a.kind, b.kind);
});

test("pickDrop: golden bucket — gem(30)+bolt(22)+heart(15)+hg(10)+juice(4)+soup(4)+cake(4)+candy(4) = 93, 93..95 = golden", () => {
  // rng 0.94 * 96 = 90.24 → cake band 안 (까지 누적 89 + cake 4 → 93). 검증.
  // 더 정확히: 0.965 * 96 = 92.64 → candy band end (93). 0.97 * 96 = 93.12 → golden.
  const d = pickDrop(() => 0.97);
  assert.equal(d.kind, "golden");
});
