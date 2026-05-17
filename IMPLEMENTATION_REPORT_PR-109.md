# IMPLEMENTATION_REPORT_PR-109.md — 씨앗 자원 폐기 (대형 — 미배포 컨텍스트)

## 결정 (사용자 위임)

**씨앗 = 마찰만 추가, 학습 도구 톤 약화 → 완전 폐기**.

미배포 컨텍스트 활용 — 마이그레이션 / 환산 / 호환 코드 모두 X. 깔끔 제거.

## 변경 매트릭스

### A. 데이터 / Store

| 파일 | 변경 |
| --- | --- |
| `farmStore.ts` | `seeds` 필드 제거 / `growAllPlanted` 3rd arg `seedDelta` 제거 |
| `farmSync.ts` | `RemoteFarmState.seeds` 제거 / `growOnServer` seedDelta body 제거 |
| `itemsStore.ts` | `ItemCode` union 에서 `seed` 제거 / ITEMS 배열에서 seed entry 제거 / `SEED_ICON_REL` export 제거 |
| `rewardTables.ts` | `RewardKind` 에서 `seed` 제거 / DAILY_GIFT_TABLE seed entries → candy 흡수 / WEEKLY_TREASURE_TABLE seed entry → carrot 흡수 |
| `giftRoll.ts` | `GiftReward` 에서 `seed` 제거 / rollGift seed branch → candy 흡수 |
| `farmRules.ts` | `FocusFarmReward.seedDelta` 제거 / message 에서 "씨앗" 단어 제거 |

### B. UI

| 파일 | 변경 |
| --- | --- |
| `CollectionPage.tsx` | 헤더 seed CurrencyChip 제거 (당근/캔디/황금 3개) / aria-label 갱신 |
| `InventoryModal.tsx` | `seeds` selector 제거 / liveResourceCount seed case 제거 / 푸터 chip 합계에서 seed 제거 / 케이크 toast 갱신 |
| `RewardsPanel.tsx` | `seeds` selector 제거 / 토스P sub 에서 🌱 제거 / treasureToText/giftToText seed case 제거 / 일일선물 seed grant 분기 제거 |
| `ToolDock.tsx` | shovel seed badge 제거 / shovel aria 단순화 / useFarmStore import 제거 |
| `FarmDropLayer.tsx` | DropKind 에서 seed 제거 / DROPS 의 seed entry → candy / grant switch 의 seed → candy / SEED_ICON_REL import 제거 / growAllPlanted import 제거 |
| `GemTradeModal.tsx` | seeds9 option → candy3 (5 gem → 캔디당근 3개 = +15P) / incCandy 추가 |
| `AdRewardChannelModal.tsx` | "🌱 씨앗 +3" 보물 진행 채널 → 캔디당근 0.25 흡수 / hint 갱신 |
| `FriendInviteGroup.tsx` | toast "씨앗 +10" → "캔디당근 +2" |
| `inviteStore.ts` | 가입자 보상 씨앗 +10 → 캔디당근 +2 (+10P, P 가치 유지) |
| `DevActionsGroup.tsx` | handleSeed50 + UI row 제거 / handleAllResources999 의 seed 분기 제거 |

### C. 메타데이터 / 카피

| 파일 | 변경 |
| --- | --- |
| `buffEffects.ts` | cake description "씨앗 +1 / 모든 보상 1.5배" → "작물 성장 1.5배" |
| `itemMeta.ts` | seed entry 제거 / cake / gem longDescription 에서 "씨앗" 단어 제거 |
| `sourceLabels.ts` | "gem 5→9" 토큰 → "gem 5→3" (보석 → 캔디당근) |
| `reward-disclosure.md` | 일일 선물 EV 2.0 → 5.6 / 주간 보물 seed entry → carrot |

### D. 핵심 게임 루프 (변경 없음)

- **plant**: 빈 밭 클릭 → 무조건 심기 (씨앗 가드 처음부터 없었음 — Phase 1 inforational 만이었음, PR-87)
- **water / harvest**: 변경 없음

## 보상 교환 비율 (자율 결정)

| 이전 | 후 | P 가치 |
| --- | --- | --- |
| 씨앗 +1 (일일 60%) | 캔디 +1 | 0 → 5 P |
| 씨앗 +3 (일일 6%) | 캔디 +2 | 0 → 10 P |
| 씨앗 +3 (보물 15%) | 당근 +5 합산 (35%) | 0 → 5 P |
| 씨앗 +3 (보석 거래 5 gem) | 캔디 +3 | 0 → 15 P |
| 씨앗 +10 (친구 초대) | 캔디 +2 | 0 → 10 P |
| 씨앗 +1 (농장 드랍 4 weight) | 캔디 +1 | 0 → 5 P |
| 씨앗 +3 (광고 보물 0.15) | 캔디 +1 (0.25 합산) | 0 → 5 P |
| seedDelta (focus tier 1~3) | (제거 — growSteps 만) | — |

→ 모든 seed reward → candy 흡수 / 또는 단순 제거 (focus tier seedDelta).
→ 사용자 가치 향상 (0 P 자원 → P-bearing 자원). 일일 캡 (100P, PR-90) 안에서 안전.

## 테스트 갱신

| Test 파일 | 변경 |
| --- | --- |
| `farmRules.test.mjs` | seedDelta 검증 제거 / "씨앗" 단어 잔여 0 검증 추가 |
| `rewardTables.test.mjs` | EV 2.0 → 5.6 / WEEKLY 7.0 → 7.75 / seed kind 없음 검증 |
| `giftRoll.test.mjs` | seed kind branch tests → candy 로 재작성 / Monte-Carlo 비율 갱신 |
| `sourceLabels.test.mjs` | gem 5→9 → gem 5→3 / 결과 문자열 갱신 |
| `itemsStoreCopy.test.mjs` | 13개 → 12개 item |

총 **237 / 237 pass** (PR-104 후 233 → +4 신규 / 갱신).

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 237 / 237 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## 잔여 "씨앗" / "seed" 검증

| 위치 | 내용 | 상태 |
| --- | --- | --- |
| 코드 comment | "PR-109 씨앗 자원 폐기" 등 | ✅ 의도적 (변경 이력) |
| ToolDock label "모종삽" | PR-87 의 "씨앗 심기 의미" → comment 만 | ✅ 의도적 |
| Settings sfx description | "씨앗 · 물뿌리개 · 바구니 탭 사운드" | ✅ 효과음 카테고리 라벨, 자원 아님 |
| 자루 칩 comment "씨앗 자루" | PR-86 의 사용자 오해 documentation | ✅ 의도적 |

사용자 노출 "씨앗" 단어: **0건** (코드 comment 만).

## Round 14 후속 후보

- worker `cloudflare/.../routes/farm.ts` 의 seedDelta body 처리 (deploy 안 됐지만 deploy 전 정리 필요)
- worker DB schema migration `0004_seeds.sql` 같은 게 있다면 제거 (별도 worker repo 변경)
