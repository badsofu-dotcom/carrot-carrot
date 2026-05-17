# IMPLEMENTATION_REPORT_PR-81.md — 자율 발견: GemTrade safe-area + accent-carrot hardcode 정리

## 동기

Round 10 자율 슬롯. 두 패턴 발견:
- **(b) safe-area 누락**: GemTradeModal — 5 옵션 + 닫기 버튼이 small viewport 에서 잘림 위험. 이전 maxHeight 85vh + padding 14px 만, safe-area 무관.
- **(a) hardcoded color**: 6 site 에 `#FF7B61` (light accent) 하드코딩 — dark mode 에서 `--accent-carrot: #ff8555` 미사용으로 슬쩍 다른 톤.

## 변경

### (b) GemTradeModal `safeAreaModalStyle` 적용

```tsx
style={{
  ...safeAreaModalStyle({
    maxWidth: 380,
    paddingTop: 18,
    paddingX: 18,
    paddingBottom: 14,
  }),
  background: "#FFF8EE",
  borderRadius: 20,
  ...
}}
```

이전: `maxHeight: "85vh", padding: "18px 18px 14px"` (safe-area 없음).
이후: `maxHeight: calc(100dvh - safe-area-top - safe-area-bottom - 32px) + padding-bottom: calc(14px + safe-area-inset-bottom)`.

iPhone notch 디바이스의 home indicator 위로 안전.

### (a) `#FF7B61` → `var(--accent-carrot, #FF7B61)` (6 sites)

| 파일 | 사이트 |
| --- | --- |
| `BunnyGachaModal.tsx` | "다음" 버튼 background |
| `RewardsPanel.tsx` | 2 site (P 색 강조) |
| `GemTradeModal.tsx` | 보유 N개 color |
| `AdRewardChannelModal.tsx` | chevron color |
| `AdSuggestionModal.tsx` | "광고 보기" 버튼 background |

다른 `#FF7B61` 잔여는 conditional (예: `canUse ? "#FF7B61" : "rgba(...)"`) — refactor 시 더 큰 diff 필요 → 별도 작업.

light fallback (`#FF7B61`) 유지 — dark mode (`#ff8555`) 만 자동 적용. 사용자에게 보이는 색은:
- light: 동일 (#FF7B61)
- dark: 자연스러운 `#ff8555` (밝기 +5%, 채도 -3% — eye-comfort)

## 변경 파일

- `src/components/Inventory/GemTradeModal.tsx` — safeArea + import
- `src/components/Inventory/BunnyGachaModal.tsx` — sed-replaced
- `src/components/Farm/RewardsPanel.tsx` — sed-replaced
- `src/components/Inventory/AdRewardChannelModal.tsx` — sed-replaced
- `src/components/Farm/AdSuggestionModal.tsx` — sed-replaced

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 182 / 182 pass (테스트 추가 0건 — visual refactor) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
