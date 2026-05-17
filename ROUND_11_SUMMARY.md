# ROUND 11 SUMMARY — Round 10 후속 fix (사용자 재검증)

Round 10 종료 (`91dbf31`) → Round 11 종료 (`cbbe79b`). 3 fix PR + 1 summary.

## A. PR 1줄 요약

| PR | SHA | 요약 |
| --- | --- | --- |
| PR-82 | `f91dff3` | RewardsPanel TabBar 위로 lift + safeAreaBackdropStyle 4면 safe-area |
| PR-83 | `6daf285` | PR-80 부분 revert — fixed-light bg 위 caption 은 fixed dark text (`#6a6055`) |
| PR-84 | `cbbe79b` | 모달/카드 heading 7 사이트 fixed `#2b2b2b` 명시 (dark mode invisible fix) |
| PR-85 | (this) | Round 11 통합 보고 |

## B. 메트릭

| 항목 | 값 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **188 / 188 pass** (182 → 188, +6) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지 토큰 in dist-preview | **0** |
| `"/assets/farm"` literal | **0** |

## C. 핵심 발견 — PR-80 의 부작용

Round 10 PR-80 (`#888` → `var(--text-tertiary, #888)`) 가 fixed-light bg (`#FFF8EE`) 위 사이트 8 개에서 dark mode contrast 를 **악화**:

| 모드 | Before (#888) | After (var token) |
| --- | --- | --- |
| light | 3.34:1 (acceptable) | **2.47:1** (악화) |
| dark | 3.34:1 (acceptable) | **2.27:1** (실패) |

`--text-tertiary` 는 theme-aware 토큰이지만 모달 bg 는 fixed light. 두 layer 가 양립 안 함.

**교훈 / 가이드라인 (PR-83 + PR-84 codified)**:
- **theme-aware bg** (`var(--bg-elevated)` 등) 위 → `var(--text-*)` token 사용
- **fixed light bg** (`#FFF8EE`, `#fff`) 위 → fixed dark text
  - heading: `#2b2b2b` (AAA 15.8:1)
  - caption: `#6a6055` (AA 5.8:1)
  - hint: `#666` (AA 5.7:1)
- **inherit color (color 미지정)** → ❌ 금지. body inherit 의존은 dark mode 에서 실패

## D. 자율 적용한 추가 (4건)

1. **safeAreaBackdropStyle 4면 safe-area 확장 (PR-82)** — 이전 좌/우만 → 4면 모두. AdRewardChannel / GemTrade 모달 모두 자동 혜택
2. **RewardsPanel TabBar lift (PR-82)** — PR-68 패턴 (InventoryModal) 동일 적용
3. **darkModeContrast.test 의 hex shorthand 지원 (PR-83)** — `#666` 같은 3-digit hex 도 검증 가능
4. **RewardsPanel 토스포인트 sub `#777` → `#6a6055` (PR-84)** — 4.51 → 5.8:1, 여유 마진

## E. 사용자 검증 포인트

1. **🎁 아이콘 (우측 상단) → RewardsPanel** — iPhone SE 375×667 에서 TabBar 가 컨텐츠 가리지 않음 (bottom 100+safearea 위로 lift)
2. **다크 모드 → 🎁 RewardsPanel 열기** — "보상함" 헤더, 토스포인트 P 값, "오늘의 선물 받기" / "보물상자 진행도" 모두 visible (이전엔 dark mode 시 invisible)
3. **다크 모드 → InventoryModal "내 가방" / GemTradeModal "💎 보석 사용" / AdRewardChannelModal "어떤 보상을 받을까요?"** — 모두 헤더 visible
4. **다크 모드 → 일일 / 주간 미션 카드** — 진행도 텍스트 `N/M · +XP` 가 가독성 통과 (이전 2.27:1 → 5.8:1)
5. **다크 모드 → 광고 채널 ChannelRow** — "물뿌리개 +3" / "오늘의 선물상자" 라벨이 visible (이전 inherit 으로 invisible)

## F. Round 12 후보

1. **light mode contrast 도 audit** — Round 10 PR-80 / 11 PR-83 둘 다 dark 만 중심. light mode 의 `--text-tertiary: #a99c87` 가 fixed `#FFF8EE` 위 contrast 2.47:1 — 동일 가이드라인 적용 검토
2. **모든 fixed-light bg 모달 자동 audit** — 신규 모달 추가 시 contrast 검사 강제 (lint rule? jest-axe?)
3. **`color` 누락 lint** — heading 텍스트가 color 미지정인 경우 자동 경고 (정적 분석)
4. **AdRewardChannelModal 의 다른 모달 import 영향 확인** — safeAreaBackdrop 변경이 BunnyGachaModal 등 import 외 모달에 영향 있는지
5. **legacy MissionType 정리** — Round 10 의 Round 11 후보 그대로 이월
6. **InventoryModal safeAreaModal 마이그레이션** — PR-68 의 inline style 을 PR-79 의 safeAreaModalStyle 으로 통일

## G. 결론

Round 11 = **"Round 10 fix 의 fix"**.

- Round 10 의 PR-80 이 의도와 반대 방향으로 contrast 를 악화시킨 사이트들을 PR-83 에서 revert
- PR-84 가 PR-80 이 놓친 heading inheritance 문제 추가 fix
- PR-82 가 RewardsPanel (PR-79 가 다루지 않은 보상함 모달) 의 TabBar 충돌 fix

학습된 패턴: fixed-bg modal 의 contrast 는 theme-aware token 으로 해결 불가. fixed text color 명시가 정답. 신규 모달 작업 시 적용할 가이드라인 codified.

모두 push 완료 — `origin/main` 최신 `cbbe79b` (이 보고서 commit 후 갱신).
