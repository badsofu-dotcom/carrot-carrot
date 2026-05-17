# IMPLEMENTATION_REPORT_PR-112.md — FarmDropTable 단일 source refactor

## 동기

PROB_AUDIT.md (Round 13) Round 14 후보: FarmDropLayer 의 DROPS 인라인 const + pickDrop helper 를 별도 module 로 추출. 향후 audit / test / refactor 용이.

## 신규 — `src/lib/farm/farmDropTable.ts`

```ts
export type DropKind = ...;
export interface DropSpec { kind, weight, emoji, iconRel?, toast };
export const FARM_DROPS: readonly DropSpec[];        // 10 entries
export const FARM_DROPS_TOTAL_WEIGHT = 96;
export function pickDrop(rng?): DropSpec;
```

10 drops (PR-109 후): gem 30 / bolt 22 / heart 15 / hourglass 10 / juice 4 / soup 4 / cake 4 / candy 4 / golden 2 / hidden_bunny 1.

## FarmDropLayer 정리

이전 (~100줄): 인라인 DROPS 정의 + TOTAL_WEIGHT + pickDrop.
PR-112 후: import 만.

## Tests — `src/lib/farmDropTable.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| FARM_DROPS 10 entries | OK |
| TOTAL_WEIGHT 96 | OK |
| kind 모두 고유 | Set size === length |
| seed kind 잔여 없음 (PR-109) | OK |
| pickDrop rng=0 → gem | 첫 entry |
| pickDrop rng=0.99 → hidden_bunny | 마지막 entry |
| pickDrop 결정성 | OK |
| pickDrop golden bucket | rng 0.97 |

8 신규 tests. 총 **245 / 245 pass**.

## 변경 파일

- `src/lib/farm/farmDropTable.ts` (신규)
- `src/lib/farmDropTable.test.mjs` (신규)
- `src/components/Farm/FarmDropLayer.tsx` — 100줄 인라인 → 6줄 import

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 245 / 245 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
