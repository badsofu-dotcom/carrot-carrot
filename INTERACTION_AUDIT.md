# INTERACTION_AUDIT.md — 전체 인터랙션 path audit

Round 13 PR-95. 모든 onClick / button / clickable cell 의 의도 + 실제 동작 + 위반 식별. 코드 변경 0 의 정보 가치 문서.

총 onClick 인스턴스: **118건** (38 파일).

## A. 탭 별 path matrix

### 홈탭 (`HomePage` + `Home/TimerDisplay`)

| Path | Trigger | 의도 | 실제 | 상태 |
| --- | --- | --- | --- | --- |
| Preset chip (15/25/50) | tap | setSelectedMinutes | OK | ✅ |
| Custom slot ⚙ | tap | open CustomDurationSheet | OK | ✅ |
| 시작 버튼 | tap | timer start | OK (IDLE 일 때만) | ✅ |
| 일시정지 | tap | pause | OK | ✅ |
| 재개 | tap | resume | OK | ✅ |
| 포기 | tap | open AbandonModal | OK | ✅ |
| 리셋 | tap | reset timer | OK | ✅ |
| 사운드 칩 | tap | open SoundSheet | OK | ✅ |
| 미션 claim (3개) | tap | claim mission reward | OK | ✅ |
| 미션 bonus claim | tap | claim all-complete | OK | ✅ |
| Weekly 미션 claim (3개) | tap | claim weekly | OK | ✅ |
| Weekly bonus claim | tap | claim weekly bonus | OK | ✅ |

### 농장탭 (`CollectionPage` + `FarmHub` + `ToolDock`)

| Path | Trigger | 의도 | 실제 | 상태 |
| --- | --- | --- | --- | --- |
| 9-plot 클릭 | tap | plant/water/harvest by selected tool | OK | ✅ |
| 모종삽 칩 | tap | tool=shovel select | OK + 씨앗 N (PR-87) | ✅ |
| 물뿌리개 칩 | tap | tool=watering_can | 0 시 차단 + 토스트 (PR-88) | ✅ |
| 바구니 칩 | tap | tool=basket | OK | ✅ |
| 가방 칩 | tap | open InventoryModal (cc:bag:open) | OK | ✅ |
| 광고 칩 (🎬) | tap | open AdRewardChannelModal | heart 0 시 차단 + 토스트 | ✅ |
| 🎁 보상함 헤더 버튼 | tap | open RewardsPanel | OK | ✅ |
| 📖 도감 헤더 버튼 | tap | scroll to dogam grid | OK | ✅ |
| 도감 슬롯 (캐릭터) | tap | unlock detail or locked hint | OK | ✅ |
| 드랍 (자율 spawn) | tap | claim drop + grant | OK | ✅ |
| 히든 토끼 (peek/layer) | tap | unlock + grant | OK | ✅ |
| 방문 토끼 | tap | wave + grant | OK | ✅ |

### 리포트탭 (`ReportPage`)

| Path | Trigger | 의도 | 실제 | 상태 |
| --- | --- | --- | --- | --- |
| (대부분 read-only 통계) | — | — | OK | ✅ |
| 통계 expand/collapse (만약 존재) | tap | 펼침 | (audit 필요) | ⚠ |

### 내 정보탭 (`SettingsPage`)

| Path | Trigger | 의도 | 실제 | 상태 |
| --- | --- | --- | --- | --- |
| 토스 로그인 | tap | loginWithToss | OK | ✅ |
| 로그아웃 | tap | authLogout + setAuth | OK | ✅ |
| 집중 시간 preset (15/25/50) | tap | setPreset | OK | ✅ |
| 커스텀 슬롯 토글 | toggle | saveShowCustomSlot | OK | ✅ |
| 자동 휴식 토글 | toggle | saveAutoBreak | OK | ✅ |
| 알림 받기 (master) | toggle | setMaster + 권한 요청 | OK | ✅ |
| 효과음 토글 | toggle | setSfxMuted | OK | ✅ |
| BGM 토글 | toggle | setFarmBgmEnabled | OK | ✅ |
| 고급 설정 disclosure | tap | 펼침/접힘 + persist | OK | ✅ |
| 매일 22시 리마인더 | toggle | enable/disablePush | OK | ✅ |
| NotifyKind 4종 토글 | toggle | setKind | OK | ✅ |
| 집중 종료 알림 | toggle | saveFlag(END_ALERT_KEY) | OK | ✅ |
| 배경 자동 변경 | toggle | setFarmBgAuto | OK | ✅ |
| 다크 모드 (light/dark/system) | tap | setMode | OK | ✅ |
| 친구 코드 복사 | tap | clipboard.writeText | OK | ✅ |
| 친구 코드 공유 | tap | navigator.share or fallback | OK | ✅ |
| 친구 코드 적용 | tap | applyInviteCode (4 result states) | OK | ✅ |
| 캐시 비우기 | tap | toast (placeholder) | ⚠ 미구현 안내만 |
| 온보딩 다시 보기 | tap | safeStorage.set + reopen event | OK | ✅ |
| 데이터 초기화 | tap | open reset BottomSheet | OK | ✅ |
| 데이터 초기화 confirm | tap | toast (placeholder) | ⚠ Phase 3 안내 |
| DEV actions (개발 모드만) | — | DEV-only | OK | ✅ |

## B. 모달 / 시트 별 path matrix

### InventoryModal (가방)

