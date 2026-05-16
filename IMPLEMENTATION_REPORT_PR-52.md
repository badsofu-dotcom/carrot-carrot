# IMPLEMENTATION_REPORT_PR-52.md — 일일 미션 시스템

12종 pool 에서 매일 3개 deterministic pick + 8 trigger 사이트 + UI 카드 + bonus.

## A. 신규 파일

1. **`src/features/missions/dailyMissions.ts`**
   - `MISSION_POOL: MissionDef[]` (12 종)
   - `pickDailyMissions(day, count)` — day-key fnv1a hash 기반 Fisher-Yates 결정적 pick
   - `kstDayKey()` helper
   - `DAILY_MISSION_COUNT = 3`, `ALL_COMPLETE_BONUS_P = 5`
2. **`src/features/missions/missionsStore.ts`** — zustand store
   - state: `day / missions[3] / progress / claimed / bonusClaimed`
   - actions: `incrementProgress(type, n) / claim(type) / claimAllBonus() / rerollForToday / reset`
   - safeStorage 4 키 (day / progress / claimed / bonus)
   - bootstrap: KST cross-day 시 reset
3. **`src/features/missions/DailyMissionsCard.tsx`** — 홈 탭 UI
   - 3 progress bars + per-mission claim 버튼
   - all-complete 시 +5 P bonus 버튼
   - 클릭 → `incCarrots(P)` + toast + haptic
4. **`src/lib/dailyMissions.test.mjs`** — 8 test (pool 12 / pick 결정성 / no-duplicate / EV 계산)

## B. Trigger 사이트 wiring (8)

| 사이트 | 미션 type | event |
| --- | --- | --- |
| HomePage focus complete (≥25min) | focus_25 | direct |
| HomePage focus complete (≥50min) | focus_50 | direct |
| HomePage focus complete (KST 22-06) | focus_night | direct |
| AdRewardChannelModal claim | ad_watch | direct |
| FarmHub → cc:bunny-gacha:show listener | bunny_new | event listener |
| FarmHub → cc:medal:unlocked listener | medal_unlock | event listener |
| FarmHub candy outcome | candy_harvest | direct |
| FarmHub golden outcome | golden_harvest | direct |
| FarmHub allRipe trigger | perfect_combo | direct |
| FarmDropLayer.grant | drop_pickup | direct |
| InventoryModal.onUse | tool_use | direct |
| (PR-54 wire 예정) | friend_invite | TODO |

## C. UI

HomePage `<SoundSheet>` 아래에 `<DailyMissionsCard />` mount. 카드 디자인:
- 헤더: "오늘의 목표" + claimed N/3
- 행: emoji + 제목 + progress bar + 수령 버튼
- claimed 행: gray 처리 + "완료" 라벨
- 모두 클리어 시 보너스 +5P 풀 가로 버튼 노출

## D. EV 영향

평균 일일 미션 EV: **15~20 P** (3개 pick × 평균 5P + bonus 5P).

기존 EV 합 (PR-32: ~173 P) + 미션 EV (~17 P) = **~190 P** 잠재 / 사용자 활동.
- 100 P 캡 (도감 100마리 시 110 P) 으로 anti-abuse 자연 차단.
- 미션이 사용자 활동을 다양화 (집중 / 광고 / 농장 / 도감 / 도구 모두 동기 부여).

ECONOMY_DESIGN.md 의 일일 미션 표 + EV 갱신.

## E. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **118/118 pass** (PR-52 dailyMissions +8) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

## 다음 작업

PR-50 (토끼 100마리 풀 정의).
