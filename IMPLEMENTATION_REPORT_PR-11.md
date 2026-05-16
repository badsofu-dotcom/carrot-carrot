# IMPLEMENTATION_REPORT_PR-11.md — ToolDock 아이콘 크기 정규화

도구 트레이 4 슬롯의 아이콘 시각 크기를 통일. 슬롯 박스(64×64) 는 그대로 유지, 안의 PNG 만 조정.

## A. 문제

이전 상태:

| 슬롯 | 슬롯 박스 | 이미지 width/height | 시각 콘텐츠 (~PNG bbox) |
| --- | --- | --- | --- |
| 모종삽 | 64 | 58 | 작음 (PNG ~20% 투명 마진) |
| 물뿌리개 | 64 | 58 | 작음 (동일) |
| 바구니 | 64 | 46 | 정상 (tight bbox) |
| 당근주머니 (PR-6) | 64 | 50 | 정상 (tight bbox) |

모종삽/물뿌리개는 픽셀 width 가 더 큼에도 PNG 자체에 투명 패딩이 많아 시각적으로 더 작게 읽힘. 바구니/주머니는 PNG bbox 가 tight 해서 도드라짐.

## B. 해법

**Uniform bounding box + per-icon transform scale** 패턴.

```ts
const ICON_SIZE = 50;        // 4 슬롯 모두 동일
const SCALE_PADDED = 1.25;   // 모종삽/물뿌리개 - PNG 패딩 보정
const SCALE_TIGHT = 1.0;     // 바구니/주머니 - tight PNG bbox
```

- 모든 `<img>` 에 `width/height = ICON_SIZE` (50 px) 동일 적용
- `transform: scale(scale)` 로 per-PNG 보정
- 실효 visible 컨텐츠: 50 × 1.25 = ~62 (모종삽/물뿌리개), 50 × 1.0 = 50 (바구니/주머니) → PNG 의 ~80% 패딩 비율을 보정 후 시각 크기 비슷
- 슬롯 박스 `overflow: visible` (이전부터) 가 transform 후 약간의 overflow 를 허용

## C. 변경 파일

1. **`src/components/Farm/ToolDock.tsx`**:
   - `ToolDef.size: number` → `ToolDef.scale: number` (의미 명확화)
   - 신규 상수: `ICON_SIZE = 50`, `SCALE_PADDED = 1.25`, `SCALE_TIGHT = 1.0`
   - `TOOL_DEFS` 의 모종삽/물뿌리개 → `scale: SCALE_PADDED`, 바구니 → `scale: SCALE_TIGHT`
   - tool 슬롯 img 렌더링: `width/height/minWidth/minHeight = ICON_SIZE`, `transform: scale(t.scale)` 추가
   - bag 슬롯 img 렌더링 (별도 블록): 같은 패턴, `scale: SCALE_TIGHT`
   - doc-comment 갱신: "3 slots + bag slot, uniform bounding box + per-icon scale"

슬롯 박스 (64 px), 슬롯 간 gap, padding, badge 위치, refill 버튼 — **변경 없음**. 사용자 요청대로 "트레이 컨테이너 / 슬롯 박스 크기는 절대 건드리지 마" 준수.

## D. 트레이 폭 검증 (코드 리뷰)

| 측면 | 값 |
| --- | --- |
| 슬롯 4 × 64 | 256 |
| gap 3 × 6 | 18 |
| 컨테이너 padding 2 × 6 | 12 |
| **합계** | **286 px** |

모바일 390 → 안전 (이전 PR-6 검증 그대로). PR-11 은 이미지 transform 만 변경 → 레이아웃 회귀 없음.

## E. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **90/90 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

build:ait 는 PR-6 검증 path 동일, asset 변경 없음 → 생략.

## F. Maintainer 후속 조치

없음. CSS-only 변경.

## G. 다음 작업

PR-12 InventoryModal 자원 탭의 "당근 주머니" 항목 중복 제거 (가방의 자체-참조 self-recursive UX 버그).
