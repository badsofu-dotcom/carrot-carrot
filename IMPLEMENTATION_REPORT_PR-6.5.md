# IMPLEMENTATION_REPORT_PR-6.5.md — Bottom-sheet overflow on mobile

Hotfix. 모바일 뷰포트에서 InventoryModal/RewardsPanel 시트가 좌측에 치우치고 우측이 화면 밖으로 잘리던 회귀 수정.

## A. 진단

증상: 모바일 (375–430 px) 에서 보따리 → 모달 오픈 → 시트가 가운데 정렬 안 되고 우측 닫기 버튼이 화면 밖으로 나감.

**근본 원인 — framer-motion transform 충돌.**

해당 모달은 두 가지를 같은 `transform` CSS 속성에 걸고 있었음:

1. 정적 정렬: inline `style={{ left: "50%", transform: "translateX(-50%)" }}`
2. 슬라이드-인 애니메이션: framer-motion `<motion.div initial={{ y: "100%" }} animate={{ y: 0 }}>` → 런타임에 `transform: translateY(...)` 를 같은 element 에 강제로 세팅

CSS `transform` 속성은 단일 값만 가짐. framer-motion 이 마지막에 셋팅하므로 `translateY` 만 살아남고 `translateX(-50%)` 가 사라짐. 결과: `left: 50%` 만 유효 → 시트의 좌측 모서리가 화면 중앙에 박혀버림 → 우측 width만큼 오버플로우.

## B. 적용된 모달

| 파일 | 패턴 | 수정 |
| --- | --- | --- |
| `src/components/Inventory/InventoryModal.tsx` | `left:50% + translateX(-50%) + motion y` | ✅ |
| `src/components/Farm/RewardsPanel.tsx` | 동일 | ✅ |
| `src/design-system/ui.tsx` (BottomSheet) | 부모 flex `justifyContent:center` 로 정렬 — 충돌 없음 | OK |
| `src/components/Inventory/BunnyGachaModal.tsx` | 부모 flex centered — 충돌 없음 | OK |
| `src/components/Inventory/AdRewardChannelModal.tsx` | 부모 flex centered — 충돌 없음 | OK |
| `src/features/collection/BunnyOnboardingModal.tsx` | `translateX(-50%)` 는 자식 indicator 에만 — motion.div 와 분리 | OK |

기타 `translateX(-50%)` 사용처 (`SessionDots`, `ToolDock`, `SkyView`, `Effects`, `FarmHub`, `CollectionPage`) 는 모두 정적 positioned element (툴팁/배지/도트) — 같은 element 에 framer-motion `y` 애니메이션 없음. 안전.

## C. 수정 패턴

```diff
- left: "50%",
- transform: "translateX(-50%)",
+ left: 0,
+ right: 0,
+ marginLeft: "auto",
+ marginRight: "auto",
```

`transform` 속성을 비워 framer-motion 이 `y` 애니메이션을 자유롭게 쓸 수 있게 하고, `left:0/right:0 + margin auto` 로 정렬.

추가 안전장치:
- `boxSizing: "border-box"` — padding 이 width 를 부풀리지 않도록 명시.
- `overflow: "hidden"` (InventoryModal) — 자식 내용이 절대 시트 밖으로 새지 않게.
- 가로 padding 에 `env(safe-area-inset-left)` / `env(safe-area-inset-right)` 추가 — iPhone 노치/곡면 화면 대비.

## D. 뷰포트 폭 검증 (코드 리뷰)

| 폭 | `width: 100%` 결과 | `maxWidth: 480` 적용 | 정렬 |
| --- | --- | --- | --- |
| 375 (iPhone SE) | 375 px | 480 적용 안 됨 (375 < 480) | margin auto → 0,0 양변 모두 0 = 화면 폭 그대로 |
| 390 (iPhone 13) | 390 px | 동일 | 동일 |
| 430 (iPhone 15 Pro Max) | 430 px | 동일 | 동일 |
| 768 (iPad) | 480 px | 768 - 480 = 288 / 2 = 144 px 좌우 margin | 가운데 정렬 |
| 1280 (Desktop) | 480 px | 좌우 margin (1280-480)/2 = 400 px | 가운데 정렬 |

## E. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **78/78 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 (`localStorage` 등) | 각 0 |
| 절대경로 `"/assets/farm"` / `'/assets/farm` | 0 |

AIT 빌드는 PR-6 에서 동일 코드 흐름으로 이미 통과 (`019e3069-8e2c-7c69-8b2a-0b1742169073`). PR-6.5 는 CSS only 변경 — AIT 빌드 영향 없음, 추가 실행 생략.

## F. Maintainer 후속 조치

없음. CSS-only hotfix.

## G. 다음 작업

PR-7 부터 옵션 C 신규 콘텐츠 (gem / juice / soup / cake) 자율 진행.
