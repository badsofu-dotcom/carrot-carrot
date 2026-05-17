# SETTINGS_INVENTORY.md — 내 정보 탭 전체 메뉴 + IA 재구성

Round 13 PR-101.

## A. Before (PR-69 ~ PR-100 기준)

| # | 그룹 | Emoji | Row | 사용 빈도 추정 |
| --- | --- | --- | --- | --- |
| 1 | 계정 | (없음) | 로그인 상태 / 토스 연결 또는 연결 끊기 (2-3 rows) | 1회/세션 |
| 2 | 집중 | ⏱ | TimerPreset / CustomSlot / AutoBreak (3 rows) | TimerPreset 자주 |
| 3 | 알림 & 소리 | 🔔 | NotifyMaster / Sfx / BGM (3 master) + AdvancedDisclosure (6 nested) | 마스터 자주 |
| 4 | 외관 | 🎨 | FarmBgAuto / DarkMode (2 rows) | 가끔 |
| 5 | 데이터 | 💾 | 캐시 / 온보딩 / 초기화 (3 rows) | 거의 없음 |
| 6 | 친구 초대 | 👥 | 내 코드 / 친구 코드 입력 (2 rows) | 1회 lifetime |
| 7 | 정보 | (없음) | 버전 / 크레딧 / 개발자 (3 rows) | 거의 없음 |
| - | DEV (DEV 모드만) | — | DevActionsGroup | 개발자 |

**Visible master row 수: 약 18 (계정 토스 connected 시).**

## B. After (PR-101 자율 IA)

| # | 그룹 | Emoji | Row | 결정 |
| --- | --- | --- | --- | --- |
| 1 | 집중 | 🎯 | TimerPreset 1 row | 가장 자주 → 위 |
| 2 | 알림 | 🔔 | NotifyMaster 1 row | 자주 |
| 3 | 소리 | 🔊 | Sfx / BGM (2 rows) | 자주 |
| 4 | 외관 | 🎨 | DarkMode 1 row | 가끔 |
| 5 | 친구 초대 | 👥 | 내 코드 / 친구 코드 입력 (2 rows) | 1회 lifetime, but 발견성 위해 visible |
| 6 | 계정 | 👤 | 로그인/로그아웃 2 rows | 위 사용 끝나면 마지막 |
| 7 | 고급 설정 | ⚙ | AdvancedDisclosure (펼침) | 거의 안 펼침 |

**Visible master row 수: 9** (1+1+2+1+2+2). 이전 ~18 → 50% 압축.

### 고급 설정 안의 내용 (펼침 시)

| 카테고리 | Row |
| --- | --- |
| 집중 세부 | CustomSlot 토글 / AutoBreak 토글 |
| 알림 세부 | 매일 22시 리마인더 / NotifyKind 4종 (drop/session/mission/treasure) / 집중 끝 알림 |
| 외관 세부 | 배경 자동 변경 |
| 데이터 | 캐시 비우기 / 온보딩 다시 보기 / 데이터 초기화 |
| 정보 | 버전 / 크레딧 / 개발자 |
| DEV (DEV 모드만) | DevActionsGroup |

총 고급 내부 row: ~13개. AdvancedDisclosure 펼침 시에만 노출.

## C. 자율 결정 사유

| 결정 | 이유 |
| --- | --- |
| 집중 → 위 | TimerPreset 가장 자주 변경 (사용자 학습 흐름 시작점) |
| CustomSlot / AutoBreak → 고급 | preset 선택 후엔 수정 빈도 낮음 |
| 알림 / 소리 분리 | spec 명시 + 별개 도메인 (알림 = 푸시, 소리 = 농장 effect) |
| FarmBgAuto → 고급 | 처음 1회 설정 후 거의 안 바꿈 |
| 친구 초대 visible 유지 | 발견성 (사용자가 무의식적으로 진입) |
| 계정 → 아래 | 1회 로그인 후 거의 접근 없음 |
| 데이터 / 정보 → 고급 | rare actions, 시각 정리 |
| DEV → 고급 (env gate 그대로) | prod 안 보임, DEV 환경에서만 |
| AdvancedDisclosure 단일 그룹 | 한 번에 모든 rare 항목 노출 — UX 자연스러움 |
| 8-row 목표 → 9 row | strict 8 보다 친구 초대 발견성 + 계정 명시 우선 |

## D. 구현 노트

기존 코드 minimal-diff 원칙:
- 모든 row component (TimerPresetRow / CustomSlotToggleRow 등) 보존
- SettingsPage JSX 트리만 재배치
- AdvancedDisclosure 를 inner (알림&소리) → top-level group 으로 승격
- 새 `🎯 집중` 그룹 (기존 ⏱ 변경) + 알림/소리 분리

기존 PR-69 의 SoundNotifyGroup 컴포넌트는 제거 (인라인으로 펼침).
