# ROUND 14 SUMMARY — 대청소 Round (검증 회귀 fix + 정합성 + 씨앗 폐기 + audit 후속)

Round 13 종료 (`a74916b`) → Round 14 종료 (`3a24aeb`). 12 PR.

## A. PR 1줄 요약

| PR | SHA | 요약 | 카테고리 |
| --- | --- | --- | --- |
| PR-104 | `f15ba16` | [P0] 미션 드롭다운 PAUSED 토글 회귀 fix (forceCollapsed PAUSED 제외) | P0 회귀 |
| PR-105 | `b05a324` | 캔디/황금 description P 환산 중심으로 단순화 | UX 정제 |
| PR-106 | `a49e3a9` | 다크 모드 heading 4 사이트 invisible fix (PR-84 후속) | A11y |
| PR-107 | `2667d4b` | 광고 칩 composite badge "🩷 N" + 하트 토큰 일관 | UX |
| PR-108 | `a9e14b8` | 리포트 이번주 막대 0 carrots label 미표시 | UX 정제 |
| PR-109 | `7cfaa48` | **씨앗 자원 완전 폐기** (28 파일, P 가치 ↑) | 큰 결정 |
| PR-110 | `fec9bb9` | accent-carrot small text contrast #FF7B61 → #c5462a (AA pass) | A11y |
| PR-111 | `155f708` | legacy MissionType 12종 완전 제거 (active 3종만) | Legacy 정리 |
| PR-112 | `7363dee` | FarmDropTable 단일 source refactor + 8 신규 tests | Refactor |
| PR-113 | `3498f12` | cap-reached 1회 toast + GemTrade earned audit (우회 없음) | UX |
| PR-114 | `3a24aeb` | ECONOMY_AUDIT 갱신 — PR-109 후 EV 영향 | docs |
| PR-115 | (this) | Round 14 통합 보고 | docs |

## B. 메트릭

| 항목 | 값 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **247 / 247 pass** (225 → 247, +22) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지 토큰 in dist-preview | **0** |
| `"/assets/farm"` literal | **0** |

### Test 증가

| PR | +tests | 누적 |
| --- | --- | --- |
| PR-104 missionToggle | 8 | 233 |
| PR-109 rewardTables/giftRoll/farmRules 재작성 | +4 net | 237 |
| PR-112 farmDropTable | 8 | 245 |
| PR-113 dailyCap cap-reached | 2 | 247 |

## C. 핵심 결정 (자율)

### C-1. P0 회귀 — PAUSED 토글 차단 정정 (PR-104)

PR-100 (Round 13) 의 `forceCollapsed = FOCUSING || PAUSED` 가 사용자 PAUSED 시 미션 카드 토글 차단. PAUSED 는 학습 흐름 중단 — 게임 interaction 자연. `forceCollapsed = FOCUSING` 만으로 정정. pure helper `missionToggle.ts` 추출 + 8 unit tests 로 회귀 차단.

### C-2. 씨앗 자원 완전 폐기 (PR-109)

사용자 결정: "씨앗 = 마찰만 추가, 학습 도구 톤 약화".

미배포 컨텍스트 활용 — 마이그레이션 / 환산 / 호환 코드 모두 X. 28 파일 정리:
- Data: farmStore.seeds / RemoteFarmState.seeds / ItemCode "seed" / RewardKind "seed" / FocusFarmReward.seedDelta / GiftReward "seed" 모두 제거
- UI: 헤더 자원바 4→3 chip / InventoryModal 자원 탭 13→12 item / 모종삽 chip badge 제거 / FarmDropLayer seed slot → candy
- 보상 흡수: 모든 0P seed reward → P-bearing candy 흡수 (EV 상승: daily gift 2.0→5.6 P)
- 게임 루프: plant 무한 (씨앗 가드 처음부터 없었음)
- Tests: 7 test 파일 갱신 + seed 잔여 0 검증

### C-3. legacy MissionType 12종 완전 제거 (PR-111)

PR-75 후 silent no-op 으로 유지되던 focus_25/50/night, ad_watch, bunny_new, golden/candy_harvest, drop_pickup, medal_unlock, perfect_combo, tool_use, friend_invite. 12 trigger 사이트 호출 + 4 unused import 제거. union 15→3종.

### C-4. accent-carrot small text contrast (PR-110)

`#FF7B61` (2.55:1) → `#c5462a` (4.84:1). InventoryModal grid count + DetailPanel "보유 N" + GemTradeModal "보유 N개" 3 사이트.

### C-5. FarmDropTable single source (PR-112)

