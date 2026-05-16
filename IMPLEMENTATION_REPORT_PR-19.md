# IMPLEMENTATION_REPORT_PR-19.md — DEV 패널 대확장 + DCE 보장

기존 4 액션 (테스트 성공 / 레전더리 미리보기 / 도감 전부 / WIPE) 에 14 신규 cheat 추가. 별도 파일로 분리해 production 빌드에서 dead-code-eliminate.

## A. 구조 변경

- **신규**: `src/features/dev/DevActionsGroup.tsx` — 18 행 (legacy 4 + 신규 14) + `DevRow` 헬퍼 컴포넌트.
- **수정**: `src/pages/SettingsPage.tsx`:
  - 기존 inline `DevActionsGroup` 함수 86 라인 삭제 → 한 줄 import.
  - 조건부 렌더링을 `isDev()` 함수 호출에서 `import.meta.env.DEV || VITE_TIMER_DEBUG === "true"` 인라인 literal 식으로 교체 → Vite 가 `false &&` 로 정적 fold → tree-shake.
  - `isDev` 함수 정의 삭제, `useCollectionStore` / `CHARACTERS` / `UnlockOverlay` import 삭제 (이제 DevActionsGroup 안에서만 사용).
- **수정**: `src/lib/farmBackground.ts` — 신규 `FARM_FORCE_SLOT_KEY` + `isValidSlot()` + `PickFarmBackgroundOpts.forceSlot`. picker 가장 위에서 forceSlot 우선.
- **수정**: `src/features/collection/farmStore.ts` — `incCarrots(n)` 액션은 이미 PR-17b 에 있음 (PR-19 cheat 가 그대로 사용).
- **수정**: `src/features/collection/rewardsStore.ts` — `resetDailyGiftClaim()` 액션 추가 (DEV "오늘의 선물 다시 받기").
- **수정**: `src/features/collection/FarmHub.tsx` — `readSlotOpts()` helper 가 `FARM_BG_AUTO_KEY` + `FARM_FORCE_SLOT_KEY` 둘 다 읽음. `cc:dev:forceSlot` CustomEvent listener — DEV 가 슬롯 변경 시 즉시 재추첨 (5분 poll 안 기다림).

## B. 14 신규 액션

| # | 라벨 | 동작 |
| --- | --- | --- |
| 1 | 모든 자원 +999 | 당근/캔디/황금 +999, seeds +999 (growAllPlanted side-door), star/gem +999 |
| 2 | 당근 +100 | `incCarrots(100)` |
| 3 | 캔디 +10 | `incCandyCarrots(10)` |
| 4 | 황금 +10 | `incGoldenCarrots(10)` |
| 5 | 씨앗 +50 | `growAllPlanted(0, null, 50)` |
| 6 | 별·보석 +20 | `itemsStore.add("star", 20)` + `add("gem", 20)` |
| 7 | 도구 아이템 충전 | hourglass/bolt/juice/soup/cake 각 +9, 물뿌리개 max |
| 8 | BGM·SFX 일괄 토글 | farmBgmEnabled flip + sfxMuted flip |
| 9 | 광고 보상 즉시 트리거 | refillFromAd + claimDailyGift + addTreasureProgress(1) |
| 10 | 주간 보물 진행 +7 | `addTreasureProgress(7)` 일거 max |
| 11 | 버프 일괄 활성 | `buffsStore.activate("juice/soup/cake")` |
| 12 | 메달 전부 unlock | `unlockMedal` × 11 IDs |
| 13 | 오늘의 선물 다시 받기 | `resetDailyGiftClaim()` |
| 14 | 시간대 강제 사이클 | auto → day → evening → night → rainy → snowy → auto. 즉시 재추첨 dispatch. |

## C. Dead-code elimination 검증

production 빌드 (`npm run build`) + 프리뷰 빌드 (`npm run build:preview`) 산출물에 대해:

```
$ grep -rln "모든 자원" dist/         → 0
$ grep -rln "모든 자원" dist-preview/ → 0
$ grep -rln "시간대 강제" dist/       → 0
```

→ **DevActionsGroup 모듈 전체 tree-shake 확인**. 사용자 spec "프로덕션 빌드에선 dead-code-eliminate 되도록" 충족.

원리:
- Vite 가 `import.meta.env.DEV` 를 production 빌드 시 literal `false` 로 치환.
- `false || (something === "true")` 도 production 환경변수 미설정 시 → `false || false` → `false`.
- esbuild minifier 가 `false && <DevActionsGroup />` 를 dead branch elimination.
- DevActionsGroup import 가 unreferenced → Rollup tree-shake.

VITE_TIMER_DEBUG=true 로 prod 빌드 시 DEV 노출 유지 — 사용자 spec 의 "또는 VITE_TIMER_DEBUG" 조건 보존.

## D. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **93/93 pass** (영향 없음) |
| `npm run typecheck` | clean |
| `npm run build` | OK + DCE 검증 |
| `npm run build:preview` | OK + DCE 검증 |
| 금지토큰 7종 | 각 0 |

## E. Maintainer 후속 조치

없음. DB 마이그/시크릿/wrangler 불필요. 모든 cheat 가 zustand store 의 public action 만 호출 — 백도어 없음.

## F. PR-18~22 자율 모드 종료

- PR-18 ffd5de9 (basket/bag 축소)
- PR-21 43837ef (톱니바퀴 제거)
- PR-22 1b5f092 (RewardsPanel 스크롤)
- PR-20 02f222f (seed 헤더 chip)
- PR-19 (본 PR) — DEV 패널 확장 + DCE

남은 hard-stop: ad-token verification (시크릿), 시즈널 토끼 PNG, BGM mp3 drop-in.
