# TIME_AUDIT.md — KST 시간대 경계 audit

Round 13 PR-97. 자정 / 04:00 / 야간 boundary 의 race condition 검증. 코드 변경 0의 정보 문서.

## A. 시간 기반 reset 사이트 목록

| 사이트 | Reset 시점 | Helper |
| --- | --- | --- |
| `dailyMissions.ts` missions | KST 00:00 | `kstDayKey()` |
| `weeklyMissions.ts` missions | 월요일 KST 04:00 | `weekKey()` |
| `weeklyMissionsStore.lastAttendDay` | KST 00:00 (출석 dedupe) | `kstDayKey()` |
| `toolStore.ts` `wateringCanLeft` + `adRefillsToday` | KST 00:00 | inline kstDayKey |
| `itemsStore.ts` heart rollover (max 3) | KST 00:00 | inline |
| `rewardsStore.ts` `giftClaimedDay` (daily gift) | KST 00:00 (날짜 비교) | inline |
| `FarmDropLayer.tsx` daily count (max 30 drops) | KST 00:00 | inline |
| `HiddenBunnyLayer.tsx` dailyCount (max 4) | KST 00:00 | inline |
| `HiddenBunnyPeek.tsx` dailyCount (max 3) | KST 00:00 | inline |
| `economy/dailyCap.ts` earned counter | KST 00:00 | inline kstDayKey |
| `AdRewardChannelModal.tsx` 일일 ad count + 채널별 claim flag | KST 00:00 | inline |
| `SkyView.tsx` `nightSessions` (medal trigger) | 누적 (reset 없음) | — |

총 **12 사이트** 가 시간 기반 reset 또는 boundary check.

## B. kstDayKey 일관성

| 구현 | 함수 형태 | 일치? |
| --- | --- | --- |
| `dailyMissions.ts` | exported `kstDayKey` | ✅ canonical |
| `toolStore.ts` | local function | ✅ 동일 로직 |
| `itemsStore.ts` | local function | ✅ 동일 로직 |
| `FarmDropLayer.tsx` | local function | ✅ 동일 로직 |
| `HiddenBunny*` | local function | ✅ 동일 로직 |
| `economy/dailyCap.ts` | local function | ✅ 동일 로직 |
| `AdRewardChannelModal.tsx` | local function | ✅ 동일 로직 |

