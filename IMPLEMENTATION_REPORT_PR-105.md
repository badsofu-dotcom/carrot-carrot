# IMPLEMENTATION_REPORT_PR-105.md — 캔디/황금 당근 description 단순화

## 변경 매트릭스

| 자원 | Before | After |
| --- | --- | --- |
| 캔디 | "수확 보너스 7 % 보너스. 토스포인트 5 P 환산. 콤보 / 주스 효과로 확률 ↑." | "5 토스포인트로 환산되는 보너스 당근. 수확 시 일정 확률로 등장." |
| 황금 | "수확 보너스 0.6 % 희귀 보너스. 토스포인트 10 P. 케이크 사용 시 확률 강화." | "10 토스포인트로 환산되는 희귀 당근. 수확 시 낮은 확률로 등장." |

## 결정 이유

- **P 환산 중심**: 사용자 가치 = 토스포인트. 시작 문장 = P 환산 가치.
- **확률 detail 제거**: 7% / 0.6% 같은 수치 제거. 버프 / 도구 / 도감 description 에 위임. 사용자 인지 부담 감소.
- **콤보 / 주스 / 케이크 detail 제거**: 각 버프/도구 description 이 자기 효과 설명. 자원 description 에서 cross-reference 줄임.
- **"수확 시 ... 확률로 등장"**: 행동 (수확) + 빈도 ("일정"/"낮은") 만. 학습 도구 톤 일관.

## 변경 파일

- `src/lib/itemMeta.ts` — candy / golden longDescription

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 233 / 233 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
