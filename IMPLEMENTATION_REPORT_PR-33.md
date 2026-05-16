# IMPLEMENTATION_REPORT_PR-33.md — 보석 가성비 + 5 옵션 sink

기존 보석 5 → 씨앗 1 (가성비 짬) 을 5 옵션 trade 모달로 재구성.

## A. 5 옵션 매트릭스

| ID | 비용 | 효과 | 즉시 EV (P) |
| --- | --- | --- | --- |
| seeds9 | 5 gem | 씨앗 +9 | 0 (씨앗 sink 없음 — soft currency) |
| grow | 5 gem | 전체 심은 plot +1 stage | 무시 (수확 단축, 누적 효과) |
| session | 10 gem | 당근 +25 | 25 P (25분 세션 1회분) |
| golden | 20 gem | 황금당근 +1 | 10 P |
| legend | 50 gem | 레전더리 토끼 1회 (보유 시 환불) | 도감 unlock — P 변환 없음 |

## B. 신규 파일

`src/components/Inventory/GemTradeModal.tsx`:
- `cc:gem-trade:open` 이벤트 listener.
- 5 옵션 row: 이모지 / 제목 / 본문 / 비용 chip. 보유 < cost = disabled (회색).
- 효과 dispatch:
  - seeds9 → `growAllPlanted(0, null, 9)`
  - grow → `growAllPlanted(1, Date.now(), 0)` (hourglass 와 동등)
  - session → `incCarrots(25)`
  - golden → `incGoldenCarrots(1)`
  - legend → `forceUnlock("legendary-demon")` → 성공 시 `cc:bunny-gacha:show` dispatch, 실패 시 보석 환불 (`add("gem", 50)`)
- PR-42 안전 모달 패턴: outer fixed inset:0 + display:flex 중앙 정렬, inner motion 카드 transform 자유.

## C. 통합 wire

- **`src/components/Inventory/InventoryModal.tsx`**: `onUse("gem")` 케이스가 consume + 직접 효과 대신 `cc:gem-trade:open` 이벤트만 dispatch. 본 함수 위쪽에서 early-return 가드.
- **`src/features/collection/FarmHub.tsx`**:
  - `<GemTradeModal />` mount.
  - `cc:bunny-gacha:show` listener → `setGachaBunnyId(detail.bunnyId)` 로 BunnyGachaModal 활성화.

## D. 가성비 재계산

이전 5 gem → 1 seed:
- 1 seed = 0 P → 0 P per gem
- 가챠 가치 0 → 짬

신규 5 gem (최소 옵션 seeds9):
- 9 seeds = soft currency (sink 향후), gem 의 effective value 가 옵션마다 다양화

신규 10 gem (session 옵션):
- 25 P → 2.5 P per gem
- daily-gift 2% 드랍 1 gem 마다 평균 2.5 P 기대값 (게이트는 25 분 세션 등가 = 사용자 의지)

신규 20 gem (golden 옵션):
- 10 P → 0.5 P per gem (소수만 모은 sub-optimal)

신규 50 gem (legendary):
- 도감 unlock 가치 (P 변환 없음, 메타 진행) — 본 PR 에서 평가 안 함

전략적 다양화: 사용자가 활용 시나리오 (즉시 P / 누적 / 도감) 에 따라 옵션 선택. 가성비 ≤ 2.5 P/gem 으로 상한 → 보석 anti-abuse 자연 차단.

## E. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## F. 다음 작업

PR-32 — 100 P/일 캡 + 광고 5회 50P 보장 + ECONOMY_DESIGN.md 광고 수익 섹션.
