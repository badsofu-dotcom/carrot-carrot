# IMPLEMENTATION_REPORT_PR-18.md — ToolDock basket/bag 축소

PR-14 이후 사용자 피드백: 모종삽/물뿌리개 (PADDED) 적당, 바구니/보따리 (TIGHT) 가 살짝 더 큼.

## 결정

- `SCALE_PADDED = 1.45` **유지** (사용자 명시)
- `SCALE_TIGHT = 1.0 → 0.9` — 바구니/주머니 display 50 × 0.9 = 45 px 로 약간 축소
- ICON_SIZE 50 / SLOT_SIZE 64 모두 유지

시각 검증:
| 슬롯 | display | PNG fill (추정) | visible content |
| --- | --- | --- | --- |
| 모종삽/물뿌리개 | 72.5 px (50×1.45) | ~70% | ~50 px |
| 바구니/주머니 | 45 px (50×0.9) | ~100% | ~45 px |

→ 4 슬롯이 visible 47~50 px 사이로 수렴. 사용자 perception "basket/bag 살짝 큼" 보정.

## 변경 파일

`src/components/Farm/ToolDock.tsx` — 상수 `SCALE_TIGHT` 1.0 → 0.9. doc-comment 보강 (PR-11/14/18 변화 cross-ref).

## 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-21 (톱니바퀴 제거).
