# IMPLEMENTATION_REPORT_PR-21.md — 농장 헤더 톱니바퀴 제거

농장 헤더 우상단의 ⚙ (설정) 진입점은 하단 네비 → 내 정보 → 설정 경로와 중복. 제거.

## 변경

- `src/pages/CollectionPage.tsx`
  - `<button data-testid="farm-header-settings">` 블록 (21 라인) 삭제. 자리에 PR-21 의도 주석.
  - 사용처 없어진 `useLocation` import + `navigate` destructure 함께 제거 — dead-code 정리.
- 헤더 우측 잔여: **📖 도감 + 🎁 보상함** 두 개. 선물박스는 daily/주간 보상 진입점이라 농장 첫화면 의미 있음 — 유지.

라우트 `/me` 자체는 그대로. 하단 네비 (`TabBar.tsx`) 에서 그대로 접근 가능 (이번 PR 변경 없음).

## 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean (사용 안 되는 import 제거로 lint baseline 1 줄 감소) |
| `npm run build` | OK |

## 다음 작업

PR-22 (RewardsPanel 모달 내부 스크롤 가능하게).
