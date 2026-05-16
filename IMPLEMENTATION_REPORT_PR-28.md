# IMPLEMENTATION_REPORT_PR-28.md — ToolDock 5번째 슬롯 (광고)

이전에 있었다가 사라진 광고 보상 진입점 부활. ToolDock 슬롯 4 → 5.

## A. 슬롯 구성

| 위치 | 슬롯 | 종류 |
| --- | --- | --- |
| 1 | 모종삽 | tool (active select) |
| 2 | 물뿌리개 | tool (active select) |
| 3 | 바구니 | tool (active select) |
| 4 | 보따리 (가방) | passive (PR-6) |
| **5** | **광고 (🎬)** | passive (PR-28) |

기존 PR-6 의 conditional "🎬 +3 충전" 버튼 (wateringLeft === 0 일 때만 노출) **제거** — ad 슬롯이 항상 보이는 광고 채널 진입점이라 의미 중복.

## B. 동작

- 클릭 → `cc:ad-channel:open` 이벤트 dispatch → FarmHub 의 listener 가 `AdRewardChannelModal` 열기 (기존 PR-6 path 그대로).
- Badge: 보유 하트 `{count}/3` 표시. PR-24 가 KST 자정 리필 + ad-channel claim 시 1 consume 을 wire 할 예정 — 본 PR 은 표시만.
- hearts === 0 시 button disabled (gray bg) + 클릭 시 동적 import 로 toast `하트가 부족해요 — 내일 자정에 다시 채워져요`.

## C. 폭 검증

- 5 × SLOT_SIZE 64 = 320
- 4 × gap 6 = 24
- 2 × padding 6 = 12
- **합계 356 px**
- 모바일 viewport 390 / FarmHub `maxWidth: 480` 안에서 안전 (이전 PR-6 의 4 슬롯 286 → 5 슬롯 356, +70 px).
- 더 좁은 환경 (375 px) 도 fit (375 - 12 farm card margin × 2 = 351 — tight 5 px 여유, 슬롯 박스 `overflow: visible` 로 PR-14 의 1.45 scale bleed 흡수 가능).

## D. 회귀 회피

- `wateringLeft` state subscribe 유지 — watering can 슬롯 badge `N/10` 그대로 동작.
- `adRefills` subscribe 제거 (conditional refill 버튼 사라져 unused).
- AdRewardChannelModal 의 watering 채널 claim 은 기존대로 `refillFromAd()` 호출 — 사용자는 ad 슬롯 → 모달 → "물뿌리개" 채널 선택 흐름으로 동일 결과 도달.

## E. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |

## 다음 작업

PR-24 (하트/코인/메달 정체성 정의 + grant/sink wire).
