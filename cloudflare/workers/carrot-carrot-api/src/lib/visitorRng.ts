/**
 * Deterministic visitor bunny picker.
 *
 * Given (user_key, ymd, pool), returns a stable bunny id by hashing
 * the composite key. Same inputs → same output → calling
 * GET /friends/today twice in one day always reveals the same visitor.
 *
 * Hash choice:
 *   FNV-1a 32-bit. Fast, no crypto subtle dependency, good distribution
 *   for short ASCII inputs. NOT a security primitive — anyone can
 *   predict tomorrow's visitor — but that's by design (v1 has no
 *   anti-cheat for which-bunny-arrives).
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1aHash(input: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  // Coerce to unsigned 32-bit.
  return h >>> 0;
}

/**
 * Pick a deterministic visitor bunny id for (userKey, ymd) from `pool`.
 * Returns null when the pool is empty.
 *
 * The hash is computed on the string `${userKey}:${ymd}` so collisions
 * within a single day for one user are impossible, and cross-day
 * picks rotate naturally.
 */
export function pickVisitor(
  userKey: string,
  ymd: string,
  pool: ReadonlyArray<string>,
): string | null {
  if (pool.length === 0) return null;
  const h = fnv1aHash(`${userKey}:${ymd}`);
  return pool[h % pool.length] ?? null;
}

/**
 * Weighted pool entry — id + integer weight (relative). The picker
 * normalises by sum so weights can be any non-negative integers; e.g.
 * `[{ id:"x", weight:60 }, { id:"y", weight:40 }]` yields 60/40 split.
 */
export interface WeightedEntry {
  id: string;
  weight: number;
}

/**
 * Pick a deterministic visitor from a weighted pool.
 *
 *   - Same (userKey, ymd) → same id (idempotent reads).
 *   - Hash space (32-bit) is wrapped onto the cumulative-weight axis,
 *     so within-tier rotation across days happens naturally.
 *   - Entries with weight ≤ 0 are skipped silently (they never win).
 *
 * Returns null if pool is empty or every weight is non-positive.
 */
export function pickWeightedVisitor(
  userKey: string,
  ymd: string,
  pool: ReadonlyArray<WeightedEntry>,
): string | null {
  if (pool.length === 0) return null;
  let total = 0;
  for (const p of pool) {
    if (p.weight > 0) total += p.weight;
  }
  if (total <= 0) return null;
  const h = fnv1aHash(`${userKey}:${ymd}`);
  let pick = h % total;
  for (const p of pool) {
    if (p.weight <= 0) continue;
    if (pick < p.weight) return p.id;
    pick -= p.weight;
  }
  // Floating defensive fallback — should be unreachable when total > 0.
  for (let i = pool.length - 1; i >= 0; i--) {
    if (pool[i].weight > 0) return pool[i].id;
  }
  return null;
}

/** Exposed for unit tests + cross-call determinism checks. */
export { fnv1aHash };
