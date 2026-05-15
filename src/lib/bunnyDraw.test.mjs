/**
 * drawFromRoster unit tests — exercises tier weighting + owned-set
 * fallthrough + legendary exclusion. The worker pure helper is loaded
 * via the existing esbuild TS transform (see _test-helpers.mjs).
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../../cloudflare/workers/carrot-carrot-api/src/lib/bunnyDraw.ts",
  import.meta.url,
);
const { drawFromRoster, TIER_WEIGHTS } = mod;

const ROSTER = [
  { id: "c1", tier: "common" },
  { id: "c2", tier: "common" },
  { id: "r1", tier: "rare" },
  { id: "r2", tier: "rare" },
  { id: "e1", tier: "epic" },
  { id: "l1", tier: "legendary" },
];

test("TIER_WEIGHTS sum to 1.0", () => {
  const sum =
    TIER_WEIGHTS.common +
    TIER_WEIGHTS.rare +
    TIER_WEIGHTS.epic +
    TIER_WEIGHTS.legendary;
  assert.ok(Math.abs(sum - 1.0) < 1e-9, `got ${sum}`);
});

test("rng=0 lands in common bucket; picks a common id", () => {
  const r = drawFromRoster({
    roster: ROSTER,
    ownedIds: new Set(),
    rng: () => 0,
  });
  assert.equal(r.tier, "common");
  assert.ok(r.bunnyId === "c1" || r.bunnyId === "c2");
});

test("excludeLegendary=true makes legendary unreachable", () => {
  // Even rng → 0.999 (essentially "any tier") should miss legendary.
  for (let i = 0; i < 20; i++) {
    const rng = () => 0.999;
    const r = drawFromRoster({
      roster: ROSTER,
      ownedIds: new Set(),
      excludeLegendary: true,
      rng,
    });
    assert.notEqual(r.tier, "legendary");
  }
});

test("excludeLegendary=false can land in legendary at high rng", () => {
  // With weights summing to 1.0 and legendary at 0.99..1.0, rng=0.995
  // should pick legendary.
  const r = drawFromRoster({
    roster: ROSTER,
    ownedIds: new Set(),
    excludeLegendary: false,
    rng: () => 0.995,
  });
  assert.equal(r.tier, "legendary");
  assert.equal(r.bunnyId, "l1");
});

test("owned-set excludes the picked bunny", () => {
  const r = drawFromRoster({
    roster: ROSTER,
    ownedIds: new Set(["c1"]),
    rng: () => 0, // wants common
  });
  assert.equal(r.tier, "common");
  assert.equal(r.bunnyId, "c2");
});

test("empty tier falls through to next bucket", () => {
  // Owned all commons → common pool empty → fall through to rare/epic.
  const r = drawFromRoster({
    roster: ROSTER,
    ownedIds: new Set(["c1", "c2"]),
    rng: () => 0, // initial pick = common, but pool empty
  });
  assert.notEqual(r.tier, "common");
  assert.ok(r.bunnyId === "r1" || r.bunnyId === "r2" || r.bunnyId === "e1");
});

test("all owned → bunnyId=null", () => {
  const r = drawFromRoster({
    roster: ROSTER,
    ownedIds: new Set(["c1", "c2", "r1", "r2", "e1", "l1"]),
    excludeLegendary: false,
    rng: () => 0.5,
  });
  assert.equal(r.bunnyId, null);
  assert.equal(r.tier, null);
});

test("respects roster ordering deterministically with fixed rng", () => {
  // rng returns a sequence so picking the SAME tier yields the same pick.
  let i = 0;
  const seq = [0, 0]; // tier=common, idx=0 → c1
  const rng = () => seq[i++ % seq.length];
  const r = drawFromRoster({ roster: ROSTER, ownedIds: new Set(), rng });
  assert.equal(r.bunnyId, "c1");
});
