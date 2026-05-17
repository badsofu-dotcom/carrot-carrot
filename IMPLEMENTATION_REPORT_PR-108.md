# IMPLEMENTATION_REPORT_PR-108.md — 리포트 막대 0 표기 정제

## 발견

`ReportPage` 의 "이번주 집중 막대" 가 모든 day 의 carrot count 를 막대 위에 숫자로 표시. 0 일은 "0" 이 표시되어 시각 noise.

## 결정 (자율) — threshold = 1

사용자 spec "1분 미만 미표시" 는 분 단위 threshold. 실제 막대는 carrot count (분 아님). carrot 1+ 면 → 학습 의미 있음. carrot 0 = 표시 안 함.

`d.carrots > 0` 조건으로 label conditional render. 막대 자체는 기본 ratio (`Math.max(d.carrots / weekMax, 0.06)`) 로 작은 baseline 유지 — 그래야 막대 자리는 확보됨.

## 변경

```diff
- <span ...>{d.carrots}</span>
+ {d.carrots > 0 && <span ...>{d.carrots}</span>}
```

합계는 header 의 `{totalMinutesWeek}분 집중` 가 유지 (사용자 spec "'0분 집중' 합계는 유지").

## 변경 파일

- `src/pages/ReportPage.tsx` — week chart bar label conditional render

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 233 / 233 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
