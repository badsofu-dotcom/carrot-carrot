# IMPLEMENTATION_REPORT_PR-69.md — SettingsPage UX 단순화

Progressive disclosure 패턴 (Apple/Notion 스타일). 14개 토글 → 4 마스터 + 6 disclosure.

## A. 섹션 구조 before / after

| 섹션 | 이전 (Round 8) | PR-69 |
| --- | --- | --- |
| 계정 | 로그인 / 로그아웃 | 그대로 |
| 집중 | TimerPreset / CustomSlot / AutoBreak | 그대로 + emoji `⏱` |
| 알림 (= 알림 & 소리) | 11 rows 평면 | 4 master + disclosure 6 + emoji `🔔` |
| 외관 | FarmBgAuto / DarkMode | 그대로 + emoji `🎨` |
| 친구 초대 | 2 rows | 그대로 (sub 단축) + emoji `👥` |
| 데이터 | 캐시 / 온보딩 / 초기화 | 그대로 + emoji `💾` |

## B. 알림 & 소리 통합 — 4 master + disclosure 6

### Master (always visible)
1. 🔔 알림 받기 — counter sub `· N개 활성`
2. 효과음 + 효과음 볼륨 슬라이더 (같은 카드)
3. 농장 BGM + BGM 볼륨 슬라이더 (같은 카드)
4. 진동 — extracted from old `handleHapticToggle` 내부 → 자체 `HapticToggleRow` 컴포넌트

### Advanced disclosure (default collapsed, safeStorage `cc.settings.advanced.open.v1` 영속)
1. 매일 22시 리마인더 (Toss push, `PushReminderRow`)
2. 농장 드랍 (NotifyKind drop)
3. 집중 완료 (NotifyKind session)
4. 오늘의 목표 (NotifyKind mission)
5. 주간 보물상자 (NotifyKind treasure)
6. 집중 끝났을 때 깨워줘 (`EndAlertRow`)

마스터(`알림 받기`) OFF → NotifyKind 4종 자동 disabled (기존 PR-61 동작 유지). PushReminder / EndAlert 는 별도 API surfaces 라 independent.

## C. 부제 단축 매트릭스

| Row | Before | After |
| --- | --- | --- |
| 효과음 | "씨앗·물뿌리개·바구니 탭 사운드 — 마스터 볼륨에 곱해져 재생" | "씨앗 · 물뿌리개 · 바구니 탭 사운드" |
| 농장 BGM | "하늘 슬롯 (낮/밤/비/눈) 에 따라 자동 트랙. mp3 없으면 무음." | "하늘에 맞춰 자동 재생" |
| 알림 받기 (denied) | "권한 거부 — in-app 배너 fallback" | "권한 거부 — 앱 안에서 보여줌" |
| 알림 받기 (default) | "탭하면 권한 요청 (native 거부 시 in-app 배너 fallback)" | "탭하면 권한 요청" |
| 배경 자동 변경 | "아침·낮·저녁·밤에 따라 농장 배경이 자동으로 바뀝니다" | "아침 · 낮 · 저녁 · 밤 자동" |
| 농장 드랍 (NotifyKind) | "아이템이 떨어졌을 때 알림" | "아이템이 떨어졌을 때" |
| 집중 완료 (NotifyKind) | "25분 / 50분 세션 끝났을 때" | "25분 / 50분 완료" |
| 오늘의 목표 (NotifyKind) | "미션 클리어 / 미완료 안내" | "미션 안내" |
| 매일 22시 리마인더 | `"${PUSH_REMINDER_TEXT}" · ${snap.hint}` | `"${PUSH_REMINDER_TEXT}"` (hint 제거) |
| 집중 끝났을 때 깨워줘 | "타이머 종료 알림 — 토스 안에서만 동작" | "타이머 종료 알림 — 토스 안에서만" |
| 진동 | "당근 잡으면 진동" (label) | "진동" + sub "당근 잡을 때 진동" |
| 내 초대 코드 sub | "친구에게 공유 → 양쪽 보상 (백엔드 wire 후 양방향)" | "친구에게 공유" |
| 친구 코드 입력 sub | "씨앗 +10, 보석 +5 (1회 한정)" | "보상 받기 (1회)" |

## D. 새 컴포넌트

| 컴포넌트 | 역할 |
| --- | --- |
| `SoundNotifyGroup` | 알림 & 소리 통합 섹션 root |
| `AdvancedDisclosure` | 접힘 트리거 + AnimatePresence height 애니메이션 + 영속 |
| `PushReminderRow` | 분리된 Toss push 토글 (이전 PushSettingsGroup 내부 inline) |
| `EndAlertRow` | 분리된 timer end alert 토글 |
| `HapticToggleRow` | 분리된 햅틱 토글 (이전 PushSettingsGroup 내부 inline) |

기존 `PushSettingsGroup` 함수 제거 (3개 row 가 각자 컴포넌트로 추출됨).

## E. 사용자 행동 가설

- **90 %** — 마스터 4개만 사용 (알림 ON, 효과음 ON 볼륨 70, BGM ON 볼륨 50, 진동 ON). 고급 설정 한 번도 안 펼침.
- **8 %** — 한 번 펼쳐서 "주간 보물상자만 꺼두기" 같은 fine-grained 조정 후 다시 닫음.
- **2 %** — 펼친 상태로 두고 모든 토글 직접 관리.

`ADVANCED_OPEN_KEY` 영속이라 2 % 사용자는 다음 방문에도 펼쳐진 상태 유지.

## F. 변경 파일

- `src/pages/SettingsPage.tsx` (대규모 — SoundNotifyGroup, AdvancedDisclosure, PushReminderRow, EndAlertRow, HapticToggleRow 신규 + PushSettingsGroup 제거 + emoji prefix 4 그룹 + sub 단축 5개)
- `src/features/friends/FriendInviteGroup.tsx` (emoji prefix + sub 2 단축)

## G. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130 / 130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
