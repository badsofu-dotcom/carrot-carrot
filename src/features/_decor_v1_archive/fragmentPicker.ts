/**
 * Pure helpers for fragmentStore (Round 24, PR-151).
 *
 * Split out from fragmentStore.ts so node --test can load these without
 * pulling in zustand / decorStore / farmStore (which trip on
 * `import.meta.env.DEV` under esbuild bundle).
 */
import { FURNITURE_CATALOG } from "./catalog";

export const FRAGMENTS_PER_FURNITURE = 5;

/**
 * 교환 풀: 일반 카탈로그 가구 (unlockCondition 없음) 중 owned 안 된 것.
 * Pure helper — store 외부 테스트 가능.
 */
export function pickExchangeCandidate(
  ownedIds: ReadonlySet<string>,
  rng: () => number = Math.random,
): string | null {
  const eligible = FURNITURE_CATALOG.filter(
    (f) => !f.unlockCondition && !ownedIds.has(f.id),
  );
  if (eligible.length === 0) return null;
  const idx = Math.floor(rng() * eligible.length);
  return eligible[idx].id;
}