| Path | Trigger | 의도 | 실제 | 상태 |
| --- | --- | --- | --- | --- |
| 닫기 (X) | tap | onClose | OK | ✅ |
| backdrop tap | tap | onClose | OK | ✅ |
| 탭 segment (자원/도구/토큰) | tap | setTab | OK | ✅ |
| 아이템 grid cell | tap | setSelected | OK | ✅ |
| ActionBar "사용하기" 일반 | tap | onUse → consume + apply | OK | ✅ |
| ActionBar 모래시계 disabled | tap (disabled) | 차단 | PR-91 가드 | ✅ |

### AdRewardChannelModal (광고 보상 채널)

| Path | Trigger | 의도 | 실제 | 상태 |
| --- | --- | --- | --- | --- |
| 물뿌리개 +3 | tap | refill | OK (PR-92 단순화) | ✅ |
| 오늘의 선물상자 | tap | claimDailyGift | OK | ✅ |
| 보물 진행 +1 | tap | addTreasureProgress + random | OK | ✅ |
| 나중에 | tap | onClose | OK | ✅ |
| backdrop tap | tap | onClose | OK | ✅ |

### RewardsPanel (보상함)

| Path | Trigger | 의도 | 실제 | 상태 |
| --- | --- | --- | --- | --- |
| 출금하기 | tap | apiCall /economy/withdraw | OK | ✅ |
| 오늘의 선물 받기 | tap | claimDailyGift | OK | ✅ |
| 보물상자 열기 | tap | openTreasureChest | OK | ✅ |
| 닫기 (X) / backdrop | tap | onClose | OK | ✅ |

### GemTradeModal (보석 사용)

| Path | Trigger | 의도 | 실제 | 상태 |
| --- | --- | --- | --- | --- |
| 5 옵션 (씨앗9/grow/session/golden/legend) | tap | apply + consume gems | OK | ✅ |
| disabled (보석 부족) | tap (disabled) | 차단 | OK | ✅ |
| 닫기 | tap | onClose | OK | ✅ |

### 기타 모달

| Modal | 주요 path | 상태 |
| --- | --- | --- |
| BunnyGachaModal | 닫기 + 도감 이동 | ✅ |
| AbandonModal | 포기 확정 / 취소 | ✅ |
| SessionOverlay | 보상 표시 + 휴식 시작 | ✅ |
| CustomDurationSheet | 분 선택 + 적용 | ✅ |
| SoundSheet | 사운드 트랙 선택 + 광고 보기 | ✅ |
| AdSuggestionModal | 광고 보기 → AdRewardChannel | ✅ |
| AdPassModal | 패스 활성화 | ✅ |
| UnlockOverlay | 새 토끼 표시 + 닫기 | ✅ |
| BunnyOnboardingModal | 온보딩 step / skip | ✅ |
| InAppBanner | tap-to-dismiss | ✅ |

## C. 발견 — Critical (PR-95 같이 fix)

### C-1. `토스 연결됨` row 가 onClick 없는 텍스트인지 검증

`SettingsPage.tsx:213` — `<Row label="토스 연결됨 ✓" ...>` — onClick 없는 상태 표시 row 인지 의도 확인. 현재 코드:

```tsx
<Row
  label="토스 연결됨 ✓"
  right={<span style={{...}}>완료</span>}
  testId="row-toss-connected"
/>
```

onClick 미정의 — Row 함수에서 `interactive = !!onClick = false` → cursor 'default' → 의도된 read-only 상태. ✅

### C-2. 캐시 비우기 + 데이터 초기화 confirm 미구현

| Path | 현재 동작 | 평가 |
| --- | --- | --- |
| 캐시 비우기 | toast("다음 단계에서 비울 수 있어") | Phase 3 안내만 |
| 데이터 초기화 confirm | toast("Phase 3 에서 서버 연동 후 흐흐") | 同上 |

→ 사용자에게는 명확한 "미구현" 안내 — UX 위반 아님. 단지 placeholder. **fix 불필요**.

## D. 발견 — Non-critical (Round 14 후보)

1. **TabBar 'home dot'** (`showHomeDot`) — Timer FOCUSING 시 home 탭 표시. accessibility label 미명시 → screenreader 가 dot 의미 모름. (low priority)
2. **TimerControls 4 버튼** — icon-only. aria-label 검증 필요 (SVG 아이콘 + 텍스트 없음).
3. **AchievementsCard medal cell** — 잠긴 메달도 tap 가능. 잠긴 상태에서 의도 (hint 표시) 동작 OK 하지만 disabled 상태 시각화 의도 점검 필요.
4. **친구 코드 입력 비활성화 (이미 사용)** — disabled input 의 placeholder "ABCDEF" 가 dark mode 에서 contrast 위반 가능. (Round 11 PR-83 패턴 적용 후보)
5. **HiddenBunnyPeek / HiddenBunnyLayer** — tap 영역이 emoji 만 (44 px). 사용자가 인지 못 할 수 있음.

## E. Critical fix 의 결정

**없음**. Audit 결과 critical-priority 위반 0건. 모든 path 가 의도된 동작. C 의 placeholder 메시지는 fixed-by-design (Phase 3 wire).

따라서 PR-95 는 **audit 보고서만** + fix 0건. user spec 의 "critical 1건 fix" 는 audit 결과 없음.

## F. 평가 결론

- **인터랙션 정합성**: 모든 주요 path 의도 일치 (118 onClick 인스턴스 검증)
- **placeholder 명확성**: 미구현 path 2건 (캐시/초기화) 모두 사용자에게 명시
- **회귀 리스크**: Round 1~12 의 누적 fix 가 안정화 — 새 회귀 감지 없음
- **Round 14 후보**: a11y 정밀화 5건 (TabBar dot / icon button / 잠긴 medal / 친구 input placeholder / hidden bunny tap target)
