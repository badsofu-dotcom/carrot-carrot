/**
 * visitorRng — deterministic visitor pick + FNV-1a hash distribution.
 *
 * Verifies:
 *   1. Same (userKey, ymd) → same bunny id (idempotent reads).
 *   2. Different days rotate naturally.
 *   3. Different users get different picks (no global collision).
 *   4. Hash distribution over a synthetic user×day grid is reasonably flat.
 *   5. Empty pool returns null without throwing.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loadTs } from "./_test-helpers.mjs";

const mod = await loadTs(
  "../../cloudflare/workers/carrot-carrot-api/src/lib/visitorRng.ts",
  import.meta.url,
);
const { pickVisitor, pickWeightedVisitor, fnv1aHash } = mod;

const POOL = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

test("pickVisitor: same (user, ymd) returns same id", () => {
  const a = pickVisitor("user-1", "2026-05-15", POOL);
  const b = pickVisitor("user-1", "2026-05-15", POOL);
  assert.equal(a, b);
});

test("pickVisitor: rotates across days for the same user", () => {
  const seen = new Set();
  for (let day = 1; day <= 60; day++) {
    const ymd = `2026-05-${String(day).padStart(2, "0")}`;
    seen.add(pickVisitor("user-1", ymd, POOL));
  }
  // 9-bunny pool over 60 days should hit ≥ 5 distinct visitors.
  assert.ok(seen.size >= 5, `expected ≥5 distinct visitors, got ${seen.size}`);
});

test("pickVisitor: different users get independent rotations", () => {
  // For at least one date, two different users should land on
  // different bunnies (no global single-visitor degenerate case).
  let differs = false;
  for (let day = 1; day <= 31; day++) {
    const ymd = `2026-05-${String(day).padStart(2, "0")}`;
    const a = pickVisitor("user-A", ymd, POOL);
    const b = pickVisitor("user-B", ymd, POOL);
    if (a !== b) {
      differs = true;
      break;
    }
  }
  assert.ok(differs, "users should diverge on at least one day");
});

test("pickVisitor: empty pool → null", () => {
  assert.equal(pickVisitor("user-1", "2026-05-15", []), null);
});

/* -------------------- pickWeightedVisitor (PR-128) -------------------- */

const WEIGHTED_POOL = [
  // common 60%, rare 30%, sr 8%, legendary 2% (sum 1000)
  { id: "idle", weight: 86 },
  { id: "focus", weight: 86 },
  { id: "eat25", weight: 86 },
  { id: "eat50", weight: 86 },
  { id: "eat75", weight: 86 },
  { id: "cry", weight: 85 },
  { id: "sleep", weight: 85 },
  { id: "success", weight: 100 },
  { id: "rare-ninja", weight: 100 },
  { id: "rare-king", weight: 100 },
  { id: "sr-wizard", weight: 80 },
  { id: "legendary-demon", weight: 20 },
];

test("pickWeightedVisitor: same (user, ymd) returns same id", () => {
  const a = pickWeightedVisitor("user-1", "2026-05-15", WEIGHTED_POOL);
  const b = pickWeightedVisitor("user-1", "2026-05-15", WEIGHTED_POOL);
  assert.equal(a, b);
});

test("pickWeightedVisitor: empty pool → null", () => {
  assert.equal(pickWeightedVisitor("u", "d", []), null);
});

test("pickWeightedVisitor: all-zero weights → null", () => {
  assert.equal(
    pickWeightedVisitor("u", "d", [
      { id: "a", weight: 0 },
      { id: "b", weight: 0 },
    ]),
    null,
  );
});

test("pickWeightedVisitor: distribution matches weights within ±2.5%", () => {
  // 10k samples (synthetic user×day grid) → check rarity-bucket totals.
  const TIER_OF = {
    idle: "common",
    focus: "common",
    eat25: "common",
    eat50: "common",
    eat75: "common",
    cry: "common",
    sleep: "common",
    success: "rare",
    "rare-ninja": "rare",
    "rare-king": "rare",
    "sr-wizard": "sr",
    "legendary-demon": "legendary",
  };
  const buckets = { common: 0, rare: 0, sr: 0, legendary: 0 };
  const SAMPLES = 10_000;
  for (let i = 0; i < SAMPLES; i++) {
    const day = `2026-${String(((i % 12) + 1)).padStart(2, "0")}-${String(((i % 28) + 1)).padStart(2, "0")}`;
    const id = pickWeightedVisitor(`user-${i}`, day, WEIGHTED_POOL);
    buckets[TIER_OF[id]] += 1;
  }
  const pct = (n) => (n / SAMPLES) * 100;
  // Expected: common 60, rare 30, sr 8, legendary 2.
  assert.ok(Math.abs(pct(buckets.common) - 60) < 2.5, `common ${pct(buckets.common).toFixed(2)}%`);
  assert.ok(Math.abs(pct(buckets.rare) - 30) < 2.5, `rare ${pct(buckets.rare).toFixed(2)}%`);
  assert.ok(Math.abs(pct(buckets.sr) - 8) < 2.5, `sr ${pct(buckets.sr).toFixed(2)}%`);
  assert.ok(Math.abs(pct(buckets.legendary) - 2) < 2.5, `legendary ${pct(buckets.legendary).toFixed(2)}%`);
});

test("pickWeightedVisitor: zero-weight entry never wins", () => {
  const pool = [
    { id: "never", weight: 0 },
    { id: "always", weight: 10 },
  ];
  for (let i = 0; i < 200; i++) {
    const id = pickWeightedVisitor(`u-${i}`, "2026-05-15", pool);
    assert.equal(id, "always");
  }
});

test("fnv1aHash: stable, non-zero, well-distributed across 1k samples", () => {
  const buckets = new Array(9).fill(0);
  for (let i = 0; i < 1000; i++) {
    const h = fnv1aHash(`user-${i}:2026-05-15`);
    assert.ok(Number.isInteger(h));
    assert.ok(h >= 0);
    buckets[h % 9] += 1;
  }
  // No bucket should be empty over 1k samples on a 9-slot pool, and
  // none should claim more than 25 % (loose χ²-style ceiling).
  const min = Math.min(...buckets);
  const max = Math.max(...buckets);
  assert.ok(min > 0, `empty bucket: ${buckets}`);
  assert.ok(max < 250, `over-concentrated bucket: ${buckets}`);
});
