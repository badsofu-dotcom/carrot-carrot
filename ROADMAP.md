# ROADMAP — Carrot Carrot (BunnyTime v2)

자율 모드 누적 PR-6 ~ PR-42 의 완료 상태 + 남은 follow-up 정리.

## 완료 (자율 PR)

### Round 1 (PR-6 ~ PR-10): 옵션 C 신규 콘텐츠
- PR-6 `3b259c2` 보따리 헤더 → ToolDock 4번째 슬롯
- PR-6.5 `d26e894` InventoryModal/RewardsPanel 모달 overflow hotfix
- PR-7 `25d52ff` gem live (2 % daily drop + 5 → 1 seed)
- PR-8 `02fc8f2` juice live (다음 수확 +5 %p candy)
- PR-9 `27eff72` soup live (다음 ad-refill +1 charge)
- PR-10 `45fe043` cake live (다음 포커스 seed +1)

### Round 2 (PR-11 ~ PR-17): UI 폴리시 + follow-up
- PR-11 `4f93630` ToolDock 아이콘 SCALE_PADDED 1.25
- PR-12 `6c348a2` carrot_bag self-recursive 제거
- PR-13 `543b3b9` BGM + SFX 풀스택 (절차적 fallback)
- PR-14 `b6c66ba` SCALE_PADDED 1.45 상향
- PR-15 `34efbe5` SkyView cloud haze 제거
- PR-16 `dc0f0ae` swipe/wheel 농장 ↔ SkyView
- PR-17 `5cca7d2` buff indicator + weekly treasure + DAILY 정합

### Round 3 (PR-18 ~ PR-22): UX 깔끔화
- PR-18 `ffd5de9` basket/bag SCALE_TIGHT 0.9
- PR-19 `59acb67` DEV 패널 14 cheat + DCE
- PR-20 `02f222f` seed 헤더 chip
- PR-21 `43837ef` settings 헤더 톱니바퀴 제거
- PR-22 `1b5f092` RewardsPanel sticky header + scroll

### Round 4 (PR-23 ~ PR-30 partial / PR-31 ~ PR-42 main): 경제 재설계
- PR-23 `7bd764c` buff pill nowrap + 짧은 라벨
- PR-24 `fd415fc` carrot_coin / heart wire (광고 보상)
- PR-25 `f679eed` DEV 모든 자원 풀-범위 채움
- PR-26 `9cd47bd` 훈장 → AchievementsCard (도감)
- PR-27 `a6ae048` AdSuggestionModal (자원 부족 광고 안내)
- PR-28 `e7ace1e` ToolDock 5번째 광고 슬롯
- PR-29 / PR-30 → PR-39 / PR-40 으로 흡수
- PR-31 `b47cfc4` 자원 분류 (currency / soft_currency / consumable / token)
- PR-32 `d78e0bf` 가챠 calibration + 광고 N-th tier
- PR-33 `3b1908d` GemTradeModal 5 옵션
- PR-34 `f2b441d` FarmDropLayer (드랍 시스템)
- PR-35 `31b0f91` HiddenBunnyLayer (히든 토끼 가로지름)
- PR-38 `7eaef73` 도감 패시브 (gacha + ad N-th wire)
- PR-41 `d038575` 보따리 탭 → 선택 + 하단 패널
- PR-42 `979b131` AdRewardChannelModal viewport overflow hotfix

### PR-36 / PR-37 reload
이미 PR-27 (광고 안내 popup) + PR-28 (ToolDock 5번째) 에서 ship. 별도 PR 안 됨.

## 잔여 wire (next rounds)

### 도감 패시브 풀-wire
- **세션 당근 ×1.05** (10 마리): HomePage 의 focus 완료 carrot 그랜트에 곱하기. 현재 `getFocusFarmReward` 가 carrot 직접 grant 안 함 → 별도 reward path 추가 필요.
- **일일 gift ×1.5** (20 마리): `rollGift` consumer (RewardsPanel.onClaim) 에서 amount × 1.5 적용.
- **일일 P 캡 110** (25 마리): worker `/economy/withdraw` cap 검증 코드 + `passivesFromOwned(ownedCount).dailyCapBoost` 합산.

### 히든 토끼 사양 B
- 농장 배경 특정 위치 (나무 뒤 / 버섯집 옆) 에 가끔 살짝 보임 — 3 초 내 못 누르면 사라짐.
- 사양 A 와 같은 grant 경로. 다른 spawn 패턴.

### Worker / D1
- **Ad-token verification** — Apps-in-Toss SDK 시크릿 (`wrangler secret put`) 필요. AdRewardChannelModal nonce 가 이미 stub 으로 발급, 워커 검증만 wire 필요.
- **Worker daily-cap enforcement** — 100 P (+10 도감) 캡 코드 wire. 현재 doc only.
- **executePromotion live** — `TOSS_PROMOTION_API_BASE` + `TOSS_PROMOTION_API_KEY` 시크릿 + 실제 호출 wire.
- **Worker farm drop / hidden bunny verification** — 클라 anti-abuse 우회 방지. 향후 routes `/farm/drop/claim` + `/farm/bunny/discover`.
- **boxes/gift/open ↔ giftRoll 동기화** — 워커 inline DAILY 테이블이 이미 PR-17c 에서 giftRoll 와 정합. 와이어업만 남음.

### 자산
- **BGM mp3 drop-in** — `public/sounds/bgm_day.mp3` / `bgm_night.mp3` / `bgm_rainy.mp3` 추가. README 가이드 따라 사용자가 직접 받아 떨궈넣으면 즉시 활성.
- **시즈널 토끼 PNG** — placeholder ID (`seasonal_cherry_blossom` 등) 실제 PNG 로 교체.
- **광고 보상 아이콘** — AdRewardChannelModal 의 watering/gift/treasure 채널 아이콘 (PNG 부재 시 emoji fallback).

### UX 폴리시 (자율 진행 후보)
- **AchievementsCard 의 nextPassiveLabel 표시** — `passivesFromOwned` + `nextPassiveLabel` 활용. 도감 진행 카드에 "다음 보상: 10마리 - 세션 당근 +5%" 형태.
- **친구 초대 시스템** — 하트 +1, friends store 확장.
- **일일 미션 시스템** — 3 quest → 보상. 새 store `missionsStore`.
- **시즈널 이벤트** — 벚꽃 / 할로윈 / 크리스마스 시즌에 드랍 가중치 변경.
- **자원 변환 모달** — 당근 100 → coin 1 같은 UI sink.

## Hard stops (사용자/외부 의존)

- Ad-token verification 시크릿
- 시즈널 토끼 PNG 자산
- BGM mp3 자산
- 토스 promotion API 시크릿
