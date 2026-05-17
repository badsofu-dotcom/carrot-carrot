# IMPLEMENTATION_REPORT_PR-73.md — 영어 토큰 → 한국어 매핑

## 동기

가방 → 자원 → 씨앗 detail 의 `획득 방법` 줄이 영어 내부 토큰을 그대로 노출:
```
획득 방법: daily-gift / focus-tier / cake / weekly-treasure / gem 5→9
```

학습 도구 톤과 어긋남.

## 변경

### Before / After (seed item detail)

| Before | After |
| --- | --- |
| daily-gift / focus-tier / cake / weekly-treasure / gem 5→9 | 일일 선물 / 집중 보상 (25/50분) / 케이크 사용 / 주간 보물상자 / 보석 5개 → 씨앗 9개 교환 |

### 신규 — `src/lib/i18n/sourceLabels.ts`

```ts
export const KOREAN_TOKEN_LABELS: Readonly<Record<string, string>> = {
  "daily-gift": "일일 선물",
  "focus-tier": "집중 보상 (25/50분)",
  "weekly-treasure": "주간 보물상자",
  "ad-watch": "광고 시청 보상",
  "farm-drop": "농장 드랍",
  "harvest-bonus": "수확 보너스",
  cake: "케이크 사용",
  juice: "주스 사용",
  soup: "수프 사용",
  hourglass: "모래시계 사용",
  bolt: "번개 사용",
  "gem 5→9": "보석 5개 → 씨앗 9개 교환",
  "gem-trade": "보석 사용 (교환 모달)",
  "friend-wave": "친구 wave",
  "friend-invite": "친구 초대",
};

export function translateAcquisition(input: string): string;
export function toLabel(token: string): string;
```

`translateAcquisition()` 은 `/` 로 split → 각 토큰 매핑 → 재조합. 매핑 없으면 원본 통과 (이미 한국어 텍스트 안전).

### Apply 사이트

`src/components/Inventory/InventoryModal.tsx` DetailPanel:
```tsx
획득 방법: {translateAcquisition(def.acquisition)}
```

다른 12개 자원/도구 item 의 acquisition 은 이미 한국어 ("수확", "광고 보상", "농장 드랍" 등) — 그대로 통과. 영향 받은 것은 seed 만.

### 추가 cleanup — `gem.effect`

내부 PR 참조 (`(또는 다른 옵션, PR-33)`) → 사용자 친화 표현 (`(또는 다른 옵션 — 사용 시 모달에서 선택)`).

## 테스트 — `src/lib/sourceLabels.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| 알려진 토큰 매핑 | daily-gift / focus-tier / weekly-treasure / cake / gem 5→9 → 한국어 |
| 모르는 토큰 fallback | "수확" / "농장 드랍" 등 그대로 |
| seed item 전체 변환 | 5-token 합성 문자열 |
| 이미 한국어 unchanged | 원본 보존 |
| 단일 토큰 | 1-token 변환 |
| 빈 문자열 | "" → "" 안전 |
| 핵심 토큰 정의 검증 | dict 누락 없음 |

7 신규 tests. 총 137 / 137 pass.

## 변경 파일

- `src/lib/i18n/sourceLabels.ts` (신규)
- `src/lib/sourceLabels.test.mjs` (신규)
- `src/components/Inventory/InventoryModal.tsx` (import + 1 line)
- `src/features/collection/itemsStore.ts` (gem.effect 표현 다듬기)

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **137 / 137 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
