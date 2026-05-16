# IMPLEMENTATION_REPORT_PR-17.md — follow-up 묶음 (buff indicator + weekly treasure + DAILY 정합)

세 follow-up 일괄 진행. 각각 별도 commit.

## A. PR-17a — Buff active indicator

### 결정
- 화면 어딘가 ≡ 농장 카드 상단, "☁ 하늘 보기" 버튼 바로 아래
- 가로 row 배치, 활성 buff 만 표시 (즉, juice/soup/cake 중 활성된 것)
- 색깔: 노랑 (juice), 주황 (soup), 핑크 (cake) — 사용자 spec 와 일치
- `pointerEvents: none` — 시각 정보 전용, 인터랙션 차단

### 변경
- **신규**: `src/components/Farm/BuffIndicator.tsx` — `useBuffsStore` 3 플래그 직접 구독. PILLS spec 배열 + 활성 필터링.
- **수정**: `src/features/collection/FarmHub.tsx` — `<BuffIndicator />` mount, ToolDock 위에 absolute.

기존 trigger consumers (FarmHub harvest / toolStore refill / HomePage focus) 가 `consume()` 호출 시 자동으로 사라짐 — atomic read+clear 이후 zustand state 가 바뀌어 `useBuffsStore` 가 다시 렌더링 → pill 사라짐.

## B. PR-17b — Weekly treasure 클라 wire

### 결정
- 진행도 모델: 0..7 카운터 (worker `treasure_box_state` 동일 mental model)
- 7 도달 시 `WEEKLY_TREASURE_TABLE` 추첨 → 진행도 0 reset
- 누적 source: 광고 보상 모달의 "보물" 채널 (기존 토스트 "🌟 보물 진행 +1" 는 implementation 이 없었음 — PR-17b 가 실제로 wire)
- "주간 1회" 의미 — KST 주차 cap 없이 progress=7 도달 시 언제든 open. worker 모델 따름. 다른 시점 (예: KST 일요일 자정 강제 reset) 은 out-of-scope.

### 변경
- **수정**: `src/features/collection/rewardsStore.ts`
  - 신규 export `WEEKLY_TREASURE_GOAL = 7`
  - 신규 state: `treasureProgress` (0..7), `lastTreasureReward`
  - 신규 actions: `addTreasureProgress(n)`, `openTreasureChest(rng)` (반환 = rolled `TableEntry` or null)
  - safeStorage 영속: `cc.rewards.treasureProgress.v1`
- **수정**: `src/components/Inventory/AdRewardChannelModal.tsx`
  - `case "treasure"` 에 `useRewardsStore.getState().addTreasureProgress(1)` 추가 (기존 star+1 은 유지 — 둘 다 보상)
- **수정**: `src/features/collection/farmStore.ts`
  - 신규 `incCarrots(n)` action — weekly treasure 의 `carrot +5` 보상 grant 경로 (이전엔 carrots 가 harvest 외 경로로 증가 불가)
- **수정**: `src/components/Farm/RewardsPanel.tsx`
  - `useRewardsStore` 에서 `treasureProgress` + `openTreasureChest` + `WEEKLY_TREASURE_GOAL` 가져옴
  - `useFarmStore` 에서 `incCarrots`, `growAllPlanted` 가져옴
  - 신규 state `lastTreasureText` — 모달 close 시 reset
  - 신규 handler `onOpenTreasure`: 추첨 → kind 별 store grant (candy/golden/carrot/seed/star) + giftbox SFX + toast
  - 신규 `Section title="주간 보물상자"`: 진행도 progress bar, 7/7 도달 시 활성 "열기" 버튼, 마지막 보상 text 표시
  - 신규 helper `treasureToText(t)` — `🍬 +N (+M P)` 형식
  - `toast` import 추가 (이전 누락 발견 — 본 PR 내부에서 typecheck 가 잡음)

### 보상 dispatch 매트릭스
| kind | grant 경로 |
| --- | --- |
| candy | `incCandy(n)` |
| golden | `incGolden(n)` |
| carrot | `incCarrots(n)` (신규 action) |
| seed | `growAllPlanted(0, null, n)` (PR-7 gem 과 같은 side-door) |
| star | `useItemsStore.getState().add("star", n)` |

## C. PR-17c — DAILY 테이블 3 소스 정합

### 진단
- `src/lib/giftRoll.ts → rollGift` (런타임 SoT): 60/24/8/6/2 (seed/candy/golden/seed3/gem) → EV 2.0 P
- `src/lib/rewardTables.ts → DAILY_GIFT_TABLE` (문서/테스트): 40/30/18/7/5 (seed/carrot/candy/golden/star) → EV 1.9 P
- `cloudflare/.../routes/boxes.ts → DAILY` (worker, 미연결): 동일 40/30/...

세 테이블이 historically 다른 모델. 런타임 영향 없었음 (rewardTables/worker 둘 다 dormant). 정합 작업으로 미래 워커 와이어업 시 의외 디버깅 방지.

### 변경
- **수정**: `src/lib/rewardTables.ts`
  - `RewardKind` 에 `"gem"` 추가
  - `DAILY_GIFT_TABLE` 을 giftRoll.ts 와 같은 5 band (gem 포함)로 교체. EV 1.9 → 2.0 P.
  - doc-comment 갱신
- **수정**: `cloudflare/workers/carrot-carrot-api/src/routes/boxes.ts`
  - DAILY 인라인 테이블을 동일하게 5 band 로 교체. doc-comment 에 PR-17c 의도 명시.
- **수정**: `src/lib/rewardTables.test.mjs`
  - EV assertion 1.9 → 2.0
  - last entry test: `star` → `gem` (재배치)
  - golden bucket test: rng 0.9 → 0.88 (golden bucket 위치 변경)
  - 클램프 테스트: out-of-range 양수 클램프 결과 `star` → `gem`

WEEKLY_TREASURE_TABLE 은 PR-17b 의 `openTreasureChest` 의 SoT 로 사용 — 변경 없음.

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **93/93 pass** (rewardTables 8개 케이스 그대로 통과, 신규 EV 어서션 반영) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

## E. Maintainer 후속 조치

없음. 모든 변경 client + worker 코드 only — DB 마이그 / 시크릿 / wrangler 호출 불필요.

## F. 다음 작업

옵션 C 라이프사이클 후속 (PR-7~10) + UI 폴리시 (PR-11/14/15) + 큰 PR (PR-13 audio + PR-16 스와이프) + follow-up (PR-17a/b/c) 모두 완료.

남은 hard-stop:
- ad-token verification (Apps-in-Toss 시크릿 hard-stop)
- 시즈널 토끼 PNG (사용자 자산 업로드)
- BGM mp3 drop-in (사용자 자산 업로드)
