# IMPLEMENTATION_REPORT_PR-76.md — 주간 미션 신설

## 동기

PR-75 가 일일 미션을 학습 중심으로 정비했으니, 주간 단위 장기 보상 layer 추가. user spec: 3 missions, Monday 04:00 KST reset, 보물상자 정합성 보장.

## 신규 — 3 주간 미션

| Type | Title | Threshold | Reward | 트리거 |
| --- | --- | --- | --- | --- |
| `weeklyAttendDays5` | 주 5일 집중 출석 | 5 | +30 P + 보물상자 보장 | HomePage focus 완료 시 (오늘 첫 출석 dedupe) |
| `weeklyTotalFocusMin300` | 주 누적 5시간 집중 | 300 | +50 P | HomePage focus 완료 시 +floor(min) |
| `weeklyPerfectCombo5` | 주 퍼펙트 콤보 5회 | 5 | +20 P | FarmHub allRipe 9-plot harvest |

총 EV = 30 + 50 + 20 + 20 (all-complete bonus) = **120 P / 주**.

## 신규 파일

### `src/features/missions/weeklyMissions.ts`

- `WeeklyMissionType` union
- `WEEKLY_MISSIONS` defs
- `weekKey(now)` — 월요일 04:00 KST anchor. UTC ms → KST → 4시간 shift → Monday 찾기.
- `totalWeeklyEv()` helper
- `WEEKLY_ALL_COMPLETE_BONUS_P = 20`

### `src/features/missions/weeklyMissionsStore.ts`

- 패턴은 missionsStore (daily) 와 동일. 차이:
  - `weekKey()` 기준 rollover (daily 는 `kstDayKey()`)
  - `recordFocusSession(min)` — `weeklyTotalFocusMin300 += min` + KST day dedupe attendance (`STORAGE_KEY_LAST_ATTEND` 비교).
  - `recordPerfectCombo()` — counter
- safeStorage 키 5개 (`week`, `progress`, `claimed`, `bonusClaimed`, `lastAttendDay`) v1.

### `src/features/missions/WeeklyMissionsCard.tsx`

DailyMissionsCard 와 동일한 UI 패턴. 차이:
- 헤더 "이번 주 목표"
- `weeklyAttendDays5` claim 시 `rewardsStore.addTreasureProgress(7)` 호출 → 주간 보물상자 자동 충족 (user spec "보물상자 보장")

## Wire 사이트

### `src/pages/HomePage.tsx`

```tsx
<DailyMissionsCard />
<WeeklyMissionsCard />  // PR-76 추가
```

Focus 완료 hook:
```ts
useWeeklyMissionsStore.getState().recordFocusSession(focusedMin);
```

### `src/features/collection/FarmHub.tsx`

Perfect combo 직후:
```ts
useWeeklyMissionsStore.getState().recordPerfectCombo();
```

## 기존 weekly-treasure 와의 정합성

- `rewardsStore.addTreasureProgress(n)` 가 `WEEKLY_TREASURE_GOAL = 7` cap 까지 증분. 본 PR 의 attendance claim 이 `addTreasureProgress(7)` 호출 = "7로 채움" (cap 안전).
- 보물상자 자체 reward 는 별도 — 사용자가 `claimTreasure()` 로 직접 open. attendance claim 은 **progress 보장만** 한다.
- 기존 보물상자 progress 트리거 (focus complete 시 +1 등) 는 그대로. attendance claim 은 추가 푸쉬일 뿐.

## 테스트 — `src/lib/weeklyMissions.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| WEEKLY_MISSIONS 3개 | length |
| 학습 중심 type set | weeklyAttendDays5 / weeklyPerfectCombo5 / weeklyTotalFocusMin300 |
| Reward 정확 — 30/50/20 | per type |
| Threshold 정확 — 5/300/5 | per type |
| totalWeeklyEv === 120 | 30+50+20+20 |
| BONUS === 20 | OK |
| weekKey: 월요일 04:00 anchor | 3 boundary 검증 (03:59 / 04:00 / 04:01 KST) |
| weekKey: 주중 → 같은 월요일 | Wed/Fri 동일 결과 |
| weekKey: 일요일 늦은 시간 + 다음 월요일 새벽 | 04:00 전후 boundary |
| weekKey: 결정적 | 같은 입력 같은 결과 |

10 신규 tests. 총 **158 / 158 pass**.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 158 / 158 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
