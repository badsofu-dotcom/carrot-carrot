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

/** Exposed for unit tests + cross-call determinism checks. */
export { fnv1aHash };
