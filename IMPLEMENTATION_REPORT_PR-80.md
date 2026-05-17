# IMPLEMENTATION_REPORT_PR-80.md — 다크 모드 contrast WCAG AA

## 동기

다크 모드에서 일부 텍스트 (caption / 부제 / disabled label) 가 너무 옅어 가독성 부족. 사용자 발견 사례: "광고 보기" 텍스트, 미션 카드 일부 caption. 원인 분석:

| Token | 색 | bg-elevated 대비 | WCAG AA (4.5) |
| --- | --- | --- | --- |
| `--text-primary` | #fff8e7 | 15.4:1 | ✓ |
| `--text-secondary` | #c9bba6 | 8.6:1 | ✓ |
| **`--text-tertiary`** | **#807260** | **3.40:1** | ✗ 미달 |

또한 user-facing 컴포넌트에 `color: "#888"` 하드코딩 8 site → dark mode 변환 안 됨.

## 변경

### `src/design-system/tokens.css`

`[data-theme="dark"]` + `@media (prefers-color-scheme: dark)` 두 곳 모두:
```css
--text-tertiary: #b3a691;   /* 이전 ~ contrast 6.0:1 */
```

### 하드코딩 grey 8 site → semantic token

| 파일 | 사이트 |
| --- | --- |
| `src/components/Inventory/GemTradeModal.tsx` | sub 텍스트 |
| `src/components/Farm/RewardsPanel.tsx` | 3 site (caption) |
| `src/components/Inventory/AdRewardChannelModal.tsx` | 2 site (sub + 나중에 버튼) |
| `src/components/Inventory/InventoryModal.tsx` | 2 site (탭 inactive, count 0) |

모두 `color: "#888"` → `color: "var(--text-tertiary, #888)"`. light mode 에서 fallback (#888) 유지 — 변화 없음. dark mode 에서는 token (#b3a691) 사용 → 자동 AA 통과.

## 테스트 — `src/lib/darkModeContrast.test.mjs`

순수 JS WCAG 공식으로 contrast 계산 (jest-axe 같은 별도 의존성 없이):

```js
function relativeLuminance([r,g,b]) {
  const toLin = c => { const s = c/255; return s<=0.03928 ? s/12.92 : ((s+0.055)/1.055)**2.4; };
  return 0.2126*toLin(r) + 0.7152*toLin(g) + 0.0722*toLin(b);
}
function contrastRatio(fg, bg) {
  const L1 = relativeLuminance(fg), L2 = relativeLuminance(bg);
  return (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05);
}
```

tokens.css 의 `[data-theme="dark"]` 블록을 정규식 추출 → contrast 검증.

| 검증 | 임계 | 결과 |
| --- | --- | --- |
| text-tertiary on bg-elevated | >= 4.5 (AA normal) | ✓ |
| text-secondary on bg-elevated | >= 4.5 (AA normal) | ✓ |
| text-primary on bg-elevated | >= 7 (AAA) | ✓ |
| accent-carrot on bg-elevated | >= 3 (AA large text) | ✓ |
| 회귀 차단 (이전 값 잔여 없음) | grep | ✓ |

5 신규 tests. 총 **182 / 182 pass**.

## 변경 파일

- `src/design-system/tokens.css` — 2 블록 (`[data-theme="dark"]` + auto-dark @media)
- `src/components/Inventory/GemTradeModal.tsx`
- `src/components/Farm/RewardsPanel.tsx`
- `src/components/Inventory/AdRewardChannelModal.tsx`
- `src/components/Inventory/InventoryModal.tsx`
- `src/lib/darkModeContrast.test.mjs` (신규)

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 182 / 182 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
