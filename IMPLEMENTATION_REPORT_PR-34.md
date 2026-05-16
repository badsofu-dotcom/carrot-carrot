# IMPLEMENTATION_REPORT_PR-34.md — 농장 드랍 시스템 (FarmDropLayer)

체류 유도 메커닉. 15~60 초 간격으로 농장 sky 영역에 아이템 spawn → 5 초 안에 탭하면 grant.

## A. 사양

- **간격**: 15~60 초 random (Math.random 균등)
- **위치**: 상단 sky 영역 (top 12-25%, left 15-85%) — plot 영역 침범 회피
- **표시 시간**: 5 초 → fadeout
- **동시 max**: 1 개 (UI 부담 최소)
- **일일 max**: 30 drops (KST 자정 리셋, `cc.farmDrop.dailyCount.<KST_DAY>`)
- **visibility:hidden**: spawn 정지, 복귀 시 재가동

## B. 가중치 매트릭스

| Drop | Weight | 확률 |
| --- | --- | --- |
| gem | 25 | 27.2 % |
| bolt | 20 | 21.7 % |
| heart | 15 | 16.3 % |
| hourglass | 10 | 10.9 % |
| juice | 5 | 5.4 % |
| soup | 5 | 5.4 % |
| cake | 5 | 5.4 % |
| seed | 5 | 5.4 % |
| golden | 1 | 1.1 % |
| hidden_bunny | 1 | 1.1 % |
| (Σ raw = 92) | | (no-drop 8 % no — 사실상 wrap 됨 — 본 PR 은 가장 흔한 gem 으로 폴백) |

## C. Grant 매핑

| Kind | Grant 경로 |
| --- | --- |
| gem/bolt/heart/hourglass/juice/soup/cake | `itemsStore.add(k, 1)` (maxStack 자동 clamp) |
| seed | `farmStore.growAllPlanted(0, null, 1)` (PR-31 dead-state 회피) |
| golden | `farmStore.incGoldenCarrots(1)` |
| hidden_bunny | `itemsStore.add("gem", 5)` placeholder. PR-35 에서 실제 도감 unlock 경로 wire. |

## D. UX 폴리시

- 클릭 시 SFX `giftbox` + haptic "success" + toast.
- 시각: 48 × 48 button, radial gradient halo, drop-shadow + warm glow filter. AnimatePresence 로 entrance (scale 0.5→1, y -10→0) + exit (scale 1→0.6, y 0→10).
- 자산 미존재: emoji fallback (PNG path 없거나 404 시 — 본 PR 은 항상 PNG 우선, fallback 미사용).
- 동시 max 1 — 활성 drop 있는 동안 다음 spawn 예약 안 함.

## E. 구현 파일

- **`src/components/Farm/FarmDropLayer.tsx`** (new): 모든 로직 (timer/state/render). 외부 deps = itemsStore / farmStore / soundStore / safeStorage / toast / haptic / playSfx.
- **`src/features/collection/FarmHub.tsx`**: `<FarmDropLayer />` mount (BuffIndicator 옆).

## F. anti-abuse / 데이터

- 일일 카운터 safeStorage 키만 — 워커 검증 없음. 사용자 spec ("서버 anti-abuse 는 daily-cap 으로 자연 차단") 따름.
- safeStorage 조작은 클라 측 anti-abuse 우회 가능 (대형 보너스 아님 — golden +1 정도). 향후 worker `/farm/drop/claim` 라우트로 검증 가능.

## G. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## H. 다음 작업

PR-35 — 히든 토끼 등장 (도감 unlock 경로 wire + 화면 가로지름 / 히든 스팟).
