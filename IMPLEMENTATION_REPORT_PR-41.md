# IMPLEMENTATION_REPORT_PR-41.md — 보따리 UX 개선 (선택 + 하단 패널)

InventoryModal 의 아이템 grid 가 셀별 작은 "사용" 버튼을 갖고 있어 정보 압축이 부족. 사용자 spec 옵션 B 채택 — 셀 탭 → 주황 외곽선 강조 + 하단 sticky 패널에 풀 설명 + 사용하기 버튼 통합.

## A. 신규 파일

`src/lib/itemMeta.ts`:
- `ITEM_META: Record<ItemCode, { longDescription, emoji }>`
- 13 아이템 (PR-31 분류 기준) 각각 1~2 line longDescription + emoji fallback.
- Display-only 정보 — store/runtime semantics 와 분리.

## B. InventoryModal 리팩토링

### 신규 state
```ts
const [selected, setSelected] = useState<ItemCode | null>(null);
```

### 동작
1. **Tab switch**: `setSelected(null)` (useEffect on tab).
2. **Modal close**: `setSelected(null)` (useEffect on open=false).
3. **Cell tap**: 같은 셀 재탭 = unselect (toggle).
4. **선택 셀**: 2 px 주황 외곽선 + 살짝 큰 box-shadow.
5. **비선택 셀**: 1 px 옅은 회색 hairline.

### 셀 변경
- `<div>` → `<button type="button">` (a11y: aria-pressed, native focus ring).
- 셀 내부 "사용" 버튼 (per-cell) **제거**.
- title 속성 = 아이템명 (간단 호버 hint).

### 새 컴포넌트 `DetailPanel`
조건부 렌더 (`code != null`):
- 좌측: 42 × 42 PNG 아이콘
- 우측: 이름 + "보유 N" / longDescription / 획득 방법 / `사용하기` 버튼
- 사용하기 버튼 게이트: `def.usable && count >= (def.minToUse ?? 1)` — 충족 시 주황 활성, 부족 시 회색 disabled (라벨 "보유 부족").
- minToUse > 1: "사용하기 (5개 필요)" 형태로 cost 명시.

### Footer 통합
- 선택 상태에서는 기존 footer 요약 (총 N종 / 보유 종) 숨김 — DetailPanel 이 자리 차지.
- 비선택 상태에서는 기존 footer 유지.

### Layout
- Grid 컨테이너에 `flex: 1; minHeight: 0` 추가 → 모달 height 안에서 스크롤 영역 확보.
- DetailPanel `flexShrink: 0` 으로 하단 고정.

## C. 동작 흐름 (사용 흐름)

1. 사용자 가방 열기.
2. "도구 아이템" 탭 클릭.
3. 모래시계 셀 탭 → 주황 외곽선 + 하단 패널:
   - 모래시계, 보유 3
   - "심은 작물 한 단계 즉시 성장. 빠른 수확이 필요할 때 사용. 주간 보물상자 또는 농장 드랍."
   - 획득 방법: 주간 보물상자 / 농장 드랍
   - 사용하기 (주황 활성)
4. 사용하기 탭 → onUse("hourglass") → consume + growAllPlanted(1) → toast "⏳ 작물이 한 단계 자랐어요" → setSelected 는 onUse 가 직접 클리어하지 않음 (다음 셀 탭하거나 모달 닫을 때 클리어).

## D. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |

## E. 다음 작업

PR-32 (100P/일 캡 + 광고 5회 50P 보장 + ECONOMY_DESIGN.md 광고 수익 섹션).
