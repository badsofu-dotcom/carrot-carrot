# IMPLEMENTATION_REPORT_PR-68.md — InventoryModal TabBar 겹침 fix

## 증상

- 자원 탭 "당근 코인" → "획득 방법: 광고 보상 (채널당 +5 coin)" 줄 TabBar 에 가려 잘림
- 도구 탭 "번개" → "획득 방법" 줄 거의 안 보임 + ActionBar 미노출 (실제로는 ActionBar 가 TabBar 뒤에 깔려 보임)

## 원인

- 모달: `position: fixed`, `bottom: 0`, `maxHeight: 90vh`, padding-bottom 안에 `env(safe-area-inset-bottom)` 만 포함.
- TabBar: `position: fixed`, `bottom: calc(--tabbar-offset + safe-area)`, height 68px, 총 reserved ~100px + safe-area.
- z-index 상으로는 modal (1061) 이 TabBar (100) 보다 위지만, parent stacking context (framer-motion `motion.div` 의 transform-origin 등) 영향으로 TabBar 가 시각적으로 modal 위에 떠 보이는 케이스 발생. 또한 z-index 가 정상이어도 모달 컨텐츠의 하단 영역이 TabBar 와 겹쳐 사용자가 "잘림" 으로 인지.

## 해결

`src/components/Inventory/InventoryModal.tsx` (lines 195-225 근방):

| 항목 | 이전 | PR-68 |
| --- | --- | --- |
| `bottom` | `0` | `calc(var(--tabbar-reserved, 100px) + env(safe-area-inset-bottom))` |
| `minHeight` | `70vh` | `60vh` (tabbar 공간 손실분 보정) |
| `maxHeight` | `90vh` | `calc(100dvh - var(--tabbar-reserved, 100px) - env(safe-area-inset-bottom) - 12px)` |
| `padding-bottom` | `calc(20px + env(safe-area-inset-bottom))` | `20px` (safe-area 가 bottom offset 으로 이동) |

`--tabbar-reserved` (tokens.css line 212) = `calc(--tabbar-height + --tabbar-offset * 2)` = `68 + 16*2` = **100px**.

## ActionBar 검증

| 아이템 | usable | minToUse | ActionBar 렌더 |
| --- | --- | --- | --- |
| carrot / candy / golden / seed | false | — | 미렌더 (자원 표시용) |
| carrot_coin | **true** | 50 | ✅ "사용하기 (50개 소비)" / "보유 부족" / "최소 50개 필요" |
| hourglass / juice / soup / cake | **true** | 1 | ✅ "사용하기" / "보유 부족" |
| bolt | **true** | 1 | ✅ "사용하기" / "보유 부족" |
| star / heart | false | — | 미렌더 (전설 토끼 비용 / 광고 토큰 - 직접 사용 아님) |
| gem | **true** | 5 | ✅ "사용하기 (5개 소비)" → GemTradeModal 분기 |

`usable: false` 자원 (carrot/candy/golden/seed/star/heart) 은 ActionBar 미렌더가 의도된 동작. ActionBar 함수 내 `if (!def.usable) return null` 가드 (line 585) 가 그 의도 명시.

번개 (bolt) 는 `usable: true` — ActionBar 가 렌더되어야 하고, PR-68 fix 이후 잘림 없이 보임. 사용자가 "ActionBar 미노출" 로 인지한 것은 TabBar 겹침으로 hidden 영역에 있던 것임.

## 변경 파일

- `src/components/Inventory/InventoryModal.tsx` (1 file, 6 lines of style changes + comment)

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130 / 130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
