# IMPLEMENTATION_REPORT_PR-82.md — RewardsPanel TabBar 겹침 + safeAreaBackdrop 4면 강화

## 정정

Round 11 spec 의 사용자 보고:
> 우측 상단 선물박스 모달 (🎁 아이콘 → "하나만 골라요 · 채널별 하루 1회")

코드 grep 결과 두 모달 식별:
- **🎁 아이콘 → RewardsPanel** (보상함 bottom sheet, 큰 컨테이너)
- **"하나만 골라요" 텍스트 → AdRewardChannelModal** (보상함 안에서 광고 보기 누르면 열리는 작은 모달)

PR-79 가 이미 AdRewardChannelModal 에 safeAreaModalStyle 적용했으나:
- **RewardsPanel 자체는 미수정** — bottom: 0 + maxHeight 90vh 로 floating TabBar (height 68 + offset 16*2 = 100px) 영역과 충돌
- **safeAreaBackdropStyle 의 top/bottom safe-area 누락** — notch 디바이스에서 추가 안전 마진 부족

## 변경

### `src/components/Farm/RewardsPanel.tsx` — TabBar 위로 lift (PR-68 패턴)

```diff
- bottom: 0,
+ bottom: "calc(var(--tabbar-reserved, 100px) + env(safe-area-inset-bottom))",
...
- maxHeight: "90vh",
+ maxHeight: "calc(100dvh - var(--tabbar-reserved, 100px) - env(safe-area-inset-bottom) - 12px)",
```

내부 scroll padding 의 `env(safe-area-inset-bottom)` 도 단순화 — 이미 outer bottom offset 에 포함되어 중복 적용되던 것을 제거.

### `src/lib/ui/safeAreaModal.ts` — backdrop 4면 모두 safe-area

```diff
- padding: "16px calc(16px + env(safe-area-inset-right)) 16px calc(16px + env(safe-area-inset-left))",
+ padding: "calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))",
```

이전 (PR-79): 좌/우 safe-area 만. notch + TabBar 환경에서 top/bottom 모자랐음.
PR-82: 4면 모두 → 모든 viewport 에서 자식 모달 visible.

이 변경은 `safeAreaBackdropStyle` 를 import 하는 모든 모달에 자동 적용:
- AdRewardChannelModal (PR-79)
- GemTradeModal (PR-81)

## 테스트 — `src/lib/safeAreaModal.test.mjs` 추가

| 케이스 | 검증 |
| --- | --- |
| backdrop 4면 safe-area | top/right/bottom/left 모두 |
| backdrop padding 4 calc | regex count == 4 |
| maxHeight 100dvh 식 | viewport-relative |
| 90vh fixed 회귀 차단 | regression guard |

2 신규 + 1 보강. 총 **184 / 184 pass**.

## 변경 파일

- `src/lib/ui/safeAreaModal.ts` — backdrop padding 4면 + comment
- `src/components/Farm/RewardsPanel.tsx` — bottom + maxHeight 동적
- `src/lib/safeAreaModal.test.mjs` — 보강

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 184 / 184 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## iPhone SE / XR viewport 검증 (수동)

| Viewport | 이전 RewardsPanel | PR-82 후 |
| --- | --- | --- |
| 375×667 (SE) | bottom 영역 ~100px 가 TabBar 와 겹쳐 컨텐츠 잘림 | bottom 100+safearea 위로 lift, 컨텐츠 100% visible |
| 414×896 (XR) | 같은 문제 | 동일 fix 적용 |
| 390×844 (mobile baseline) | 그 viewport 가 디자인 baseline 이라 issue 적었음 | 더 일관된 동작 |
