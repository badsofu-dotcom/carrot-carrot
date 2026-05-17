# IMPLEMENTATION_REPORT_PR-79.md — AdRewardChannelModal 하단 잘림 fix + safeAreaModal 유틸

## 동기

`"하나만 골라요 · 채널별 하루 1회"` 시트 (AdRewardChannelModal) 가 작은 viewport (iPhone SE 375×667) 에서 하단 "나중에" 버튼 위 보상 카드 텍스트 잘림/흐림. 패턴은 PR-68 (InventoryModal) 와 동일 — safe-area + maxHeight 누락.

## 신규 — `src/lib/ui/safeAreaModal.ts`

PR-68 / PR-79 둘 다 동일 패턴 → 공통 유틸 분리.

```ts
export function safeAreaModalStyle(opts: {
  maxWidth?: number;     // default 360
  paddingX?: number;     // default 22
  paddingTop?: number;   // default 20
  paddingBottom?: number;// default 16 (safe-area 추가됨)
  gutter?: number;       // default 32 (viewport 여백)
}): CSSProperties;

export const safeAreaBackdropStyle: CSSProperties;
```

`safeAreaModalStyle()` 의 보장:
- `maxHeight: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px)` — small viewport 안전
- `padding-bottom: calc(16px + env(safe-area-inset-bottom))` — home indicator 위로 잘림 방지
- `overflowY: auto` — 컨텐츠 많을 때 내부 스크롤
- `boxSizing: border-box`

`safeAreaBackdropStyle`:
- `position: fixed; inset: 0`
- `display: flex; align-items: center; justify-content: center`
- 가로 safe-area padding

## Apply 사이트

### `src/components/Inventory/AdRewardChannelModal.tsx`

Before:
```tsx
style={{
  position: "fixed",
  inset: 0,
  zIndex: 1080,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px calc(16px + env(safe-area-inset-right)) 16px calc(16px + env(safe-area-inset-left))",
  boxSizing: "border-box",
}}
// inner
style={{
  width: "100%", maxWidth: 360,
  background: "#FFF8EE",
  borderRadius: 20,
  padding: "20px 22px",
  boxShadow: "...",
  boxSizing: "border-box",
}}
```

After:
```tsx
style={{ ...safeAreaBackdropStyle, zIndex: 1080 }}
// inner
style={{
  ...safeAreaModalStyle({ maxWidth: 360 }),
  background: "#FFF8EE",
  borderRadius: 20,
  boxShadow: "...",
}}
```

이로써:
- maxHeight 동적 계산 → "나중에" 버튼 + 3개 카드 항상 visible
- safe-area-inset-bottom 자동 적용 → 노치 디바이스 home indicator 안전
- 컨텐츠가 viewport 보다 크면 내부 스크롤 (광고 채널 카드 늘어나도 안전)

## 테스트 — `src/lib/safeAreaModal.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| default maxWidth 360 | OK |
| maxWidth override | 420 등 적용 |
| padding bottom safe-area 포함 | regex `env(safe-area-inset-bottom)` |
| maxHeight dvh + safe-area | `100dvh`, `safe-area-inset-top/bottom` |
| overflowY auto | OK |
| boxSizing border-box | OK |
| backdrop fixed inset 0 flex center | 5 props |
| backdrop 가로 safe-area padding | left + right inset |
| default gutter 32 | maxHeight 식 |
| gutter override 64 | 가변 |

10 신규 tests. 총 **177 / 177 pass**.

## 다른 모달 (BunnyGachaModal, GemTradeModal) 적용?

본 PR 은 AdRewardChannelModal 만 변환. 다른 모달은 user 가 issue 못 보고했으므로 (현재까진) 별도 PR 로. Round 10 의 자율 슬롯 (PR-81) 에서 검토.

## 변경 파일

- `src/lib/ui/safeAreaModal.ts` (신규)
- `src/lib/safeAreaModal.test.mjs` (신규)
- `src/components/Inventory/AdRewardChannelModal.tsx` (style 단순화)

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 177 / 177 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
