# IMPLEMENTATION_REPORT_PR-57.md — DetailPanel/ActionBar 분리

InventoryModal 의 "사용" 버튼을 DetailPanel 내부 컬럼에서 분리, sticky-bottom ActionBar 로 이동. DetailPanel 의 overflowY 스크롤과 무관하게 버튼은 항상 보임.

## 변경

### DetailPanel — info-only
- `onUse` prop 제거. 본문 영역만 책임.
- maxHeight overflow 스크롤 (PR-56) 안에서 description 이 길어도 버튼 가림 없음.

### ActionBar — sticky-bottom 신규
- `flexShrink: 0` + 상단 border + soft shadow 로 "stick" 느낌.
- `usable === false` 면 미렌더 (자원 chip, star/heart 등은 표시만, 사용 불가).
- 상태별 라벨:
  - canUse: `사용하기` 또는 `사용하기 (N개 소비)` (minToUse > 1)
  - count 0: `보유 부족`
  - minToUse 미달: `최소 N개 필요`
- pointerdown/up scale 0.97 micro-press feedback.

### 효과 발동 — 기존 그대로
- 기존 `onUse(code)` switch 로직 (hourglass / bolt / juice / soup / cake / carrot_coin / gem trade) 유지.
- haptic + toast 매번. PR-52 mission "tool_use" 트리거도 유지.

## 회귀 회피

- `selected && def.usable` 일 때 DetailPanel + ActionBar 동시 노출. usable 아닌 자원 chip 선택 시 ActionBar 미렌더 — UI 빈 자리 없음 (`flexShrink: 0` 만 잡혀 있는 빈 div 안 만듦).
- DetailPanel maxHeight 스크롤 + ActionBar sticky 의 조합으로 작은 viewport (iPhone SE 568px) 에서도 본문 + 버튼 둘 다 동시 보임.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 126/126 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |
