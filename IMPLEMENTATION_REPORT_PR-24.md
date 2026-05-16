# IMPLEMENTATION_REPORT_PR-24.md — 자원 3종 정체성 정의 + wire

당근코인 / 메달 / 하트 세 자원에 명확한 grant + sink 부여.

## A. 자원별 정의

### 당근코인 (`carrot_coin`)
- **Grant**: 광고 보상 채널 claim 마다 +5 coin (`AdRewardChannelModal`).
- **Sink**: 50 coin → 캔디 당근 +1 (`InventoryModal` carrot_coin 사용 버튼).
- **Cap**: 없음.
- **헤더 chip**: 검토했으나 모바일 375 viewport 에서 5번째 chip 추가 시 우측 도감/보상 버튼 폭이 빠듯 (정합성 깨짐). **InventoryModal 자원 탭에서만 노출**. 향후 폭 마진 확보되면 헤더로 승격.

### 메달 (`medal`)
- PR-26 에서 RewardsPanel → AchievementsCard 로 이동 완료. itemsStore 의 medal **item count** 는 미사용 상태로 그대로 (장기적 활용 — 예: 일일 미션 보상). **본 PR 에서는 별도 변경 없음**.

### 하트 (`heart`) — 광고 시청 토큰
- **Grant**:
  - KST 자정 리필: `current < 3` 이면 3 으로 bump (이상이면 유지 — 친구 wave 누적 보호)
  - 친구 wave: +1 (cap 5, `maxStack` 으로 enforce)
- **Sink**: `AdRewardChannelModal` 모든 채널 claim 성공 path 마지막에서 1 consume.
- **Cap**: `maxStack: 5`.
- **신규 사용자**: 처음 마운트 시 `heartDayKey === null` → 즉시 3 부여 → ad 슬롯 (PR-28) 활성.

## B. 변경 파일

1. **`src/features/collection/itemsStore.ts`**:
   - `ItemDef.maxStack?: number` 추가. `add()` 가 `Math.min(next, cap)` 으로 clamp.
   - `ItemsState.heartDayKey: string | null` + `rolloverHeartsIfNeeded()` action.
   - `STORAGE_KEY_HEART_DAY = "cc.items.heartDay.v1"` 신설.
   - `HEART_DAILY_REFILL = 3`, KST 자정 일자 비교 로직.
   - `carrot_coin` 엔트리: usable: true, minToUse: 50, effect 카피 갱신, acquisition "광고 보상 (채널당 +5 coin)".
   - `heart` 엔트리: maxStack: 5, effect 카피 "광고 시청 토큰 (max 5, 자정 리필 3개)", acquisition "자정 리필 + 이웃 토끼 wave".
2. **`src/components/Inventory/AdRewardChannelModal.tsx`**:
   - claim 진입부 heart gate (`counts.heart <= 0` 면 toast + return).
   - 채널 사이드 이펙트 후 성공 path 마지막에서 `items.consume("heart", 1)` + `items.add("carrot_coin", 5)`.
   - 채널별 fail path (refill 불가 / gift 이미 받음) 는 early return 으로 자원 변동 없음.
3. **`src/components/Inventory/InventoryModal.tsx`**:
   - `onUse("carrot_coin")` 케이스: cost (50) 소비는 공용 `consume(code, cost)` 가 처리, 분기 안에서 `useFarmStore.getState().incCandyCarrots(1)` + toast.
4. **`src/features/collection/FarmHub.tsx`**:
   - hydrate useEffect 안에서 `rolloverHearts()` 호출 + `visibilitychange` 리스너로 매 탭 활성화 시 재확인.

## C. 데이터 정합

- 기존 사용자 `cc.items.v1` 에 hearts 가 5 이상이면? — `add()` 만 clamp 하므로 기존 값은 유지. 다음 친구 wave +1 에서 cap 적용.
- 신규 마운트 시 `heartDayKey === null` → 즉시 3 부여. 기존 사용자 (heart >= 3) 는 변화 없음.
- worker `user_items` — heart code 그대로 사용 (어떤 string 이든 accept).

## D. 광고 채널 동작 변화 (요약)

| 단계 | 이전 | 이후 (PR-24) |
| --- | --- | --- |
| claim 진입 | 직접 진행 | heart > 0 gate |
| 채널 work | 그대로 | 그대로 |
| 성공 마무리 | markClaimed + close | **+ heart -1 + carrot_coin +5** + markClaimed + close |
| 채널 fail | toast + early return | toast + early return (자원 변동 없음) |

## E. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

## F. Maintainer 후속 조치

없음. DB 마이그/시크릿 불필요. 모든 변경 client-only (worker 라우트는 코드 opaque 처리, 별도 schema 변경 없이 흘러감).

## G. 다음 작업

PR-27 (자원 부족 시 광고 안내 팝업).
