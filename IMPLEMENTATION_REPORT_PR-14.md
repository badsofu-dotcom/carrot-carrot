# IMPLEMENTATION_REPORT_PR-14.md — ToolDock 패딩 보정 재조정

PR-11 의 `SCALE_PADDED = 1.25` 가 시각적으로 부족 — 모종삽/물뿌리개가 여전히 바구니/주머니보다 작게 읽힘. 1.45 로 상향.

## A. 결정

| 옵션 | 평가 |
| --- | --- |
| ICON_SIZE 50 유지 + SCALE_PADDED 1.45 | ✅ 채택 — 코드 표면 변화 최소, 슬롯 박스 불변 |
| ICON_SIZE 56 로 키우고 SCALE 들 재조정 | ❌ — 박스 변경 없이도 같은 시각 효과 가능 |

## B. 시각 / 기하 검증

- visible content (transform 후): `50 × 1.45 = 72.5 px`
- slot box: 64 px (불변)
- 슬롯 외부로의 bleed: `(72.5 - 64) / 2 = 4.25 px` 좌우 각각
- 슬롯 간 gap: 6 px (불변)
- **결론: bleed (4.25) < gap (6) → 인접 슬롯 침범 없음**, 사용자 요청 "인접 슬롯 침범 금지" 충족.

basket/bag (SCALE_TIGHT 1.0): visible 50 px → 슬롯 안에 여유롭게 fit.

상대 비율: `72.5 / 50 = 1.45` — 모종삽/물뿌리개의 PNG bbox 가 시각적으로 약 ~70% 면적 (transparent margin 30%) 이라는 추정과 일치. 1.45 보정 후 양쪽 visible content 가 거의 같은 면적으로 읽힘.

## C. 변경 파일

1. **`src/components/Farm/ToolDock.tsx`** — `SCALE_PADDED` 1.25 → 1.45. doc-comment 에 bleed 계산 + PR-11 → PR-14 변화 기록.

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **93/93 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |

CSS-only constant 변경. 금지 토큰 / 절대경로 스캔 영향 없음.

## E. Maintainer 후속 조치

없음. 1줄 상수 변경.

## F. 다음 작업

PR-15 — SkyView 풀화면 진입 시 farm atmospheric haze 제거.
