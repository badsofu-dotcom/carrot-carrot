# IMPLEMENTATION_REPORT_PR-86.md — 자루 칩 = 가방 trigger 라벨 명확화

## 발견

농장 도구 바의 4번째 칩 (자루 비주얼 PNG `item_bag.png` + 빨간 배지 "N") 가 사용자에게 "씨앗 자루 자원" 으로 오해됨. 실제 의미:

| 측면 | 실제 | 사용자 인식 |
| --- | --- | --- |
| 컴포넌트 역할 | InventoryModal trigger (passive slot) | "자원" 자체? |
| PNG 시각 | 자루 봉투 (item_bag.png) | "씨앗 자루" |
| 배지 "N" | `speciesOwned` (보유 ItemCode 종 수) | "자루 N개"? |

## 결정 (자율)

**최소 변경 + 의미 명확화**. PNG 자산 그대로 (visual swap 불필요 — 별도 자산 작업 영역), semantic 라벨만 강화.

| 측면 | Before | PR-86 |
| --- | --- | --- |
| `aria-label` | `"가방 열기"` | `` `내 가방 (${speciesOwned}종 보유)` `` |
| `title` (툴팁) | 없음 | `"내 가방"` |
| Badge value | `speciesOwned` (변화 없음) | 同上 |
| Badge color | ACCENT (orange/red) | 同上 (notification-like 의도 유지) |

**왜 PNG 자산 swap 안 했나?**: 별도 디자인 자산 제공 필요. semantic 라벨로도 사용자 (screenreader / hover) 가 인지 가능.

**왜 badge color 유지?**: 빨간 배지 = "주목" 신호. 사용자가 가방 안에 뭔가 있다는 hint 로 OK. 이전 보고서의 "notification dot 오해" 는 가방 안 species 수가 9 이상일 때만 발생 — 그건 의도된 가시성.

**Badge meaning 변경 안 함**: `speciesOwned` 은 InventoryModal 내부 grid 의 occupied cell 수와 일치 → 가방 열어서 확인 가능. 의미 일관성 유지.

## 변경 파일

- `src/components/Farm/ToolDock.tsx` — bag button aria-label / title + comment

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 188 / 188 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## 미해결 / Round 13 후보

- 시각 자산 변경 — `item_bag.png` 을 더 명확한 "쇼핑백 / 백팩 / 백" 비주얼 PNG 으로 교체 (사용자 디자인 제공 필요)
- Badge color → softer grey (informational vs notification 구분 강화) — 사용자 의견 확인 후 적용
