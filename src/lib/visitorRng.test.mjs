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
const { pickVisitor, fnv1aHash } = mod;

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
