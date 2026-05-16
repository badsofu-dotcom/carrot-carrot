# IMPLEMENTATION_REPORT_PR-58.md — 씨앗 아이콘 자산 교체

기존 `crop_stage1_seed.webp` (갈색 흙덩이) 가 사용자 인지 약함 → 씨앗 봉투 비주얼로 교체.

## 결정 — `tool_seed_pack.png` 사용

사용자 spec 의 `tool_fertilizer.png` 는 **자산 부재**:
```
public/assets/farm/tools/  → tool_basket / tool_seed_pack / tool_shovel /
                              tool_watering_can 4종만 (fertilizer 부재)
```

`tool_seed_pack.png` 가 의미상 가장 가까움 — "씨앗 봉투" 시각 자체로 직관적. 자율 권한으로 결정.

## 변경 사이트 (3)

1. **`src/features/collection/itemsStore.ts`** — `seed.iconRel` 갱신.
2. **`src/components/Farm/FarmDropLayer.tsx`** — `seed` drop 의 `iconRel` 갱신.
3. **`src/pages/CollectionPage.tsx`** — 헤더 자원 chip 의 icon URL 갱신.

`FarmHub.tsx:58` 의 `CROP_ASSETS.seed` 는 농장 plot stage1 (어린 모종) 비주얼 — 인벤토리/헤더 의 "보유 씨앗" 의미와 별개. **그대로 유지** (모종 → 작물 성장 라이프사이클 시각화).

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 126/126 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| 금지토큰 7종 | 각 0 |
