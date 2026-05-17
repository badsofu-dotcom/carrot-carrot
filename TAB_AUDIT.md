# TAB_AUDIT.md — 탭 별 발견 표

Round 13 PR-99. 4 탭 (홈 / 농장 / 리포트 / 내 정보) 별 시각 / 인터랙션 / 데이터 정확성 audit.

## 홈탭 (`/`)

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| 타이머 ring + 토끼 | ✅ | Phase 8.0-c 안정 |
| Preset chip (15/25/50) + 커스텀 ⚙ | ✅ | PR-69 settings 와 sync |
| TimerControls (play/pause/skip/reset) | ✅ | aria-label 검증 필요 (Round 14) |
| SoundChip | ✅ | SoundSheet trigger |
| DailyMissionsCard | ⚠ **IA 변경 후보 (PR-100)** | 집중 중 시야 차지 |
| WeeklyMissionsCard | ⚠ **IA 변경 후보 (PR-100)** | 同上 |
| 누적 carrot 통계 | ✅ | useTodayCarrots / useStreakDays |
| Toast viewport | ✅ | App.tsx 글로벌 mount |

## 농장탭 (`/collection`)

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| 9-plot 그리드 | ✅ | PLOT_POLYGONS 디자인 lock |
| 자원 칩 (carrot/candy/golden/seed) | ✅ | CurrencyChip |
| ToolDock 5 슬롯 | ✅ | PR-86/87/88 정제 완료 |
| 가방 칩 badge | ✅ (PR-86 aria 명확화) | 시각 자산 swap 은 Round 13+ |
| 광고 칩 badge | ✅ (PR-98 fix) | 분모 제거됨 |
| FarmDropLayer 드랍 | ✅ | 30/day cap |
| HiddenBunnyLayer (A) / Peek (B) | ✅ | 4/3 day cap |
| VisitorBunny | ✅ | 친구 방문 시 |
| RewardsPanel trigger (🎁) | ✅ | PR-82 TabBar lift |
| Atmosphere + SkyView | ✅ | KST 시간대 슬롯 |
| BunnyOnboardingModal | ✅ | onboarding flag |
| GemTradeModal (cc:gem-trade:open) | ✅ | PR-81 safeArea |
| BunnyGachaModal (cc:bunny-gacha:show) | ✅ | unlock celebration |

## 리포트탭 (`/report`)

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| 통계 카드 (당근/연속일/집중분) | ✅ | useCollectionStore SoT |
| 일일 history chart | ✅ | dailyHistory 60일 보존 |
| (별다른 인터랙션 없음) | ✅ | read-only 페이지 |

audit 결과 발견 없음. 깨끗한 정보 페이지.

## 내 정보탭 (`/me` 또는 `/settings`)

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| Profile card (LV / 닉네임) | ✅ | deriveProfileTier |
| 계정 섹션 (로그인/로그아웃) | ✅ | |
| 집중 섹션 (3 row) | ✅ | |
| 알림 & 소리 마스터 (3 row) | ✅ | PR-78 후 슬라이더 제거됨 |
| AdvancedDisclosure | ✅ | PR-69 안정 |
| 외관 (배경/다크) | ✅ | |
| 친구 초대 그룹 | ✅ | PR-62 |
| 데이터 섹션 | ⚠ placeholder | 캐시/초기화 미구현 안내만 |
| DevActionsGroup (DEV) | ✅ | import.meta.env.DEV gate |
| **그룹 구조** | ⚠ **IA 변경 후보 (PR-101)** | 14+ row → 8 row 압축 목표 |

## 발견 — 탭 별 micro-fix 후보

### 발견 1. 리포트탭 통계 표시 정확성

`ReportPage` 가 `useCollectionStore` 의 누적 데이터 사용. PR-90 의 일일 P 캡과 무관 (캡은 출금 시점에만 영향, 인벤토리는 전체 누적). audit 결과 누적값 표시는 정상.

### 발견 2. 농장탭 — 자원 칩 클릭 onClick 없음

`CurrencyChip` (4개: carrot/candy/golden/seed) 가 정보 표시만 — `onClick` 없음. 사용자가 칩을 클릭해도 동작 없음. 의도된 read-only.

→ ToolDock 의 가방 칩이 InventoryModal trigger 라 currency chip 은 일부러 passive. 의도 일치 ✅.

### 발견 3. 홈탭 미션 카드 — 집중 중 시야 차지

타이머 RUNNING 중 사용자 시야: 시간 ring + 토끼. 그 아래 DailyMissionsCard + WeeklyMissionsCard 의 3+3 = 6 행 미션 진행도 카드가 표시.

학습 도구 톤 위반: 집중 중에 게임 정보 시야 들어옴. **PR-100 IA 변경 적용**.

### 발견 4. 내 정보탭 — 그룹 압도감

14+ row + 5 섹션 + AdvancedDisclosure. user spec: "**섹션 구분 명확화 + 메뉴 최대한 압축**". **PR-101 IA 재구성 적용**.

## 결론

- 4 탭 모두 functional OK.
- 발견 micro-fix 0건 (PR-99 본 PR 에서 추가 fix 없음 — audit only).
- 발견 IA 변경 2건 → PR-100 (홈 미션) + PR-101 (내 정보 그룹).
