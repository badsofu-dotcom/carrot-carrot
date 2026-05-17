# Round 28 — toolbox 롤백 + 카피 정리 + TabBar 바닥 fix + 보관함 활성 (2026-05-18)

## 한 줄 요약

R26.5 PHASE 2 의 ToolDock safe-area 보정이 plot grid 와 충돌한 회귀
복구 + 농장 화면 "5분 이상" 카피 제거 + 캡슐 TabBar 폐기 (바닥 fix
full-width) + 인테리어 보관함의 배치 완료 가구 시각 분리.

## 변경 PR

| PR | sha | 분류 | 한 줄 |
| --- | --- | --- | --- |
| PR-168 | `457e3cb` | fix(farm) | ToolDock bottom 12 롤백 + CollectionPage farm 탭 main height 에 safe-bottom 도 빼서 toolbox 와 plot grid 충돌 해결 |
| PR-169 | `b13b2e5` | fix(farm) | FarmHub helpCopy planted 분기 제거 — "5분 이상" 은 HomePage idle 전용 |
| PR-170 | `e1b4412` | feat(layout) | TabBar 캡슐 → bottom 0 / left right 0 / full-width / frosted bg + paddingBottom safe-bottom |
| PR-171 | `c7aa5a2` | feat(decor) | 보관함 strip 배치 완료 슬롯 — 초록 테두리 + ✓ 배지 + tint + 탭 시 "이미 배치" toast |

## PHASE 1 — toolbox 위치 회귀

### 회귀 근원

R26.5 PR-161 의 commit message 가 정확했지만 실제 원인 파악이 부정확:
"farm card 가 TabBar zone 안으로 safe-bottom 만큼 침범" 까지는 맞으나,
해결은 **main height 자체** 를 조정해야 했음. ToolDock 의 bottom 만
올리니 plot grid 마지막 row 와 시각 충돌.

### 수정

| 위치 | 이전 (R26.5) | 이후 (R28) |
| --- | --- | --- |
| `ToolDock.tsx` bottom | `calc(12px + env(safe-area-inset-bottom))` | `12` |
| `CollectionPage.tsx` farm 탭 main height | `calc(100dvh - safe-top - tabbar-reserved)` | `calc(100dvh - safe-top - **safe-bottom** - tabbar-reserved)` |

→ farm card bottom === TabBar top 으로 정확히 정렬. toolbox bottom 12
은 TabBar 위 12px 여백.

## PHASE 2 — "5분 이상" 카피 제거

### 위치 식별

- HomePage.tsx:509 — `isIdle` gate 안에서 노출 (정상)
- FarmHub.tsx:385~ — `helpCopy` 의 planted 분기에서 무조건 노출 (회귀)

### 수정

helpCopy 의 planted 분기를 empty string 으로 정리하고 pill 자체를
`{helpCopy && <div>...}` 로 conditional render. empty / ready 분기는
유지 — 농장에서도 의미 있는 hint.

## PHASE 3 — TabBar 바닥 fix

### 디자인 변경

| 속성 | 이전 (캡슐) | 이후 (바닥 fix) |
| --- | --- | --- |
| `bottom` | `calc(--tabbar-offset + safe-bottom)` | `0` |
| 좌우 margin | 16px (`width: calc(100% - 32px)`) | 0 (`width: 100%`) |
| `borderRadius` | `var(--radius-pill)` (캡슐) | 외곽 0, 개별 tab pill 그대로 |
| 외곽 background | (내부 grid 에 있음) | nav 안 wrapper 로 이동 |
| `paddingBottom` | 없음 (offset 으로 위로 띄움) | `env(safe-area-inset-bottom)` |
| `border-top` | 없음 | `1px solid var(--border-subtle)` |

활성 tab 의 motion.span layoutId="tab-pill" 은 그대로 — 개별 tab 강조는
여전히 pill 모양. 외곽만 직선 hairline.

### 인테리어 모달 호환

R26.5 PHASE 1 의 `body[data-fullscreen-modal-open="1"] nav[aria-label="주요
메뉴"] { display: none }` 규칙은 selector 가 nav 의 aria-label 기반이라
디자인 변경과 무관 — 그대로 작동.

## PHASE 4 — 보관함 strip 활성 분리

### 시각 분기 (R28)

| 상태 | 테두리 | 배경 | opacity | 배지 |
| --- | --- | --- | --- | --- |
| 배치 완료 (isPlaced) | `2px solid #10B981` | `rgba(16, 185, 129, 0.12)` | 1.0 | ✓ 18px 초록 원 |
| 보관함 도착 (pending) | `2px solid #FF7B61` + bounce | `rgba(255,255,255,0.95)` | 1.0 | — |
| unlocked 미배치 | `1px solid rgba(255,255,255,0.4)` | `rgba(255,255,255,0.55)` | 1.0 | — |
| 자물쇠 | `1px solid rgba(255,255,255,0.4)` | `rgba(255,255,255,0.55)` | 0.55 + grayscale | 🔒 + 🥕 가격 |

### 클릭 동작

| 상태 | 액션 |
| --- | --- |
| 배치 완료 | toast `"○○ — 이미 배치된 가구예요"` + light haptic (회수 X) |
| pending | place() — 방에 배치 |
| 자물쇠 | BuyFurnitureModal open |

회수 기능은 사용자 결정 대기 (R29+).

## 빌드 / 테스트

```
node --test src/lib/*.test.mjs    290/290 pass
npm run typecheck                 clean
npm run build                     ✓ 546ms
npm run build:preview             ✓ 365ms
npm run build:ait                 ✓ 48M, deploymentId 019e3693-1bd8-7785-8cb0-29d09705216a
forbidden-token scrubs            0 hits
```

## 산출물

- `carrot-carrot.ait` (48M) → `/mnt/c/Users/badso.버니즈/Downloads/`
- deploymentId `019e3693-1bd8-7785-8cb0-29d09705216a`
- explorer.exe 자동 오픈 ✓
- Telegram 5건 전송 ✓

## 다음 (R29 후보)

- 배치 완료 가구 회수 (`unplaceFurniture(step)`) — UX 결정 필요
- 가구 자유 배치 UI (현재는 step 별 사전 합성 bg)
- TabBar 활성 pill 의 layoutId 애니메이션 회귀 검증 (캡슐 → 바닥 fix
  전환 시 spring transition 그대로인지)
