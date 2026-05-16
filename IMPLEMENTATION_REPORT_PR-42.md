# IMPLEMENTATION_REPORT_PR-42.md — AdRewardChannelModal viewport overflow hotfix

ToolDock 5번째 광고 슬롯 (PR-28) 탭 시 AdRewardChannelModal 우측이 viewport 밖으로 밀려 절반만 보이는 버그.

## 진단

기존 코드 (`src/components/Inventory/AdRewardChannelModal.tsx:167-177`):
```tsx
<motion.div
  initial={{ y: 20, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  ...
  style={{
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    ...
  }}
/>
```

`transform: translate(-50%, -50%)` 와 framer-motion 의 y 애니메이션 (자동으로 `transform: translateY(...)` 세팅) 가 같은 CSS `transform` 속성에 경쟁. framer-motion 이 매 frame transform 을 덮어쓰므로 `-50%, -50%` offset 이 사라지고 모달의 top-left 가 viewport 중앙에 박힘 → 모달 폭/높이 만큼 우/하단으로 overflow.

PR-6.5 (InventoryModal) + PR-22 (RewardsPanel) 와 동일 패턴. 두 PR 모두 grep 시 `translateX(-50%)` (X 대문자) 만 찾아 `translate(-50%, -50%)` (X 소문자 함수) 형태를 누락했음.

## 수정

BunnyGachaModal 패턴 차용 — outer fixed inset:0 + flex centering, inner motion 카드는 transform 자유 사용.

```tsx
<motion.div
  // backdrop + flex centering
  style={{
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px calc(16px + env(safe-area-inset-right)) 16px calc(16px + env(safe-area-inset-left))",
    boxSizing: "border-box",
    ...
  }}
  onClick={onClose}
>
  <motion.div
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    onClick={(e) => e.stopPropagation()}
    style={{
      // No fixed positioning. flex parent centers.
      width: "100%",
      maxWidth: 360,
      ...
    }}
  >
    {/* content */}
  </motion.div>
</motion.div>
```

이전 fragment `<>...</>` 도 단일 motion.div 으로 합쳐 backdrop 과 카드를 한 element 트리에 묶음.

## 다른 모달 회귀 점검

`grep -rn "translate(-50%, *-50%)"` 결과:
- `TimerDisplay.tsx:249` — 타이머 디스플레이 progress arc, motion 없음 → 안전
- `CollectionPage.tsx:733` — 캐릭터 시트 카드, motion 없음 → 안전
- `FarmHub.tsx:617` — 농장 stage aspect wrapper, motion 없음 → 안전
- `AdRewardChannelModal.tsx:170` — **수정 대상**

BunnyGachaModal / InventoryModal (PR-6.5) / RewardsPanel (PR-22) / AdSuggestionModal (PR-27) 은 이미 안전한 패턴 사용 중.

## 안전 자세 (향후 모달)

이 프로젝트의 권장 모달 정렬 패턴 (PR-6.5 + PR-22 + PR-42 통합):

1. **하단 시트** (full width, bottom-anchored): `left:0; right:0; margin: 0 auto; bottom:0; maxWidth: 480`
2. **중앙 카드** (콘텐츠 박스): outer fixed inset:0 + display:flex 중앙 정렬 → inner motion 카드는 width/maxWidth 만 + transform 자유

절대 사용 금지: `transform: translate(-50%, -50%)` 가 `motion.div` 의 inline style 안에 있는 경우. animate prop 이 `y` / `x` / `scale` 어떤 거든 transform 을 덮어씀.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |

테스트 추가 (사용자 spec) 는 본 PR 범위 밖 — `boundingClientRect` 검증은 jsdom 환경에서 별도 셋업 필요 (visual regression 도구가 더 적합). 정적 코드 리뷰로 패턴 차용 검증.

## 다음 작업

PR-41 resume (보따리 UX: itemMeta + 클릭 선택 + 하단 sticky 패널).
