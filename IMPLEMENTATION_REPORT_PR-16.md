# IMPLEMENTATION_REPORT_PR-16.md — 농장 ↔ SkyView 스와이프 전환

기존 "☁ 하늘 보기" 버튼 / X 버튼 외에 추가 진입로:
- 농장 화면: **위로 스와이프** (touch up / wheel up) → SkyView 진입
- SkyView 화면: **아래로 스와이프** (touch down / wheel down) → 농장 복귀

기존 버튼은 변경 없음.

## A. 구현 결정

| 측면 | 결정 |
| --- | --- |
| 임계값 (touch) | 80 px — SkyView 기존 `SWIPE_DISMISS_PX` 와 동일 |
| 임계값 (wheel) | 60 — 250 ms rolling window 에 누적 |
| Visual feedback during drag | ❌ 미구현 — 사용자 spec "있으면 더 좋음, 없어도 OK" |
| 라이브러리 | 없음. native `onTouchStart/Move/End` + `onWheel` 핸들러. framer-motion `drag` 안 씀 (페이지 스크롤 / 플롯 탭과 충돌 회피). |
| SkyView dismiss 방향 | 양방향 → **아래로만**. 이전엔 `Math.abs(end - start) >= 80` 으로 위·아래 모두 닫혔는데, "위 스와이프 = 하늘 보기" 멘탈 모델과 충돌 — 아래로만 닫히게 좁힘. |

## B. 변경 파일

1. **`src/features/collection/FarmHub.tsx`**:
   - `swipeStartY`, `swipeMoved`, `wheelAcc`, `wheelResetTimer` 4 개 신규 ref.
   - `onFarmTouchStart/Move/End`, `onFarmWheel` 핸들러 신설.
   - `<section data-testid="farm-hub">` 에 4 핸들러 모두 attach.
   - touch: `start - end >= 80` 일 때만 `setSkyOpen(true)` + haptic "light". `skyOpen` 이미 true 면 no-op.
   - wheel: 250 ms 누적 윈도우에서 `wheelAcc <= -60` 일 때 발화.

2. **`src/components/Farm/SkyView.tsx`**:
   - `onTouchEnd` 의 dismiss 조건 `Math.abs(end - start) >= 80` → `end - start >= 80` (down only).
   - 신규 ref + `onSkyWheel` 핸들러 — 누적 wheel `>= 60` 일 때 `onClose()`.
   - motion.div root 에 `onWheel={onSkyWheel}` 추가.

## C. 충돌/회귀 회피

- 플롯 탭 (touch up → 짧은 거리): `Math.abs(dy) <= 8` 으로 `swipeMoved.current = false` 유지 → 브라우저가 normal click 합성 → 기존 onPlotClick 정상 호출.
- SkyView 의 tap-to-cycle-message: 기존 임계값 8 px 이하 = 탭으로 인식하는 로직 그대로.
- ToolDock 의 tool select tap: ToolDock 은 farm-hub section 의 자식이지만, `e.stopPropagation` 없이도 buttons 의 click 이 swipe 트래킹을 방해하지 않음 (touchstart→touchend 가 같은 위치면 swipe 미발화).
- 트랙패드 inertia / 마우스 휠 누적: 250 ms 윈도우 리셋으로 한 번 발화 후 즉시 reset → 연속 발화 방지.

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **93/93 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

## E. 후속 폴리시 후보 (선택)

- Drag 도중 visual feedback (CSS transform 트래킹) — framer-motion `useMotionValue` 로 30~50 라인 추가.
- 키보드 ↑/↓ 키 binding (사용자 spec 없음, 접근성 차원).
- SkyView 활성 상태에서 `cc:sky:opened` CustomEvent → 다른 시스템 (e.g. BGM 트랙 분기) 가 hook 할 수 있게.

## F. Maintainer 후속 조치

없음. UI-only.

## G. 다음 작업

PR-17 — buff indicator + weekly treasure + boxes/gift 정합 follow-up 묶음.
