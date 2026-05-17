# PROB_AUDIT.md — 확률 / 카운터 정합성 audit

Round 13 PR-98. 가챠 / 보물 / 드랍 확률 + counter 캡 검증.

## A. 확률 source 표

| Source | 정의 위치 | 확률 (요약) | 명시 vs 하드코드 |
| --- | --- | --- | --- |
| Harvest gacha | `seasonalBunny.ts` constants | bunny 0.5 / golden 0.6 / candy 7 / carrot 91.9 (%) | 명시 ✅ |
| Harvest passives | `dogamPassives.ts` | +0.1/0.1/×1.05/+1/×1.5/+10 by 12-tier | 명시 ✅ |
| Harvest buff (juice/soup) | seasonalBunny RollOpts | +5%p candy / +5%p golden | 명시 ✅ |
| Bunny gacha (4-tier) | `bunnyGacha.ts` TIER_WEIGHTS | common 70 / rare 22 / epic 7 / legendary 1 | 명시 ✅ |
| Bunny gacha harvest excl | `bunnyGacha.ts` excludeLegendary | legendary 0 (harvest) | 명시 ✅ |
| Daily gift | `rewardTables.ts` DAILY_GIFT_TABLE | 60/24/8/6/2 (%) | 명시 ✅ |
| Weekly treasure | `rewardTables.ts` WEEKLY_TREASURE_TABLE | 25/20/20/15/15/5 (%) | 명시 ✅ |
| Farm drop kinds | `FarmDropLayer.tsx` DROPS | gem 30 / bolt 22 / heart 15 / hourglass 10 / juice/soup/cake/seed 4 / golden 2 / hidden_bunny 1 (weights, sum 96) | **하드코드 in component** ⚠ |
| Drop spot clusters | `FarmDropLayer.tsx` CLUSTERS | fence-in 30 / fence-out 25 / mushroom 15 / ... | 同上 ⚠ |
| Ad reward tier | `AdRewardChannelModal.tsx` | 1-2회 +5 / 3-4회 +10 / 5회 +20 / 6-10회 token | **하드코드 inline** ⚠ |
| Ad token random (6-10회) | 同上 | 50/50 gem-or-bolt | 同上 ⚠ |
| HiddenBunnyPeek spot | `HiddenBunnyPeek.tsx` | 5 spot 균등 | 명시 ✅ |

**Critical 위반: 0건**. 모든 확률이 사용자 노출 (reward-disclosure.md) 와 일치 또는 적절히 hidden (드랍 spot 배치 등 UX 무관).

**Round 14 후보**: FarmDropLayer DROPS / CLUSTERS 를 별도 file (lib/farmDropTable.ts) 추출 + test. AdReward 의 tier table 도 별도 const 추출.

## B. 카운터 캡 audit

| 카운터 | Max | Display | 위반? |
| --- | --- | --- | --- |
| `wateringCanLeft` | MAX_DAILY (10) + soup bonus → max 11 | ~~`N/10`~~ → `N` (PR-88) | ✅ fixed |
| `adRefillsToday` | MAX_AD_REFILLS (3) | 광고 시청 채널 내부, 표시 안 됨 | ✅ |
| Ad daily count (광고 카운터) | 명시 max 없음, 누적 | 6-10회 차도 token grant | ✅ (의도된 동작) |
| `heart` count | `maxStack: 5` | **`N/3`** ❌ |
| `weeklyAttendDays5` | threshold 5 | progress bar 5 cap | ✅ |
| `weeklyTotalFocusMin300` | threshold 300 | progress bar 300 cap | ✅ |
| `weeklyPerfectCombo5` | threshold 5 | progress bar 5 cap | ✅ |
| `dailyEarned` (P) | currentDailyCap (100/110) | progress bar | ✅ (PR-90) |
| FarmDropLayer daily | DAILY_CAP 30 | 시각 표시 없음 | ✅ |
| HiddenBunnyLayer (A) | 4 | 시각 표시 없음 | ✅ |
| HiddenBunnyPeek (B) | 3 | 시각 표시 없음 | ✅ |

### B-1. Heart 카운터 캡 위반 ❌ (Critical)

```ts
// ToolDock.tsx
const HEART_DAILY_MAX = 3;  // 광고 칩 분모
const heartCount = itemCounts.heart ?? 0;
// badge: {heartCount}/{HEART_DAILY_MAX}
```

```ts
// itemsStore.ts
{ code: "heart", maxStack: 5, ... }
// comment: "max 3 hearts daily but can be pushed to 5 via friend wave"
```

**실제 동작**:
- KST 자정 rolloverHeartsIfNeeded: heart < 3 면 3 으로 채움. heart >= 3 면 유지.
- 친구 wave: heart +1, max 5 cap.
- 사용 (광고 시청): heart -1.

**버그**: heart count > 3 (4 or 5) 일 때 badge "4/3" 또는 "5/3" 표시.

**Fix 결정 (자율)**: badge 에서 분모 제거. 보유량만 표시.

이유:
1. max 가 동적 (3 base + wave bonus 가능 → 최대 5)
2. wateringCan 도 PR-88 에서 같은 패턴 적용 (분모 제거)
3. 보유량 = 가능 광고 시청 횟수 (1:1 매핑) → 분모 정보 가치 낮음
4. 토스트가 "하트 부족" 시 보충 안내 가능

## C. Fix — Heart badge

```diff
- {heartCount}/{HEART_DAILY_MAX}
+ {heartCount}
```

aria-label 도 단순화:
```diff
- `광고 보고 보상 받기 (${heartCount}/${HEART_DAILY_MAX})`
+ `광고 보고 보상 받기 (하트 ${heartCount}개)`
```

`HEART_DAILY_MAX` 상수는 보존 — 향후 의미 있는 분모 사용 시 활용 가능. 단 ToolDock 안에서 unused 표시되므로 제거.

## D. 결정 — 1건 fix (Heart badge)

| 항목 | 결정 |
| --- | --- |
| Heart "N/3" → "N" | ✅ Critical fix, PR-98 에 포함 |
| AdReward inline tier hardcode 추출 | ❌ Round 14 후보 (functional OK) |
| FarmDrop DROPS const 분리 | ❌ Round 14 후보 |

## E. 결론

확률 정합성: 명시적 정의 강함 (rewardTables / seasonalBunny / bunnyGacha). 일부 사이트 (FarmDropLayer / AdReward) 가 inline hardcode 지만 functional 정확. 카운터 캡 중 heart 만 위반 → 본 PR 에서 fix.
