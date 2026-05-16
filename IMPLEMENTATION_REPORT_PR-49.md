# IMPLEMENTATION_REPORT_PR-49.md — 메달/트로피/훈장 11종 시스템

11종 메달 정의 + tier-별 정렬 + lock state UI + 야간 세션 카운터 + Legend 패시브 통합.

## A. 신규 — `medalsConfig.ts`

11 메달 `MedalDef` 정의 (id / displayName / description / iconRel / tier / category / unlockHint).

| Tier | id | 표시 이름 | iconRel |
| --- | --- | --- | --- |
| 🥉 bronze | first_session | 첫 호흡 | medal-first-breath.png |
| 🥉 bronze | first_harvest | 첫 수확 | medal-first-harvest.png |
| 🥉 bronze | five_carrots | 새싹 농부 | medal-sprout-farmer.png |
| 🥈 silver | perfect_combo | 완벽주의자 | medal-perfectionist.png |
| 🥈 silver | first_candy | 달콤한 발견 | medal-sweet-find.png |
| 🥈 silver | dogam_25 | 호기심쟁이 | ribbon-curious.png |
| 🥈 silver | dogam_50 | 친구들의 친구 | ribbon-friend-of-friends.png |
| 🥈 silver | quiet_sky | 밤의 숲지기 | ribbon-night-keeper.png |
| 🥇 gold | first_golden | 황금의 손 | medal-golden-hand.png |
| 🥇 gold | dogam_75 | 마을 영웅 | trophy-village-hero.png |
| 🥇 gold | dogam_100 | 전설의 수집가 | trophy-legend.png |

`MedalId` enum 자체는 `rewardsStore` 가 SoT (기존 unlock 트리거 호환). medalsConfig 는 display 레이어.

helpers:
- `SORTED_MEDALS` — bronze → silver → gold 사전 정렬.
- `MEDAL_BY_ID` — O(1) lookup.
- `tierCounts()` — 3/5/3 검증용.
- `tierFallbackAsset(tier)` — 사용자 PNG 미존재 시 medal_bronze/silver/gold 폴백.

## B. AchievementsCard 리팩토링

- hardcoded `ALL_ACHIEVEMENT_MEDALS` + `medalAsset()` 함수 → `SORTED_MEDALS` import.
- `MedalIcon` 신규 — useState 로 onError fallback 처리 (사용자 자산 미존재 시 tier 폴백 자동 적용).
- 셀 클릭 → `selected` state → 하단 상세 패널 (tier 표시 + description + 미달성 시 획득 방법).
- 잠금 상태: 🔒 emoji 우상단 + grayscale + 0.45 opacity.

## C. rewardsStore 확장

- `nightSessions: number` 신규 field (safeStorage `cc.rewards.nightSessions.v1`).
- `bumpNightSession()` — +1 후 누적값 반환. quiet_sky 임계 7 일 때 caller (HomePage) 가 unlockMedal.
- `unlockAllMedals(): number` — DEV cheat 용. 신규 unlock 개수 반환, 모든 신규 ID 에 대해 `cc:medal:unlocked` 이벤트 dispatch (SFX 트리거 호환).

## D. HomePage 트리거 wiring

`lastSnapshot.type === "complete"` AND `reward.valid === true` 분기:
- `unlockMedal("first_session")` — 매 valid 완료마다 idempotent.
- KST `completedAtKstHour ∈ [22, 5]` 면 `bumpNightSession()` + 누적 ≥ 7 시 `unlockMedal("quiet_sky")`.

기존 SkyView 의 5분 누적 quiet_sky 트리거는 그대로 유지 — 어느 한 path 라도 unlock 되면 OK. 신규 사용자는 야간 집중 7회 → quiet_sky.

## E. DEV 패널

`handleUnlockAllMedals` 가 기존 `for (m of ALL_MEDALS) unlockMedal(m)` → `useRewardsStore.getState().unlockAllMedals()` 단일 호출로 교체. 신규 store method 가 dispatch 이벤트도 일괄 처리.

## F. 자산 fallback

사용자가 11 PNG 자산 추가 중. 미존재 시:
- `MedalIcon` 의 `onError` → `tierFallbackAsset(tier)` → 기존 medal_bronze/silver/gold.png
- UI 망가지지 않음. 사용자 자산 추가 시점 즉시 자동 반영.

## G. Legend (dogam_100) 패시브

PR-38 의 `passivesFromOwned(25)` 가 이미 `dailyCapBoost: 10` 부여. dogam_100 메달 unlock 과 25마리 도감 unlock 은 동일 임계 → 캡 +10 자동 적용. 별도 코드 변경 불요.

특별 모달은 PR-13 의 `cc:medal:unlocked` 리스너 (CollectionPage) 가 SFX 처리 + UnlockOverlay 가 토끼 unlock 시 별도 모달. dogam_100 메달 SFX 는 levelup. 본 PR 은 큰 모달 별도 추가 안 함 — 사용자 결정.

## H. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **110/110 pass** (PR-49 medalsConfig +9) |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| 금지토큰 7종 | 각 0 |

## 다음 작업

PR-51 (GRAC 가드레일).
