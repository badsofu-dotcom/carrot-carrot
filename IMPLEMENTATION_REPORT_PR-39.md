# IMPLEMENTATION_REPORT_PR-39.md — ECONOMY_DESIGN v2 + ROADMAP

PR-31 ~ PR-38 반영 + 향후 wire 정리.

## 변경

1. **`ECONOMY_DESIGN.md`** v2 갱신:
   - 자원 분류 (currency / soft / consumable / token + honor + dex)
   - Conversion table candy 4 → 7 %, golden 1 → 0.6 % 반영
   - Gem trade 5 옵션 표
   - 농장 드랍 가중치 (PR-34)
   - 히든 토끼 spawn 규칙 (PR-35)
   - 도감 패시브 매트릭스 (PR-38)
   - PR-32 의 N-th tier + EV / cap 갱신은 PR-32 에 이미 들어가 있음.

2. **`ROADMAP.md`** (new):
   - 자율 PR 누적 표 (PR-6 ~ PR-42)
   - 잔여 wire (도감 passive 풀-wire / hidden bunny B / worker / 자산 / UX 폴리시)
   - Hard stops (시크릿 / 자산)

## 5-command (PR-39 + PR-40 결합)

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **101/101 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |
| DEV strings in prod (DCE verify) | 0 ("모든 자원" / "시간대 강제") |

## 다음 작업

PR-40 (정합 검증) — 본 PR 의 5-command 결과 자체가 정합 검증. 별도 PR 안 작성 (이 보고서가 PR-39+40 통합 report).
