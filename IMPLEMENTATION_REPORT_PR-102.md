# IMPLEMENTATION_REPORT_PR-102.md — `kstDayKey` 단일 helper 추출 (TIME_AUDIT Round 14 후보)

자율 선택. TIME_AUDIT.md 의 Round 14 후보 중 가장 가치 큰 항목 (DRY).

## 동기

TIME_AUDIT 결과 8 사이트에 동일 `kstDayKey` 함수 인라인 복사. 향후 KST 정책 변경 시 8 곳 동시 수정 필요. PR-102 가 단일 helper (`src/lib/kst.ts`) 추출.

## 신규 — `src/lib/kst.ts`

```ts
export function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

## 변경 사이트 (7 + 1 re-export)

| 파일 | 변경 |
| --- | --- |
| `lib/kst.ts` | **신규** canonical export |
| `features/missions/dailyMissions.ts` | inline → import + re-export (backward compat) |
| `features/collection/toolStore.ts` | inline → import |
| `features/collection/itemsStore.ts` | inline → import |
| `components/Farm/FarmDropLayer.tsx` | inline → import |
| `components/Farm/HiddenBunnyLayer.tsx` | inline → import |
| `components/Farm/HiddenBunnyPeek.tsx` | inline → import |
| `lib/economy/dailyCap.ts` | inline → import |
| `components/Inventory/AdRewardChannelModal.tsx` | inline → import |

`dailyMissions.ts` 가 기존 `export function kstDayKey` 였기 때문에 import + re-export 패턴 (`import { kstDayKey } from ".../kst"; export { kstDayKey };`) — 기존 caller (`weeklyMissionsStore.ts`) 는 그대로.

## 테스트 — `src/lib/kst.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| 정상 KST 시간 | UTC 2026-05-17 00:00 → KST 2026-05-17 09:00 → "2026-05-17" |
| 자정 KST 경계 (UTC 14:59 → 15:00) | 2026-05-17 vs 2026-05-18 |
| zero-pad 월/일 1자리 | "2026-01-01" |
| default arg | regex match |
| 결정적 (same in/same out) | OK |

7 신규 tests. 총 **225 / 225 pass**.

## 회귀 안전성

- 모든 사이트의 `kstDayKey()` 호출 시그니처 동일 (default arg `now = new Date()`).
- 로직 변경 없음 (단순 추출).
- weeklyMissionsStore.ts 의 `import { kstDayKey } from "./dailyMissions"` 호환 (re-export).

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 225 / 225 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## Round 14 (이월) 후보

여전히:
- `focus_night` legacy 정리 (legacy MissionType 정리)
- 타임존 shift edge case
- INTERACTION a11y polish (TabBar dot, icon button aria-label 등)
- THEME accent-carrot small text contrast
- PROB FarmDropTable 추출
