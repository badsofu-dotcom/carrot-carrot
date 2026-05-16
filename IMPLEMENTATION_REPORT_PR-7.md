# IMPLEMENTATION_REPORT_PR-7.md — gem 구현

옵션 C 신규 콘텐츠 첫 번째. `gem` 아이템을 "미구현 — 차후 상점 화폐" 에서 실제 작동하는 collectible 로 전환.

## A. 디자인

| 측면 | 결정 |
| --- | --- |
| **Source** | 오늘의 선물상자 2 % 확률 (`rollGift()` 신규 band) |
| **Sink** | 5 gem → +1 seed (InventoryModal "사용 (5)" 버튼) |
| **Worker** | 별도 마이그레이션 없음. 기존 `/items/use` 가 `code: "gem"` 그대로 받음 (count-1 per call, 5× fan-out). |

### 밸런싱 결정 (autonomous-mode 보고)

- 이전 `rollGift` 의 8 % "seed +3" band 를 두 개로 분할:
  - 6 % seed +3 (-2 pt)
  - 2 % gem +1 (+2 pt new)
- 다른 4 개 밴드 (seed +1 60 %, candy +1 24 %, golden +1 8 %) **변동 없음**.
- 일일 EV: 2.0 P 유지 (gem 과 seed 모두 0 P). 출금 페이스에 영향 없음.
- 50k Monte-Carlo 로 실제 분포 검증 — gem 2 % ± 0.5 pt 통과.

## B. 변경 파일

### 신규
1. **`src/lib/giftRoll.ts`** — pure helper. `GiftReward` union + `rollGift(rng)` 5-band 추첨. zustand 비의존 → node --test 가능.
2. **`src/lib/giftRoll.test.mjs`** — 9 케이스: 밴드 경계 6 개, gem tail, 0.92 inclusive cut, 50k Monte-Carlo.

### 수정
3. **`src/features/collection/rewardsStore.ts`** — 내장 `rollGift` 제거, `../../lib/giftRoll` 에서 import + re-export. `GiftReward` 타입도 re-export (외부 컴포넌트 호환).
4. **`src/components/Farm/RewardsPanel.tsx`** — `onClaim` 에 `gem` 케이스 추가 (`useItemsStore.getState().add("gem", n)`). `giftToText` 에 `💎 보석 +N` 케이스.
5. **`src/features/collection/itemsStore.ts`** —
   - `ItemDef` 에 `minToUse?: number` 필드 추가 (default 1).
   - `gem`: `usable: true`, `minToUse: 5`, 카피 전체 교체 (effect/acquisition).
6. **`src/components/Inventory/InventoryModal.tsx`** —
   - `onUse` 에 `minToUse` 가져와 `consume(code, cost)` 호출. 신규 `gem` 케이스: 5 소비 → `growAllPlanted(0, null, 1)` (씨앗 +1 사이드 도어).
   - 사용 버튼 가시성: `count >= (it.minToUse ?? 1)` 로 변경 (이전 `owned` 만 체크).
   - 버튼 라벨: `minToUse > 1` 일 때 `사용 (N)` 으로 코스트 표기.
7. **`FARM_RULES.md`** — `## 보석 (gem) — PR-7` 섹션 추가 (source/sink/worker/test 요약).

## C. 영향 분석

- **기존 itemsStore consumers**: `juice/soup/cake/hourglass/bolt` 는 `minToUse` 미정의 → default 1. 동작 동일.
- **rewardTables.ts / 워커 `boxes.ts` DAILY 테이블**: 동기화 안 됨 (이전부터 그러함). 프론트 런타임은 `giftRoll.ts` 만 사용. 워커 라우트 `/boxes/gift/open` 은 현재 클라가 호출하지 않으므로 영향 없음. 워커 와이어-업 시점에 같이 정렬할 PR-N+ 후속 작업.
- **useItemsStore.consume(code, n)**: 기존 fan-out 루프 (n 회 worker POST) 그대로 사용. 5 gem 소비 = 5 개별 POST. 서버 측 `UPDATE ... WHERE count > 0` 가 race-safe.

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **87/87 pass** (이전 78 + giftRoll 9) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 (`localStorage` 등) | 각 0 |
| 절대경로 `"/assets/farm"` / `'/assets/farm` | 0 |

`build:ait` 는 PR-6 동일 path 로 통과 검증 완료. PR-7 은 client-only TS/JSX 변경, asset/worker types 변동 없음 → 추가 실행 생략.

## E. Maintainer 후속 조치

없음. DB 마이그레이션/wrangler 호출/외부 secret 일체 불필요.

## F. 다음 작업

PR-8 `juice` — `미구현` 토스트를 실제 효과로 교체. effect 카피: "다음 수확까지 캔디 확률 +5 %p". `seasonalBunny.rollHarvestGacha` 의 base rate 에 임시 buff 를 적용하는 가장 작은 경로로 구현. 자율 모드 이어감.
