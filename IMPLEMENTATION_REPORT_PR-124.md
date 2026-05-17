# IMPLEMENTATION_REPORT_PR-124.md — 5분 gate 사전 hint

ONBOARDING_AUDIT (PR-118) 발견 1: "5분 gate 사전 안내 부재". 베타 출시 전 highest-impact 단순 fix.

## 결정

HomePage 의 TimerControls 아래에 한 줄 hint:
```
💡 5분 이상 집중해야 작물이 자라요
```

조건부 표시: `isIdle && ...`. FOCUSING / PAUSED 중에는 noise 회피 위해 미표시.

스타일:
- color: `var(--text-tertiary)` (subtle)
- opacity: 0.8
- textAlign: center
- fontSize: 11

## 동기

신규 사용자가 4분 abandon → 토스트로 첫 인지 → 좌절. PR-124 사전 hint 가 IDLE 시점에 명시 — 시작 전 인지.

학습 도구 톤 일관: 작고 친근 ("💡" emoji + soft color). 핵심 흐름 (시작 버튼) 방해 X.

## 변경 파일

- `src/pages/HomePage.tsx` — TimerControls 아래 conditional hint p tag

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 247 / 247 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
