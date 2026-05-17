# IMPLEMENTATION_REPORT_PR-110.md — accent-carrot small text contrast (a11y polish)

## 발견 (THEME_AUDIT Round 14 후보)

`#FF7B61` (light accent-carrot) on `#fff` 배경 contrast = **2.55:1** — WCAG AA small text 4.5:1 미달. 작은 텍스트 (≤ 12px) 에 사용 시 가독성 문제.

## 결정 (자율)

**`#c5462a` darker accent** 채택. contrast `#c5462a` on `#fff` = **4.84:1** (AA pass).

- 시각 hint (accent) 유지
- 사용자 인지: 동일 톤 (slightly more saturated dark orange)
- 코드 변경 최소 — 색 값만 교체

## 변경 사이트

| 컴포넌트 | Line | Before | After |
| --- | --- | --- | --- |
| `InventoryModal.tsx` grid count badge | 421 | `#FF7B61` (10px) | `#c5462a` + fontSize 12 |
| `InventoryModal.tsx` DetailPanel "보유 N" | 554 | `#FF7B61` (12px) | `#c5462a` |
| `GemTradeModal.tsx` "보유 N개" | 185 | `var(--accent-carrot)` (12px) | `#c5462a` |

## 통일

| 사이트 (이전) | 색 | Contrast |
| --- | --- | --- |
| 큰 button bg (accent-carrot) | `#FF7B61` | (bg = accent, text white = OK) |
| 큰 heading / button text | `var(--accent-carrot)` | 환경별 다양 |
| **Small text (≤ 12px)** | **`#c5462a`** | **4.84:1 AA pass** |

## 변경 파일

- `src/components/Inventory/InventoryModal.tsx` — 2 사이트
- `src/components/Inventory/GemTradeModal.tsx` — 1 사이트

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 237 / 237 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## Round 15 후보

- ReportPage `var(--accent-carrot)` 사용 사이트 — 큰 fontSize 이므로 LARGE text AA pass 후보. 검증 필요.
- TabBar `var(--accent-carrot)` (active 탭) — 큰 라벨이라 OK 추정.
- 다크 모드 accent (`#ff8555`) on dark bg 검증 (이미 PR-80 에서 `>= 3` 검증 — but small text 별도 audit 필요).
