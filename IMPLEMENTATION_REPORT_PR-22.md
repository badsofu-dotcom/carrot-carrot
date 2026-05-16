# IMPLEMENTATION_REPORT_PR-22.md — RewardsPanel 모달 내부 스크롤

PR-17b 가 "주간 보물상자" 섹션을 추가하면서 모달 총 컨텐츠 높이가 82 vh 를 자주 넘게 됨. 기존 motion.div 가 `overflowY: auto + maxHeight 82vh` 였지만, framer-motion 의 transform y 애니메이션이 iOS Safari 에서 내부 overflow 스크롤과 경쟁 → 사용자 perception "메달 한 줄만 보이고 나머지가 스크롤 안 됨".

## A. 구조 변경

기존 (1-layer): motion.div = scroll container.

신규 (2-layer):
- motion.div (outer) = **non-scroll** flex column, `maxHeight: 90vh`, `overflow: hidden` (rounded corner 클립 유지)
- 자식 1: **sticky header** — 드래그 핸들 + 제목 + 닫기 버튼. `flexShrink: 0`.
- 자식 2: **scroll content** `<div data-testid="rewards-scroll">` — `flex: 1`, `minHeight: 0`, `overflowY: auto`, `WebkitOverflowScrolling: touch` (iOS 관성 스크롤).

framer-motion 의 transform 은 outer 만 건드림 → inner 의 scroll behavior 가 깨끗하게 동작.

## B. 추가 변경

- **maxHeight 82 vh → 90 vh** (사용자 spec).
- **스크롤바 hidden**: `scrollbar-width: none` + inline `<style>` 로 `::-webkit-scrollbar { display: none }`. data-testid 셀렉터로 scope 좁힘 (다른 페이지 영향 없음).
- **MEDAL_ORDER 확장**: 6 → 11 — 기존 first/perfect/candy/golden 6 개 + dogam_25/50/75/100 + quiet_sky 추가. 이전엔 unlock 되어도 안 보이던 도감/스카이 메달 가시화.
- **메달 grid auto-fit**: `repeat(3, 1fr)` → `repeat(auto-fit, minmax(86px, 1fr))`. 11 개가 폭에 따라 자동 줄바꿈 (375 px 폭 = 3열, 480 px 폭 = 4열).
- **medalAsset 확장**: dogam_100 → gold, dogam_50/75 + quiet_sky → silver, dogam_25 → bronze. 미정의 case 는 default bronze.
- safe-area padding 은 inner scroll content 로 이동 (헤더는 좌우 일반 padding 만 — 좌우 inset 영향 적음).

## C. 회귀 검증 포인트

- 모달 open 시 헤더가 상단 고정 (닫기 버튼 항상 보임).
- 컨텐츠 영역에서 touch swipe up/down 으로 스크롤 가능.
- 데스크탑에서 wheel 스크롤 동작.
- 컨텐츠가 짧으면 (예: 1 section) 스크롤 안 보이고 자연스럽게 fit.
- 모바일 노치 좌우/아래 safe-area inset 반영.
- iOS Safari 관성 스크롤 자연스러움 (-webkit-overflow-scrolling: touch).

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## 다음 작업

PR-20 (seed 자원 정리 — 소비처 grep + A/B 결정).