PROB_AUDIT Round 14 후보 처리. FarmDropLayer 의 인라인 ~100줄 const → `lib/farm/farmDropTable.ts` 의 single SoT. 8 tests 추가.

### C-6. cap-reached 1회 toast (PR-113)

이전엔 RewardsPanel 열어야 인지. 첫 cap-cross 시 `CAP_REACHED_EVENT` 1회 dispatch (KST day 별), HomePage listener 가 toast.

## D. 자율 적용 (이외 발견)

1. **PR-105**: 캔디/황금 description 에서 확률/콤보/주스 cross-reference 제거 — 각 자원/버프 단위 책임 분리
2. **PR-106**: BunnyGachaModal "토끼 이름" h2 등 4 사이트 heading fixed dark color
3. **PR-107**: 광고 칩 aria-label/title/부족 토스트 모두 🩷 + "하트" 일관 사용
4. **PR-108**: 막대 baseline ratio 0.06 유지 (시각 자리), label 만 conditional
5. **PR-109**: seed reward EV 보존 분배 — daily gift 2.0→5.6P, friend invite 0→10P, drop seed→candy 등
6. **PR-110**: 색 변경 외 fontSize 12 → 더 안전 마진
7. **PR-111**: 4 unused useMissionsStore import 정리
8. **PR-112**: pickDrop 도 pure helper 로 추출 → testable
9. **PR-113**: KST day-별 flag (rollover 자동 reset) — 매일 첫 cross 만 1회

## E. 사용자 검증 포인트

1. 홈탭 timer IDLE → 미션 카드 ▼ 탭 → 펼침 ✓ (PR-104 회귀 fix)
2. 홈탭 timer FOCUSING → 미션 카드 강제 접힘 (이전 동일)
3. 홈탭 timer PAUSED → 미션 카드 토글 가능 (PR-104 신규)
4. 농장 상단 자원바 = 당근/캔디/황금 3개 (seed 없음)
5. 가방 → 자원 탭 → 4 item (당근/캔디/황금/코인) — seed 카드 없음
6. 모종삽 칩 → 무한 도구, badge 없음
7. 농장 드랍 → seed 절대 안 나옴 (candy 흡수)
8. 광고 칩 = "🩷 N" badge + 일관 표기
9. 다크 모드 → InventoryModal item name / BunnyGacha 토끼 이름 visible (heading)
10. 첫 cap 100P 도달 → 1회 toast "🌙 오늘 100 P 다 모았어요"
11. 리포트 이번주 막대 → 0 day 는 숫자 미표시
12. 캔디/황금 description = P 환산 중심 문장
13. 가방 → 그리드 cell 의 count 가 더 진한 오렌지 (#c5462a) + fontSize 12

## F. Round 15 후보

1. **Worker server-side dailyCap enforcement** — client tamper 방지 (이월)
2. **Worker `cloudflare/.../routes/farm.ts` seedDelta** body 처리 — deploy 전 정리 (PR-109 잔재)
3. **Worker `0004_seeds.sql`** 같은 migration — repo 정리
4. **친구 초대 modal 화** — Settings 의 FriendInviteGroup → modal (lifetime 1회 사용)
5. **InventoryModal safeAreaModal 통합** — PR-68 inline → PR-79 utility 마이그레이션 (Round 11 이월)
6. **`focus_night` legacy** vs SkyView `nightSessions` (medal trigger) audit
7. **TimerControls 4 button aria-label** (INTERACTION_AUDIT Round 14 후보)
8. **inviteStore PR-109 후 friend_invite 트리거 제거** 확인 (FriendInviteGroup 의 PR-52 mission trigger 도 함께 정리됨)

## G. 결론

Round 14 = **"대청소"**.

- P0 회귀 fix (PR-104) — Round 13 IA 변경의 PAUSED 부작용
- **씨앗 자원 완전 폐기** (PR-109, 28 파일) — 미배포 컨텍스트 활용한 가장 큰 정리
- legacy MissionType 12종 정리 (PR-111) — Round 9 부터 silent no-op 이던 dead types
- A11y contrast 3 fix (PR-106 dark heading / PR-110 small accent)
- UX 정제 4건 (PR-105 description / PR-107 광고 칩 / PR-108 막대 / PR-113 cap toast)
- Refactor 2건 (PR-112 FarmDropTable / 또 PR-114 audit docs)

학습 도구 톤 강화 + 시스템 정합성 완성도 ↑. Round 15 는 worker side (서버 정합성) + 잔여 cleanup.

모두 push 완료 — `origin/main` 최신 `3a24aeb` (이 보고서 commit 후 갱신).
