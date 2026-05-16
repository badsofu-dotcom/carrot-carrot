# IMPLEMENTATION_REPORT_PR-23.md — BuffIndicator pill 줄바꿈 방지

PR-17a 의 buff pill 이 "주스 효과" 같은 2-word 라벨로 좁은 컨테이너 (390 px 모바일) 에서 mid-word wrap → "주스 효 / 과".

## 변경

- 라벨 단순화 — "주스 효과" → "주스" (1 word), "수프 효과" → "수프", "케이크 효과" → "케이크". 이모지는 그대로.
- pill 컴포넌트 `whiteSpace: "nowrap"` + `flexShrink: 0`. 라벨이 길어져도 wrap 대신 horizontal overflow (parent gap 6 + ample width).
- aria-label 은 "주스 효과 활성" 으로 명시적 — screen reader 가 "효과" 까지 발음하도록 보존.

## 검증

3 pill 모두 활성 시 (DEV cheat "버프 일괄 활성"):
- pill 폭 = padding 16 + emoji 12 + gap 3 + label ~24 = ~55 px
- 3 pill × 55 + gap 6 × 2 = ~177 px
- 컨테이너 width 자동 (top center, left 50% + translateX -50%) → 모바일 390 / 안전.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-25 (DEV 모든 자원 보강).
