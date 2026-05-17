# IMPLEMENTATION_REPORT_PR-104.md — 미션 드롭다운 회귀 fix (P0)

## 진단

사용자 보고: "▼ 화살표 보이는데 button 탭해도 펼쳐지지 않음"

코드 audit:
- `DailyMissionsCard / WeeklyMissionsCard` 의 `forceCollapsed` 시 toggle 차단 (의도된 동작)
- `HomePage` 가 `forceCollapsed={isFocusing || isPaused}` 로 전달

**원인**: PR-100 의 PAUSED 포함 정책. 사용자가 timer 일시정지 후 미션 카드 펼치려 시도 시 토글 차단. PAUSED 는 학습 흐름이 잠시 멈춘 상태 — 게임/미션 interaction 허용해야 자연.

## Fix

### `HomePage.tsx`

```diff
- <DailyMissionsCard forceCollapsed={isFocusing || isPaused} />
- <WeeklyMissionsCard forceCollapsed={isFocusing || isPaused} />
+ <DailyMissionsCard forceCollapsed={isFocusing} />
+ <WeeklyMissionsCard forceCollapsed={isFocusing} />
```

이제:
- **IDLE** → forceCollapsed=false → toggle 작동
- **FOCUSING** → forceCollapsed=true → 강제 접힘 (집중 보호)
- **PAUSED** → forceCollapsed=false → toggle 작동 (학습 중단 — 게임 interaction 허용)
- **DONE / ABANDONED** → forceCollapsed=false → toggle 작동

### `missionToggle.ts` (신규)

회귀 차단 목적으로 toggle 로직을 pure helpers 로 추출 → unit test 가능.

```ts
export function computeExpanded(forceCollapsed, userExpanded): boolean;
export function nextUserExpanded(forceCollapsed, currentUserExpanded): boolean;
export function canToggle(forceCollapsed): boolean;
```

DailyMissionsCard / WeeklyMissionsCard 의 inline 로직을 helper 호출로 교체.

## 테스트 — `src/lib/missionToggle.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| computeExpanded force=true | 항상 false |
| computeExpanded force=false | userExpanded 반영 |
| nextUserExpanded force=false | 반전 |
| nextUserExpanded force=true | 변경 없음 |
| canToggle | NOT force |
| **회귀 차단: IDLE toggle 작동** | OK |
| **PR-104: PAUSED toggle 허용** | canToggle(false) === true |
| **FOCUSING toggle 차단** | canToggle(true) === false + state 변경 없음 |

8 신규 tests. 총 **233 / 233 pass**.

## 변경 파일

- `src/pages/HomePage.tsx` — `forceCollapsed` derivation 수정
- `src/features/missions/missionToggle.ts` (신규) — pure helpers
- `src/features/missions/missionToggle.test.mjs` (신규 in src/lib for test convention) — 8 tests
- `src/features/missions/DailyMissionsCard.tsx` — pure helpers 사용
- `src/features/missions/WeeklyMissionsCard.tsx` — 同上

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 233 / 233 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
