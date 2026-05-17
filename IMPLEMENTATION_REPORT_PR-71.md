# IMPLEMENTATION_REPORT_PR-71.md — dogam medal + 패시브 12-char universe 재배치

## 발견된 정합 이슈 (Round 8 보고서 후보 #4)

| 측면 | 이전 | 실제 도달 가능 |
| --- | --- | --- |
| `CHARACTERS.length` | 12 | 12 |
| `dogam_25` medal trigger | `obtainedCount >= 25` | **불가능** |
| `dogam_50` medal trigger | `>= 50` | **불가능** |
| `dogam_75` medal trigger | `>= 75` | **불가능** |
| `dogam_100` medal trigger | `>= 100` | **불가능** |
| `passivesFromOwned` 상위 임계 (5/10/15/20/25) | 25 까지 분포 | 5 까지만 도달 가능 (5마리도 어려움) |

즉 도감 시스템 전체의 75% 가 12-char universe 에서 영원히 비활성. PR-65 의 `nextPassiveLabel` banner 도 사용자가 영영 도달 못 하는 25마리 라벨을 표시.

## 수정 — 12-char universe 비례 배치

### 1. `DOGAM_TOTAL` 신규 export

`src/features/collection/collectionData.ts`:
```ts
export const DOGAM_TOTAL = CHARACTERS.length; // 현재 12
```

향후 캐릭터 추가 시 자동 재계산.

### 2. Medal 임계 재배치 (CollectionPage)

```ts
const t25 = Math.ceil(DOGAM_TOTAL * 0.25); // = 3
const t50 = Math.ceil(DOGAM_TOTAL * 0.5);  // = 6
const t75 = Math.ceil(DOGAM_TOTAL * 0.75); // = 9
const t100 = DOGAM_TOTAL;                  // = 12
```

캐릭터가 25, 50 등으로 늘어도 비율 그대로 유지.

### 3. Medal description / unlockHint 재작성

| Medal | Before | After |
| --- | --- | --- |
| dogam_25 | "토끼 25마리를 만났어요" / "도감 25마리 unlock" | "도감 1/4 (25%) 를 채웠어요" / "도감 25% 진행" |
| dogam_50 | "토끼 50마리와 친해졌어요" / "도감 50마리 unlock" | "도감 절반 (50%) 을 채웠어요" / "도감 50% 진행" |
| dogam_75 | "토끼 75마리와 친해진 진짜 영웅" / "도감 75마리 unlock" | "도감 3/4 (75%) 를 채운 진짜 영웅" / "도감 75% 진행" |
| dogam_100 | "모든 토끼를 만난 전설. 일일 P 캡 +10..." / "도감 100마리 모두 unlock" | (description 유지) / "도감 100% 완성" |

### 4. dogamPassives.ts 임계 재배치

| 임계 | Before | After (PR-71) | 효과 |
| --- | --- | --- | --- |
| candyBonusP | 1 | 1 | 캔디 확률 +0.1%p |
| goldenBonusP | 5 | **2** | 황금 확률 +0.1%p |
| sessionCarrotMul | 10 | **4** | 세션 당근 ×1.05 |
| adRewardBonusCarrot | 15 | **6** | 광고 보상 +1 carrot |
| giftBoostX | 20 | **9** | 일일 gift ×1.5 |
| dailyCapBoost | 25 | **12** | 일일 P 캡 +10 (= dogam_100 medal 과 동시) |

12마리 = dogam_100 = dailyCapBoost — "도감 완성" 단일 celebration milestone.

### 5. nextPassiveLabel 라벨 재작성

```
0 → "1마리: 캔디 확률 +0.1%p"
1 → "2마리: 황금 확률 +0.1%p"
3 → "4마리: 세션 당근 +5%"
5 → "6마리: 광고 보상 +1 당근"
8 → "9마리: 오늘의 선물 보너스 +50%"
11 → "12마리: 일일 P 캡 100 → 110 (도감 완성)"
12 → null
```

## "중복 정리" 의미

dogam_100 medal + dailyCapBoost passive 모두 12마리 (100% 도감) 에서 발동.
- Medal = 시각적 celebration (trophy-legend.png)
- Passive = 메커닉적 보상 (+10 P daily cap)
- 둘은 **상호보완**, 중복 아님. PR-71 은 이 의도를 명시화.

## 변경 파일

- `src/features/collection/collectionData.ts` — `DOGAM_TOTAL` 신규 export
- `src/features/collection/medalsConfig.ts` — dogam_* 4종 description / unlockHint 재작성
- `src/pages/CollectionPage.tsx` — threshold 비율 기반 계산 + DOGAM_TOTAL import
- `src/lib/dogamPassives.ts` — 6 임계 (1/2/4/6/9/12) + nextPassiveLabel
- `src/lib/dogamPassives.test.mjs` — 7 테스트 케이스 재작성

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **130 / 130 pass** (dogamPassives 7 tests 갱신, 다른 lib 영향 없음) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
