# IMPLEMENTATION_REPORT_PR-60.md — Round 7 정합 검증 + 통합 보고

PR-56 ~ PR-59 의 누적 영향 검증.

## A. Round 7 PR 누적

| PR | sha | 핵심 |
| --- | --- | --- |
| PR-56 | `019e4ef` | InventoryModal grid alignContent start + DetailPanel maxHeight scroll |
| PR-57 | `ada7fe8` | DetailPanel/ActionBar 분리, sticky-bottom 사용 버튼 |
| PR-58 | `11e74a6` | seed iconRel → tool_seed_pack (3 사이트 동기화) |
| PR-59 | `75a6ae6` | BuffChip + BuffInfoPopover + buffsStore expiresAt + 만료 깜빡임 |

## B. 사용자 검증 체크리스트 (Round 7 spec)

| 항목 | 상태 |
| --- | --- |
| InventoryModal 자원 탭: 5번째 셀이 2행 1번 위치 | ✅ `alignContent: start` + `gridAutoRows: min-content` |
| InventoryModal 도구 탭: 5번째 셀이 2행 1번 위치 | ✅ 동일 |
| DetailPanel 본문 안 잘림 | ✅ `maxHeight: min(280px, 45vh)` + `overflowY: auto` |
| 사용형 아이템 모두 [사용] 버튼 노출 + 동작 | ✅ sticky ActionBar + 기존 onUse switch |
| 씨앗 아이콘 모든 위치 동기화 | ✅ itemsStore / FarmDropLayer / CollectionPage 헤더 (3 사이트) |
| 농장 드랍 씨앗도 새 비주얼 | ✅ FarmDropLayer.DROPS seed entry |
| 버프 칩 잔여시간 mm:ss + progress bar | ✅ BuffChip 1초 tick + linear bar |
| 버프 칩 탭 시 popover 효과 설명 | ✅ BuffInfoPopover (PR-42 안전 패턴) |
| 만료 5초 전 깜빡임 | ✅ `isFinalCountdown` + `buff-chip-blink` keyframe |
| tests 130+ pass | ✅ **130 / 130** (+4 buffEffects) |
| typecheck/build/buildpreview clean | ✅ |
| DEV string DCE OK | ✅ ("모든 자원" / "시간대 강제" 모두 prod 빌드에서 0건) |

## C. 자율 적용 micro-개선

PR-56 ~ PR-59 진행 중 발견 / 자율 적용:

1. **씨앗 자산 spec 보정** — spec 의 `tool_fertilizer.png` 자산 부재 확인 → 의미적으로 가장 가까운 `tool_seed_pack.png` 사용 결정 + 사유 commit/PR-58 report 에 명시.
2. **DetailPanel paddingBottom 12 → 16** — 사용 버튼 분리 후에도 본문 끝과 panel 경계 간 여유 확보.
3. **ActionBar press scale 0.97** — pointerdown 시 0.97 scale, pointerup/leave 시 1 — 누름 피드백 강화.
4. **BUFF_META "버프" suffix** — "주스" → "주스 버프", "수프 효과" → "수프 버프" 등 라벨 통일 (spec a).
5. **BUFF_META description + trigger 분리** — popover 가 효과 + 발동 조건 둘 다 보여줌. 사용자 인지 강화.
6. **buffsStore safeStorage key v1 → v2** — shape 변경 (boolean → expiresAt). 기존 v1 데이터 자동 폐기 — 데이터 손실 = 활성 buff 1개. 만료도 비슷 시간 안 일어났을 것이라 영향 미미.
7. **BuffChip color 그라데이션 살짝** — meta.color 의 `55` 알파 (33%) 로 progress bar 색깔 부드럽게.

## D. 본인 (사용자) 가 다음에 직접 사용해보면 좋을 곳

1. **InventoryModal 도구 탭** — 케이크 (5번째) 클릭 → DetailPanel 본문 + 사용하기 버튼 (ActionBar). 이전 회귀 fix 확인.
2. **InventoryModal 자원 탭** — seed chip (씨앗 봉투 비주얼) → DetailPanel 의 longDescription 확인.
3. **농장 헤더** — 씨앗 자원 chip 의 새 봉투 아이콘 확인. 농장 드랍 spawn 의 씨앗 비주얼 확인 (시간 걸림 — 15~60초 간격).
4. **버프 활성** — DEV "버프 일괄 활성" → 3 chip 동시 노출 + 잔여시간 카운트다운 → chip 탭 popover → 5초 전 깜빡임 (juice 가 가장 짧음 = 15분, 빨리 보려면 사용자가 시간 빠르게 흐름 가정).
5. **DEV 패널 → 버프 일괄 활성 → 농장 진입** — chip 3개 떠 있는지, 5분 정도 기다리면 자연 만료 확인 (또는 DEV "로컬 데이터 초기화" 로 reset).

## E. Round 8 후보 이슈 (있으면)

후속 발견 또는 user feedback 시 다룰 만한 곳:

- **알림 시스템 (PR-53) 잔여 wire**: session/midnight/treasure trigger + SettingsPage 토글 row + in-app banner UI 컴포넌트.
- **친구 초대 (PR-54) UI**: SettingsPage 의 "친구 초대" 섹션 + 코드 입력 폼 + 공유 버튼 (현재 store stub 만).
- **도감 패시브 (PR-38) 잔여 wire**: 세션 carrot ×1.05 / gift boost ×1.5 / dailyCap +10 — HomePage / RewardsPanel onClaim / worker.
- **히든 토끼 (PR-35) 사양 B**: 농장 배경 특정 spot 에 살짝 보이기 (사용자 spec A + B 둘 다 원했음, A 만 ship).
- **시즈널 토끼 PNG 자산**: PR-3 placeholder ID 들의 실제 PNG.
- **BGM mp3 드롭인**: PR-13 의 bgm_day/night/rainy.mp3 자산 사용자 업로드.
- **AchievementsCard 진행 hint**: PR-38 의 `nextPassiveLabel` 활용 — "다음: 10마리 → 세션 당근 +5%".
- **GemTradeModal "전설 친구 만나기" disabled state UX**: 보석 50 미만 시 안내 카피 강화.

## F. 5-command (Round 7 최종)

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **130 / 130 pass** |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |
| DEV string DCE | 0 (prod 빌드에서 "모든 자원" / "시간대 강제" 모두 제거됨) |

Round 7 종료. 정합 깨끗, UX 개선 4건 + micro 보강 7건.
