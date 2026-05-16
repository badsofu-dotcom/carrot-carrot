# IMPLEMENTATION_REPORT_PR-31.md — 자원/아이템 분류 재정의

자원 시맨틱을 5 카테고리로 명시화하고, InventoryModal 탭을 3개 (자원/도구/토큰) 로 재구성.

## A. 분류 매트릭스

| code | tab | category | 비고 |
| --- | --- | --- | --- |
| carrot | resources | currency | 1 P, harvest |
| candy | resources | currency | 5 P, gacha 7 % (PR-32 캘리브레이션) |
| golden | resources | currency | 10 P, gacha 0.6 % |
| **seed** | **resources** | **soft_currency** | **(NEW)** farm 자원, sink PR-32 검토 |
| carrot_coin | resources | soft_currency | 광고 5/claim, sink 50→캔디 1 |
| hourglass | tools | consumable | 1 plot stage +1 |
| bolt | tools | consumable | 물뿌리개 +3 |
| juice | tools | consumable | 다음 수확 candy +5%p |
| soup | tools | consumable | 다음 refill +1 |
| cake | tools | consumable | 다음 focus seed +1 |
| star | **tokens** | token | 100 → legendary |
| gem | tokens | token | 5 → 9 seeds (PR-33 다중옵션 wiring) |
| heart | tokens | token | 광고 시청 토큰, maxStack 5 |

honor (메달 11종) 와 dex (토끼 25종) 는 itemsStore 가 아닌 별도 store + 페이지 surface (AchievementsCard + dogam grid) — PR-26 에 정리됨.

## B. 변경 파일

1. **`src/features/collection/itemsStore.ts`**:
   - `ItemCategory` 신규 type — "currency" / "soft_currency" / "consumable" / "token".
   - `ItemCode` 에 `"seed"` 추가, `"medal"` 제거 (vestigial item, achievement badge 와 혼동).
   - `ItemTab` "collection" → "tokens" (도감 surfaces 와 명칭 충돌 해소).
   - `ItemDef.category` 필드 추가 (필수).
   - 13 항목 모두 category 매핑 + seed 신규 entry. acquisition 카피에 "농장 드랍" (PR-34 예고) 반영.
2. **`src/components/Inventory/InventoryModal.tsx`**:
   - `TAB_LABELS` 의 "collection" → "tokens": "토큰".
   - `liveResourceCount` switch 에 `case "seed"`: useFarmStore.seeds 미러.
3. **`src/features/dev/DevActionsGroup.tsx`**:
   - `addItem("medal", 99)` 제거 — medal item code 폐기. 메달 unlock 은 이미 ALL_MEDALS × `unlockMedal` 으로 처리.

## C. 데이터 호환

- 기존 사용자 `cc.items.v1` 에 medal/star/gem/heart count 있으면? — loadCounts 의 `blank` 가 새 ITEMS 기준이라 medal 키는 무시. medal 데이터 손실 (의도, 어차피 미사용).
- seed key 신규 추가 — blank 에 0 으로 초기화. 실제 표시는 farmStore.seeds 미러이므로 itemsStore.counts.seed 는 dead state. add/consume("seed") 가 호출되면 dead-state 가 누적 — 향후 PR-34 (드랍) 에서 seed 그랜트는 `farmStore.growAllPlanted(0, null, n)` 사용 필수 (문서).

## D. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |

## E. 다음 작업

신규 사용자 추가 요구사항 반영:
- **PR-41 (우선)**: 보따리 UX 개선 — 아이템 탭 시 주황 외곽선 + 하단 설명 패널 + `src/lib/itemMeta.ts` 신설.
- **PR-32**: 100 P/일 캡 + 광고 5회 50P 보장 (1/5/5/10/10/20) + 6~10회 토큰만 + ECONOMY_DESIGN.md 광고 수익 섹션.
- 이후 PR-33 (보석 가성비), PR-34 (드랍), PR-35 (히든 토끼), PR-36 (광고 안내 reload), PR-37 (5번째 슬롯 reload), PR-38 (도감 패시브), PR-39 (문서), PR-40 (정합).
