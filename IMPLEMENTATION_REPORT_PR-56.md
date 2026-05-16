# IMPLEMENTATION_REPORT_PR-56.md — InventoryModal grid + DetailPanel fix

자원 / 도구 탭의 5번째 item 이 비정상적으로 멀리 떨어지고 DetailPanel 본문 잘리는 회귀 fix.

## 진단

| 증상 | 원인 추정 |
| --- | --- |
| 5번째 cell 한참 아래 | grid 컨테이너 `flex: 1` + 기본 `align-content` 가 cells 가 적을 때 rows 를 vertically distribute 했을 가능성. 명시적 start alignment + auto-rows min-content 필요 |
| DetailPanel 본문 잘림 | 모달 `height: 70vh` 고정 + `overflow: hidden`. 작은 viewport (iPhone SE 568px) 에서 header + tabs + grid + DetailPanel 합이 70vh 초과 → DetailPanel 본문 하단 클립 |

## 수정

### `src/components/Inventory/InventoryModal.tsx`

1. **modal motion.div**: `height: "70vh"` → `maxHeight: "90vh"`.
   - 컨텐츠 크기에 따라 자라며 작은 viewport 에서도 DetailPanel 본문 잘림 없음.
   - RewardsPanel (PR-22) 동일 패턴.
2. **grid div**:
   - `gridAutoRows: "min-content"` — 각 행이 cell 내재 사이즈만 차지.
   - `alignContent: "start"` — grid 컨테이너 가 비어도 row 들 상단 고정.
   - `gap: 10` → `rowGap: 10` + `columnGap: 10` (명시화).
3. **DetailPanel div**:
   - `maxHeight: "min(280px, 45vh)"` + `overflowY: "auto"` + `WebkitOverflowScrolling: touch`.
   - 긴 description 본문이 viewport 작아도 panel 내부 스크롤로 안전 노출.
   - padding-bottom 12 → 16 확보.

## 회귀 회피

- `display: flex; flexDirection: column` 모달 컬럼 구조 유지.
- 헤더 / 탭 / 그리드 (flex:1) / DetailPanel (flexShrink:0) flex 분배 유지.
- footer summary (선택 안 됐을 때) 그대로.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 126/126 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

## 다음 작업

PR-57 (DetailPanel sticky bottom 사용 버튼 복원 — 현재는 inner column 안에 있으므로 maxHeight scroll 시 안 보일 수 있음).
