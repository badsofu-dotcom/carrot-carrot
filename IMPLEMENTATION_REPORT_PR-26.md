# IMPLEMENTATION_REPORT_PR-26.md — 훈장 위치 이동 (선물박스 → 도감)

선물박스(RewardsPanel) 를 광고/포인트 허브로 재정의. 훈장(도전 과제) 그리드는 도감 페이지로 이동.

## A. 새 구조

| 영역 | 내용 | 변화 |
| --- | --- | --- |
| **선물박스 (RewardsPanel)** | 토스포인트 + 오늘의 선물 + 주간 보물 | 훈장 섹션 제거 |
| **도감 페이지 (CollectionPage dogam view)** | 진행 카드 + **도전 과제 (신규)** + 필터 chips + 토끼 그리드 | AchievementsCard 신설 |

## B. 변경 파일

1. **신규**: `src/features/collection/AchievementsCard.tsx`
   - `ALL_ACHIEVEMENT_MEDALS` (11 IDs)
   - `medalAsset(id)` — gold/silver/bronze 매핑 (구 RewardsPanel medalAsset 이전)
   - `<AchievementsCard />` — 진행 표시 (`unlocked / 11 달성`) + 그리드 (auto-fit, 86 px min-col). 잠긴 메달은 회색 + opacity 0.45.
2. **수정**: `src/pages/CollectionPage.tsx`
   - `AchievementsCard` import.
   - 도감 view 의 진행 카드 바로 아래에 `<AchievementsCard />` mount.
3. **수정**: `src/components/Farm/RewardsPanel.tsx`
   - 훈장 Section 통째로 제거 (lines 567-619).
   - 미사용 import 정리: `MEDAL_LABELS`, `MedalId`, `MEDAL_ORDER` 로컬 상수, `medals` state subscribe, `medalAsset` 함수 모두 삭제.

## C. 동작 변화

- 사용자가 선물박스(🎁) 열면 → 토스포인트 / 오늘의 선물 / 주간 보물 3 섹션만. 훈장 보이지 않음.
- 도감 탭 (📖) 진입 시 진행 카드 바로 아래에 "도전 과제 N/11 달성" 카드 노출. 11 메달 grid.
- DEV "메달 전부 unlock" cheat — 양쪽 사이트 (도감 페이지) 가 즉시 반영. RewardsPanel 은 더 이상 메달 표시 안 함.

## D. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-28 (ToolDock 5번째 슬롯 — 광고).
