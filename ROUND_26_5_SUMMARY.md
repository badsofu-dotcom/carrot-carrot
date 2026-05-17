# Round 26.5 — TabBar / toolbox 가림 박멸 + ship 자동화 (2026-05-17)

## 한 줄 요약

농장 toolbox 와 인테리어 보관함 strip 을 가리던 TabBar 회귀 2건 해결 +
"농장에 뭔가 떨어졌어요" 팝업 잔재 제거 + `npm run ship:ait` 후
Downloads 폴더 자동 오픈.

## 변경 PR

| PR | sha | 분류 | 한 줄 |
| --- | --- | --- | --- |
| PR-159 | `7381a5d` | fix(farm) | FarmDropLayer drop notify / pushSuppressedDrop 제거 — "농장에 뭔가 떨어졌어요" 회귀 박멸 |
| PR-160 | `3a839bc` | fix(modal) | `body[data-fullscreen-modal-open="1"]` + CSS `nav[aria-label="주요 메뉴"] display:none` — MushroomHouseRoom 풀스크린 진입 시 TabBar 숨김 |
| PR-161 | `03eac3d` | fix(farm) | ToolDock `bottom: calc(12px + env(safe-area-inset-bottom))` — iOS Apps-in-Toss 에서 safe-area-bottom 만큼 TabBar 와 겹치던 회귀 |
| PR-162 | `cf9aa2d` | chore(ship) | `scripts/ship-ait-postbuild.sh` → Downloads 복사 후 `explorer.exe $(wslpath -w …)` 로 폴더 자동 오픈 (WSL 한정) |

## 회귀 근원 분석

### 1. TabBar 가 fullscreen 모달 위에 보이는 이유 (PR-160)

`MushroomHouseRoom` z-index 1100, `TabBar` z-index 100 — 단순 비교로는
모달이 위. 그러나 `.app-shell` 에 `isolation: isolate` 가 걸려있어
새 stacking context 가 형성되고, 그 안에서 `framer-motion` `AnimatedRoutes`
의 `transform` 이 다시 sub-context 를 만든다. 모달은 그 안쪽에 렌더링
되므로 바깥의 TabBar 와 z-index 비교가 불가능 → TabBar 가 화면상 위로
올라온다.

해결: stacking 을 건드리는 대신 모달 open 동안 TabBar 자체를 DOM 에서
**display:none** 처리. body class 토글 + CSS 한 줄로 끝나는 가장 작은
패치.

### 2. iOS Apps-in-Toss 에서 ToolDock 이 TabBar 와 겹치는 이유 (PR-161)

```
CollectionPage <main> height
  = calc(100dvh - env(safe-area-inset-top) - var(--tabbar-reserved))
  = vh - safe-top - 56
```

→ main 의 bottom 은 viewport 기준 `vh - 56` 위치.

```
TabBar fixed bottom
  = calc(var(--tabbar-offset) + env(safe-area-inset-bottom))
  = 0 + safe-bottom
height = 56
→ TabBar top = viewport y (vh - 56 - safe-bottom)
```

→ TabBar top 은 main bottom 보다 `safe-bottom` 만큼 **위**. 즉 농장
카드 (main 자식) 의 bottom 영역은 TabBar 와 `safe-bottom` 만큼 겹친다.

ToolDock 은 농장 카드 내 `absolute bottom: 12` — 농장 카드 bottom 의
12px 위 → TabBar top 보다 `safe-bottom - 12 + 12 = safe-bottom` 만큼
아래. WSL/desktop 에선 safe-bottom = 0 이라 무난, 그러나 iOS Apps-in-Toss
의 safe-bottom ≈ 34px 환경에선 ToolDock 이 TabBar 위로 22px 침범.

해결: `bottom: calc(12px + env(safe-area-inset-bottom))` — desktop 12,
iOS 46 으로 자동 보정. main height 자체를 건드리지 않아 다른 컴포넌트
영향 없음.

### 3. drop 팝업이 살아있던 이유 (PR-159)

R18 PR-130 에서 NotifyKindRow 의 `drop` 토글 row 가 UI 에서 제거되었으나
`notificationsStore` default 가 여전히 `drop: true`. 사용자가 켜고 끌 수
있는 화면이 없는데 default 가 ON → 보고 "농장에 뭔가 떨어졌어요" 가 계속
뜸. 해결: `FarmDropLayer` 의 `notify("drop")` + `pushSuppressedDrop`
branch 자체를 제거. drop 자산 spawn 로직은 유지.

## 사이드 효과 / 회귀 위험

- **PR-160**: TabBar 가 모달 진입 시 DOM 에서 사라짐 — 다른 fullscreen
  모달 (BunnyGachaModal, InventoryModal 등) 이 같은 body class 를 토글
  하면 동일 동작. 현재는 MushroomHouseRoom 만 사용. 다른 모달이 `display:flex`
  나 transform 으로 TabBar 위에 그려지는 케이스는 그대로 유지.
- **PR-161**: `env(safe-area-inset-bottom)` 미지원 브라우저에선 fallback
  값 0 으로 평가되어 기존 12px 동작 유지. 회귀 가능성 없음.
- **PR-162**: explorer.exe 부재 환경 (pure Linux, macOS) 에선 자동 skip.

## 빌드 / 테스트 결과

```
node --test src/lib/*.test.mjs    272/272 pass
npm run typecheck                 clean
npm run build                     ✓ 541ms
npm run build:preview             ✓ 377ms
npm run build:ait                 ✓ 48M, deploymentId 019e366a-2018-7a5b-bcf3-6292a72cc6cc
forbidden-token scrubs            0 hits (localStorage / sessionStorage / indexedDB /
                                  fullscreen / pointerlock / "/assets/farm")
```

## 산출물

- `carrot-carrot.ait` (48M) — `/mnt/c/Users/badso.버니즈/Downloads/carrot-carrot.ait`
- deploymentId — `019e366a-2018-7a5b-bcf3-6292a72cc6cc`
- explorer.exe 가 Downloads 폴더 자동 오픈 ✓

## 다음 (R26.6+ 후보)

- `RewardsPanel` 의 "🍄 버섯집 들어가기" 카드 정리 — 이제 농장 라벨로 이미
  진입 가능하므로 중복 (사용자 확인 대기).
- 가구 배치 UI / 회전 / 저장.
- 9 가구 합성 마지막 step 보상 (현재 미정).