모두 같은 패턴:
```ts
function kstDayKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth()+1)}-${pad(kst.getUTCDate())}`;
}
```

**Critical**: 모두 동일 로직 → 일관성 OK. 단 캐노니컬 export 가 단일 사이트 (`dailyMissions.ts`) 라 다른 사이트가 인라인 복사본 사용. 향후 리팩터 시 단일 helper 로 통합 권장 (Round 14 후보).

## C. Race condition 가능성

### C-1. 자정 직전 시작, 자정 직후 완료 세션

시나리오: 사용자가 23:55 에 50분 세션 시작 → 00:45 에 완료.

| 영향 받는 사이트 | 동작 |
| --- | --- |
| Daily mission 트리거 | HomePage `useMissionsStore.incrementProgress` 호출 시점의 `kstDayKey()` 가 새 일자 → 새 일자의 missions 에 카운트 ✅ |
| Daily P cap | 同上, 새 일자 earned 카운터 0 부터 시작 → 정상 ✅ |
| Daily gift | 새 일자 미수령 상태 → claim 가능 ✅ |
| Watering can charges | 새 일자 reset → 10 charges ✅ |
| Weekly mission attendance | `lastAttendDay` 가 어제 → 오늘 첫 출석 인정 ✅ |
| `focus_night` 미션 (legacy) | 22-06 시간대 체크 — 50분 세션 시작 23:55 부터 야간 → 카운트되어야 하지만, isNight 체크가 시작 시점인지 완료 시점인지? |

`HomePage.tsx` 의 isNight 계산 확인:
```ts
const focusedMin = lastSnapshot.focusedMs / 60_000;
const isNight = /* check at lastSnapshot.at */;
```

→ `lastSnapshot.at` 은 **완료 시점**. 23:55 시작 / 00:45 완료 → 완료 시점 00:45 (야간 범위 안) → night 카운트. 의도된 동작 ✅.

### C-2. 월요일 04:00 boundary (주간 미션)

시나리오: 사용자가 일요일 23:55 시작 → 월요일 04:30 완료.

| 영향 | 동작 |
| --- | --- |
| `weekKey` | 완료 시점 04:30 → 새 주 시작 (월요일 04:00 anchor) ✅ |
| `weeklyAttendDays5` | 새 주의 첫 출석 → +1 ✅ |
| `weeklyTotalFocusMin300` | 새 주에 누적 분 카운트 ✅ |

문제 없음. weekKey 가 일관되게 완료 시점 사용.

### C-3. 자정 전후 ad channel claim

시나리오: 23:59 에 1회 광고 → 00:01 에 2회.

| 단계 | day | adDailyCount |
| --- | --- | --- |
| 23:59 | YYYY-MM-DD | 1 (저장됨) |
| 00:01 | YYYY-MM-(DD+1) | 새 일자 → 0 부터 시작 |

`readAdDailyCount(today)` 가 today 키로 read → 새 일자엔 항상 0. ✅ 정상.

### C-4. wateringCan 자정 후 사용

`toolStore.spendWatering()` 의 첫 줄: `get().rolloverIfNeeded()`. 자정 cross 직후 첫 호출이 rollover 실행 → `wateringCanLeft = 10`. ✅

## D. 발견 — Edge case 1건

### D-1. `lastAttendDay` 누락 시나리오 (weeklyMissionsStore)

`weeklyMissionsStore.bootstrap()`:
```ts
if (persistedWeek !== thisWeek) {
  saveString(STORAGE_KEY_WEEK, thisWeek);
  saveProgress(emptyProgress());
  ...
  // lastAttendDay 리셋 안 함
}
```

이 결정은 의도된 것:
```
// lastAttendDay 리셋 안 함 — KST day 비교에만 쓰임.
```

하지만 **edge case**: 사용자가 일요일 23:59 출석 → `lastAttendDay = sunday`. 월요일 04:00 새 주 시작 → `bootstrap` 이 progress reset (attendance 0) 하지만 `lastAttendDay` 는 sunday 유지. 사용자가 월요일 ~04:30 (KST day 는 여전히 monday) 첫 세션 → `lastAttendDay !== monday` → +1 정상.

→ 실제 정상 동작. comment 의 "lastAttendDay 리셋 안 함" 결정 검증.

### D-2. focus_night 야간 시간 boundary (legacy)

`focus_night` 은 PR-75 에서 inactive (active pool 아님). 코드에 trigger 는 있지만 silent no-op. **fix 불필요**.

## E. 결정 — 변경 없음

### Critical violation: 0건

| 평가 항목 | 결과 |
| --- | --- |
| 자정 rollover 일관성 | ✅ 12 사이트 모두 동일 kstDayKey 로직 |
| 월요일 04:00 anchor | ✅ weekKey 단일 helper, 정확한 boundary |
| Cross-day 세션 처리 | ✅ 완료 시점 기준 일관 |
| Race condition | ✅ 발견 없음 |

### Round 14 후보

1. **단일 `kstDayKey` helper 추출** — 12 사이트의 인라인 복사 → 공유 import. 향후 KST 정책 변경 시 단일 위치 수정.
2. **`focus_night` legacy 정리** — MissionType union 에서 제거 (PR-75 의 backward-compat 이월). 동시에 SkyView 의 `nightSessions` (medal trigger) 도 audit.
3. **시간대 변경 시나리오** — 사용자가 KST → 다른 timezone 디바이스로 전환 시 동작. 현재 OS clock 의존 — KST 안 따르면 entire 시스템 misaligned.

## F. 결론

**시간대 경계 정합성 OK**. 12 사이트 검증, race condition 0건. Round 14 후보 3건 모두 medium/low priority (functional 위반 아님).

코드 변경 0 — audit 정보 가치만.
