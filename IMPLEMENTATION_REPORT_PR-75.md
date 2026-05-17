# IMPLEMENTATION_REPORT_PR-75.md — 일일 미션 게임 중심 → 공부 중심 재설계

## 동기

PR-52 (구버전) 미션 pool 12종 중:
- `tool_use` (도구 3개 사용) — 학습과 무관, 게임 플레이 강제
- `ad_watch` (광고 3회) — 학습 무관
- `drop_pickup` (드랍 5개 줍기) — 학습 무관
- `candy_harvest` (캔디 3개) — 학습 무관

학습 도구 톤과 어긋남.

## 변경 — 고정 3 미션

매일 같은 3개 (랜덤 X). 모두 학습 중심.

| Type | Title | Threshold | Reward | Trigger |
| --- | --- | --- | --- | --- |
| `min25Sessions2` | 25분 이상 집중 2회 | 2 | +10 P | HomePage focus 완료 시 focusedMin >= 25 → +1 |
| `totalFocusMin50` | 오늘 누적 50분 집중 | 50 | +15 P | HomePage focus 완료 시 +Math.floor(focusedMin) |
| `perfectCombo1` | 퍼펙트 콤보 1회 | 1 | +5 P | FarmHub allRipe 9-plot harvest |

총 보상 EV = 30 P + 5 P (all-complete bonus) = **35 P / 일**.

## 변경 파일

### `src/features/missions/dailyMissions.ts` — pool 재설계

- `MissionType` union 확장: 새 3종 + 기존 12종 (legacy, inactive).
- `MISSION_POOL` 교체: 3 fixed missions.
- `pickDailyMissions(day)` → 무조건 `MISSION_POOL.slice(0, count)` (시그니처 유지, 결정성 보장).

### `src/features/missions/missionsStore.ts` — storage migration

- `STORAGE_KEY_*` v1 → v2. 구버전 데이터 자동 무효화 (key 분리), fresh start.
- `emptyProgress()` 에 새 3 type + 기존 12 type 모두 0 으로 초기화.

### `src/pages/HomePage.tsx` — focus 완료 trigger

```ts
// 기존 legacy trigger (no-op in PR-75 pool):
if (focusedMin >= 25) missions.incrementProgress("focus_25", 1);
if (focusedMin >= 50) missions.incrementProgress("focus_50", 1);

// PR-75 새 active trigger:
if (focusedMin >= 25) {
  missions.incrementProgress("min25Sessions2", 1);
}
missions.incrementProgress("totalFocusMin50", Math.floor(focusedMin));
```

50분 세션은 `min25Sessions2` 에도 카운트 (25분+ 조건 충족). user spec: "25분 또는 50분 세션 둘 다 카운트".

### `src/features/collection/FarmHub.tsx` — perfect combo trigger

```ts
useMissionsStore.getState().incrementProgress("perfect_combo", 1); // legacy
useMissionsStore.getState().incrementProgress("perfectCombo1", 1); // active
```

## Legacy MissionType 처리

`focus_25 / focus_50 / focus_night / ad_watch / bunny_new / golden_harvest / candy_harvest / drop_pickup / medal_unlock / perfect_combo / tool_use / friend_invite` — `MissionType` union 에 유지. 기존 trigger 사이트 (`incrementProgress("tool_use", 1)` 등) 는 코드 그대로. 단 `missionsStore.incrementProgress()` 가 `active.find((m) => m.type === type)` 로 active pool 만 매치하므로 legacy type 호출은 **silent no-op**.

이 backward-compat 덕분에 PR-75 변경 폭이 작고 (3 trigger 추가 / 0 trigger 제거), 안전.

## Migration

| Storage Key | 이전 (v1) | PR-75 (v2) |
| --- | --- | --- |
| `cc.missions.day` | v1 데이터 보존 (사이드, 사용 안 함) | v2 fresh start |
| `cc.missions.progress` | 同上 | v2 fresh, 새 type 키 포함 |
| `cc.missions.claimed` | 同上 | v2 fresh |
| `cc.missions.bonusClaimed` | 同上 | v2 fresh |

기존 사용자의 오늘 progress / claimed 상태는 리셋. user spec 의 "reset 또는 grandfather" 중 reset 선택 — 미션 pool 자체가 바뀌었기 때문에 grandfather 불가능.

## 테스트 — `src/lib/dailyMissions.test.mjs` 재작성

| 케이스 | 검증 |
| --- | --- |
| 고정 3개 학습 중심 | pool length 3 + 타입 매트릭스 |
| 게임 강제 미션 제거 | tool_use / ad_watch / drop_pickup / candy_harvest 부재 |
| DAILY_MISSION_COUNT === 3 | OK |
| ALL_COMPLETE_BONUS_P === 5 | OK |
| Reward 정확 — 10/15/5 | match per type |
| Threshold 정확 — 2/50/1 | match per type |
| pickDailyMissions 고정 | 다른 day 도 같은 3개 |
| 결과 3개 | length check |
| totalMissionEv === 35 | 10+15+5+5 |
| 한국어 title | 사용자 친화 라벨 |

10 신규 tests (구버전 8개 → 새 10개). 총 **148 / 148 pass**.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 148 / 148 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
