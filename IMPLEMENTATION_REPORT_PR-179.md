# PR-179 — AIT 작물 잔상 회귀 fix (popLayout exit 제거)

**Round:** R31
**Commit:** `4de359a`
**Date:** 2026-05-18
**deploymentId:** `019e3ac0-f03d-7a55-9260-df113f4dde1c`

## 요약

실기 AIT (Apps-in-Toss WebView) 에서 씨앗 심기 / 수확 시 이전 작물
sprite 가 1~2 frame 다시 나타났다 사라지는 잔상이 보고됨. dev / preview
Chrome 에서는 재현 안 되는 production-only 회귀. 원인은 R27 PR-163 에서
추가한 `AnimatePresence mode="popLayout"` + 120ms exit transition.

## 진단

### 증상

- 실기 AIT (Apps-in-Toss 콘솔에서 다운받은 .ait) 또는 hosted AIT URL.
- 빈 plot 탭 → 씨앗 sprite 가 등장하기 직전 / 직후, 그리고 stage 4
  수확 → 빈 plot 으로 바뀐 직후, 이전 작물이 한 차례 깜빡 다시
  보이고 사라짐.
- dev (`npm run dev`) / preview build (`npm run preview:serve`) 의
  데스크탑 Chrome 에서는 재현 안 됨.

### 근본 원인

PR-163 의 변경:
```
<AnimatePresence mode="popLayout" initial={false}>
  {plotBounds.map((b) => (
    <motion.image
      key={`${b.id}-${stage}`}
      ...
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.12 } }}
    />
  ))}
</AnimatePresence>
```

- `popLayout` 모드는 exit 중인 노드를 DOM 에 유지하면서 새 노드와
  공간적으로 겹치도록 둠.
- Chrome (devtools / preview iframe) — RAF 합성이 매우 빠르고 GPU
  레이어 transform 이 1 frame 내에 완전히 invisible 상태로 도달.
  사용자는 overlap 을 인지 못 함.
- WKWebView / Android WebView (AIT) — (a) SVG `<image>` 의 `href`
  swap 이 async decode 라 새 sprite 디코딩 동안 old layer 가
  GPU 캐시에 남고, (b) RAF 스케줄러가 다르며, (c) `will-change`
  로 분리된 GPU 레이어가 exit 애니메이션 동안 그대로 보임.
- 결과: 120ms exit 가 "이전 작물이 잠시 다시 나타나는" 시각 잔상
  으로 노출됨.

## 수정

`src/features/collection/FarmHub.tsx` 한 군데:

| 위치 | Before (R27 PR-163) | After (R31 PR-179) |
| --- | --- | --- |
| 9 plot crop sprite wrapper | `<AnimatePresence mode="popLayout" initial={false}>...</AnimatePresence>` | (래퍼 제거 — `plotBounds.map` 직접 렌더) |
| `motion.image.exit` | `{ opacity: 0, scale: 0.7, transition: { duration: 0.12 } }` | (prop 제거 — 즉시 unmount) |
| `motion.image.key` | `\`${b.id}-${stage}\`` (PR-144) | 동일 — 유지 |
| `motion.image.initial` | `{ opacity: 0, scale: 0.7 }` | 동일 — 유지 |
| `motion.image.animate` | `{ opacity: 1, scale: 1 }` | 동일 — 유지 |
| `motion.image.transition` | `{ type: "spring", stiffness: 360, damping: 22 }` | 동일 — 유지 |
| `willChange: "opacity, transform"` | 있음 | 유지 |
| 4-stage `useEffect` preload | 있음 (PR-163) | 유지 |

즉 R27 PR-163 에서 추가된 안전장치 중 **popLayout + exit 만** 롤백.
다른 보호장치 (preload / will-change / key 별 fresh mount) 는 그대로.

### 코드 다이프

```diff
-        <AnimatePresence mode="popLayout" initial={false}>
-          {plotBounds.map((b) => {
-            const stage = stages[b.id];
-            const asset = stageAsset(stage);
-            if (!asset) return null;
-            ...
-            return (
-              <motion.image
-                key={`${b.id}-${stage}`}
-                ...
-                exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.12 } }}
-                ...
-              />
-            );
-          })}
-        </AnimatePresence>
+        {plotBounds.map((b) => {
+          const stage = stages[b.id];
+          const asset = stageAsset(stage);
+          if (!asset) return null;
+          ...
+          return (
+            <motion.image
+              key={`${b.id}-${stage}`}
+              ...
+              (exit prop 없음)
+              ...
+            />
+          );
+        })}
```

`AnimatePresence` import 는 line 763 의 다른 슬롯 (배경 atmosphere
layer) 에서 여전히 사용 중이라 그대로 유지.

## 회귀 위험

R27 PR-163 이 원래 노렸던 시나리오: "양손 탭 / 1초 4+ plot 빠른
연속 탭 시 1~2 frame 잔상". 이 케이스는 다시 발생 가능. 단:

- 그 케이스는 **dev Chrome 에서만** 관찰됐고 universal AIT 회귀와
  trade-off 시 후자가 우선.
- key 별 fresh mount (PR-144) + preload (PR-163) 가 그대로 있어 단순
  탭 시는 무문제.
- 만약 실기에서 양손 탭 잔상이 재발하면 후속 PR 에서
  `mode="wait"` (sequential exit, overlap 없음) 로 시도 가능.

기타 영향:
- `AnimatePresence` import 유지 → ESLint unused-import 안 남.
- 다른 컴포넌트 (`SkyView`, `Atmosphere`, `Effects`) 의 sprite 패턴은
  무관 — 이번 fix 는 9 plot crop sprite 한정.
- TabBar / 인테리어 모달 / 배경 sky layer 모두 무영향.

## 검증 결과

| 검사 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 290/290 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK (399.56 kB main / 127 kB gzip) |
| `npm run build:preview` | OK (399.46 kB main / 127 kB gzip) |
| `VITE_APPS_IN_TOSS_PROXY_URL=... npm run build:ait` | OK |
| `dist-preview/` forbidden-token scrub (8종) | 0/0/0/0/0/0/0/0 |

`carrot-carrot.ait` (49.8 MB) 가 자동으로 `Downloads/carrot-carrot.ait`
로 복사됨 — 콘솔 업로드 원탭.

## 후속

- **사용자**: AIT 콘솔에 새 .ait 업로드 → 실기에서 씨앗 심기 / 수확 시
  잔상 사라졌는지 확인.
- **만약 양손 탭 시 1~2 frame 잔상 재발 보고되면**: 후속 PR 에서
  `<AnimatePresence mode="wait">` 로 sequential exit 적용 시도.
  (popLayout 의 overlap 만 안 되면 잔상 안 보임.)
- **만약 본 fix 후에도 AIT 잔상 잔존 보고되면**: SVG `<image>` 자체의
  WKWebView 디코더 race 가 원인일 수 있음 → HTML `<img>` 오버레이로
  전환하는 다음 단계 시도 (사용자가 처음 거절한 옵션).
