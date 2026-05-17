# IMPLEMENTATION_REPORT_PR-70.md — seed↔fertilizer naming 정합성

## 동기

Round 8 보고서 Round 9 후보 #6: "PR-58 seed 자산 → fertilizer / seed 일관성. PR-67 에서 fertilizer 로 되돌렸으나 사용자가 추후 seed pack 으로 다시 바꿀 수 있음. itemsStore 의 seed.displayName 도 '씨앗 묶음' 인지 확인 필요."

## 현 상태 audit

| 측면 | 값 | 일관성 |
| --- | --- | --- |
| Item code | `seed` | ✓ |
| 사용자 label (ko) | "씨앗" | ✓ (모든 surface) |
| Emoji | 🌱 | ✓ (모든 surface) |
| 시각 자산 (PNG) | `tool_fertilizer.png` | ✓ (3 site 동일) |
| User-facing "비료" 단어 | **0건** (코드 comment 만) | ✓ |
| 코드 comment "비료봉투" | 있음 (디자인 의도 설명) | ✓ |

→ **이미 일관됨**. 다만 PNG 경로가 3 site (itemsStore / FarmDropLayer / CollectionPage) 에 hardcode 되어 있어 향후 자산 변경 시 3 곳 동기 수정 필요. 

## PR-70 작업 — single SoT 상수 추출

`src/features/collection/itemsStore.ts` 에 `SEED_ICON_REL` 상수 export:

```ts
export const SEED_ICON_REL = "assets/farm/items/tool_fertilizer.png";
```

3 site 모두 이 상수를 import 해서 사용:

| Site | Before | After |
| --- | --- | --- |
| `itemsStore.ts` (seed item def) | `iconRel: "assets/farm/items/tool_fertilizer.png"` | `iconRel: SEED_ICON_REL` |
| `FarmDropLayer.tsx` (seed drop) | hardcode 동일 path | `iconRel: SEED_ICON_REL` |
| `CollectionPage.tsx` (CurrencyChip) | hardcode 동일 path | `icon={\`${BASE}${SEED_ICON_REL}\`}` |

## 시각 vs label 디자인 분리 명시

itemsStore seed entry 의 comment 갱신 — 자산이 비료봉투 PNG 이지만 사용자 UI 는 일관되게 "씨앗" / 🌱 (의도된 디자인 분리, "씨앗이 든 봉투" 메타포). 

## "씨앗 묶음" displayName 확인

Round 8 후보 가 "displayName 도 씨앗 묶음 인지" 라고 제기했으나, 현재 `ko: "씨앗"` 이고 모든 surface 에서 "씨앗" 으로 표시. "씨앗 묶음" 으로 바꿀 이유 없음 — 짧고 명확한 라벨 유지가 더 나음. → 변경 없음으로 결론.

## 변경 파일

- `src/features/collection/itemsStore.ts` — `SEED_ICON_REL` 상수 신규 + seed entry comment 갱신
- `src/components/Farm/FarmDropLayer.tsx` — import + 사용
- `src/pages/CollectionPage.tsx` — import + 사용

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130 / 130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
