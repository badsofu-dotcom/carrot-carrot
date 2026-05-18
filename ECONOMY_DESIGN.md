# 버니타임 v2 — Economy Design (v3 — R32 / PR-180~187)

> **공시 (PR-51 / GRAC 가드레일)**
> 본 앱은 게임물이 아닌 **집중 / 생산성 도구** 입니다. 농장 시각화 +
> 보상은 사용자의 집중 활동에 대한 인센티브입니다. 확률형 보상 (보너스
> 드랍 / 친구 만나기) 는 `src/legal/reward-disclosure.md` 에서 공시.

> **R32 economy 재편 (2026-05-18)**
> 베타 단계 결정에 따라 **토스포인트 환산 (`executePromotion`) 은 dormant
> 상태로 보존** 합니다. 정식 출시 시점에 재활성화 정책을 별도 공시
> 갱신과 함께 다시 결정합니다.
>
> 그 사이 candy carrot / golden carrot 은 다음 **in-app sink** 로
> 사용됩니다:
>
> 1. **프리미엄 가구 라인** (`farmhubCatalog.ts`) — 일반 가구는 carrot,
>    프리미엄 가구는 candy 또는 golden 결제. R32 PR-182 에서 다통화
>    인프라 도입, 실제 프리미엄 가구 자산은 신규 맵 도입 시점에 추가
>    예정 (인프라만 reserved).
> 2. **가챠 pity 보조 통화** (`BunnyGachaModal`) — candy 10개로 rare
>    이상 보장 가챠, golden 5개로 epic 이상 보장 가챠 1회. legendary
>    100 stars 는 그대로 (희소성 유지).
> 3. **(기존)** `addPoints` server-side 일일 캡 카운터 — daily-cap
>    abuse 차단용 audit 트레일만 유지. 사용자가 실제로 환산받지는 못함.

This document captures the BunnyTime v2 reward economy: focus sessions
into carrot harvest, what caps and audit trails protect us against
abuse, what sinks consume carrots, and what is currently **live** vs
**dormant**.

> 본 문서 안의 "P" 표기는 자원 간 **상대 가치 단위 (in-app value
> unit)** 입니다. 토스포인트 환산은 dormant 이므로 실제 환산되지
> 않지만, 자원 EV 비교 / 일일 캡 산정 / 미래 재활성화 시 그대로
> 활용 가능한 internal accounting unit 으로 유지합니다.

## v2 자원 분류 (PR-31)

`itemsStore.ItemCategory` 4 종 + 별도 stores 2 surface:

| 카테고리 | 항목 | 목적 (R32) |
| --- | --- | --- |
| **currency** | carrot / candy / golden | 1 / 5 / 10 P 가치 단위. 일반 가구 = carrot, 프리미엄 가구 = candy/golden, 가챠 pity = candy/golden |
| **soft_currency** | seed / carrot_coin | 씨앗 = 심기 재료, 50 coin → 캔디 1 |
| **consumable** | hourglass / bolt / juice / soup / cake | 도구 아이템 (사용 시 1회 효과) |
| **token** | star / gem / heart | star=레전더리 가챠 (100개), gem=GemTradeModal, heart=광고 시청 토큰 |
| **honor** (별도 store) | medal × 11 | 도전 과제 (rewardsStore.medals Set, AchievementsCard) |
| **dex** (별도 store) | bunny × 25 | 도감 (collectionStore.ownedCharacters, CollectionPage) |

> Status: **dormant (R32)**.
> 워커의 `executePromotion` call path (`routes/economy.ts` →
> `/economy/withdraw`) 와 D1 migrations 0003 / 0006 은 **그대로 보존**
> 됩니다 — 정식 출시 시점에 재활성화 가능하도록. 베타 단계에서는
> 시크릿 미등록 상태 (`TOSS_PROMOTION_API_BASE` / `TOSS_PROMOTION_API_KEY`
> 비어 있음) 라 503 CONFIG_REQUIRED 로 단락 — 사용자가 환산 신청을
> 시도해도 차단됩니다. R32 PR-185 에서 RewardsPanel 의 "토스포인트
> 환산" UI 도 제거되어 사용자가 시도할 수 있는 진입점 자체가 없습니다.

## Conversion table

| Source | Drop | Points | Tracked in client store as |
| --- | --- | --- | --- |
| 일반 당근 (carrot harvest) | every harvest | 1 P | `useFarmStore.carrots` |
| 캔디 당근 (candy carrot) | **7 %** base / 12 % perfect-combo / +1 %p combo-streak ≥5 / +5 %p juice / +0.1 %p dogam ≥1 | 5 P | `useFarmStore.candyCarrots` |
| 황금 당근 (golden carrot) | **0.6 %** roll on harvest / +0.1 %p dogam ≥5 | 10 P | `useFarmStore.goldenCarrots` |
| 광고 시청 보상 (rewarded ad) | per ad, ≤ 10/day | 2 P | (server-side audit) |
| 데일리 출석 보너스 | once / KST day | 3 P | (server-side audit) |

Roll table lives in `src/lib/seasonalBunny.ts` — see the `HARVEST_*` constants. Header currency chips read directly from `useFarmStore` so the player sees their candy/golden inventory grow live. The roll percentages are clamped server-side by the daily cap so a single lucky run does not blow past the anti-abuse limit. Note: this PR resolves the historical mismatch between the original economy doc (7 % / 0.6 %) and the implemented roll table (4 % / 1 %) — the implemented values win because they match the unit tests in `seasonalBunny.test.mjs`.

## In-App Sinks (R32 — 신규)

토스포인트 환산이 dormant 인 만큼, candy / golden 의 가치는 다음 두
in-app sink 로 실현됩니다.

### Sink 1 — 프리미엄 가구 라인 (R32 PR-182~183)

`farmhubCatalog.ts` 의 `FarmhubFurniture` 인터페이스가 다통화 결제를
지원하도록 확장:

```ts
interface FarmhubFurniture {
  id: string;
  name: string;
  step: number;
  sprite: string;
  price: { currency: "carrot" | "candy" | "golden"; amount: number };
}
```

| 통화 | 가격대 (가이드) | 가치 (P 단위) |
| --- | --- | --- |
| carrot | 50 ~ 400 | 50 ~ 400 P |
| candy | 10 ~ 50 | 50 ~ 250 P |
| golden | 5 ~ 30 | 50 ~ 300 P |

기존 8개 가구는 carrot 통화로 그대로. 프리미엄 가구 실제 자산은 추후
신규 맵 도입 시점에 추가 — R32 에서는 **다통화 인프라만 reserved**.
`buyNextStep()` 이 `currency` 별로 `spendCarrots / spendCandyCarrots /
spendGoldenCarrots` 를 dispatch.

### Sink 2 — 가챠 pity 보조 통화 (R32 PR-184)

`bunnyGacha.ts` 의 `drawBunny()` 에 `boostTier?: "rare" | "epic"` 옵션
추가. boost 적용 시 해당 tier 이상이 보장되도록 weight 재가중.

| pity 옵션 | 비용 | 효과 |
| --- | --- | --- |
| candy → rare pity | candy 10개 | rare 이상 보장 (rare 100% / epic 2x / legendary 그대로 0%) |
| golden → epic pity | golden 5개 | epic 이상 보장 (epic 87.5% / legendary 12.5% — 100 star 와 별도 path) |
| star → legendary (기존) | star 100개 | legendary 보장 (변경 없음) |

`BunnyGachaModal` 에 위 두 옵션 추가 + 잔액 부족 시 비활성 + 결제 시
spendCandy/spendGolden CAS dispatch.

### Sink 가치 검증

평균 활성 사용자 (집중 4 세션 × 25 carrots 가정) 일일 EV:
- candy 가챠 7% × 100 harvests = 7개/일 → 캔디 가구 1개 (10개) 약 1.4일
- golden 0.6% × 100 = 0.6개/일 → 골든 가구 1개 (5개) 약 8일 / 골든 pity 약 8일
- 일일 선물 / 주간 보물 / 광고 보상에서도 candy/golden 추가 grant
- → 너무 빠르지도 너무 느리지도 않은 sink 속도 (인플레이션 ↔ 도달감
  균형)

## Currency icons (header)

| Currency | Asset | Fallback emoji |
| --- | --- | --- |
| Carrot | `public/assets/farm/currency/carrot.png` (sourced from `crop_stage4_ripe.png`) | 🥕 |
| Candy carrot | `public/assets/farm/currency/candy_carrot.png` (from `food_carrot_candy.png`) | 🍬 |
| Golden carrot | `public/assets/farm/currency/golden_carrot.png` (from `food_golden_carrot.png`) | ✨ |

Header chips render the PNG icon at 18×18 with `object-fit: contain`. If the asset fails to load on the deploy host (nested-proxy path issues), the chip falls back to the emoji glyph through an `onError` handler.

## Anti-abuse caps (KST per day, per user) — PR-32 보정

| Counter | Cap | 비고 |
| --- | --- | --- |
| `carrot_count` (당근 수확 횟수) | 100 | 2 hr 풀 활용 = 4 세션 × 25 carrots (PR-32 보정) |
| `reward_points_total` (포인트 합계) | **100** | EV 110 P, anti-abuse 자연 차단 (PR-32 보정 50 → 100) |
| `ad_views_today` (광고 시청 횟수) | 10 | 5회 P 보상 + 5회 토큰 보상 |

## 일일 미션 (PR-52)

매일 KST 자정 12종 pool 에서 3개 deterministic random pick (day-key hash). 미션별 reward 1~10 P, 모두 클리어 시 +5 P bonus.

| Mission | threshold | reward | trigger 사이트 |
| --- | --- | --- | --- |
| 25분 집중 1회 | 1 | 5 P | HomePage focus complete (focusedMs ≥ 25 min) |
| 50분 집중 1회 | 1 | 10 P | HomePage focus complete (≥ 50 min) |
| 야간 집중 1회 | 1 | 5 P | HomePage focus complete (KST 22-06) |
| 광고 3회 시청 | 3 | 5 P | AdRewardChannelModal claim |
| 토끼 1마리 새로 만나기 | 1 | 3 P | cc:bunny-gacha:show 이벤트 |
| 황금당근 1개 수확 | 1 | 5 P | FarmHub harvest golden |
| 캔디당근 3개 수확 | 3 | 3 P | FarmHub harvest candy |
| 농장 드랍 5개 줍기 | 5 | 3 P | FarmDropLayer.grant |
| 메달 1개 신규 unlock | 1 | 5 P | cc:medal:unlocked 이벤트 |
| 퍼펙트 콤보 1회 | 1 | 5 P | FarmHub allRipe 트리거 |
| 도구 아이템 3개 사용 | 3 | 3 P | InventoryModal.onUse |
| 친구 1명 초대 | 1 | 10 P | PR-54 wire 예정 |

EV 평균 (3개 pick + bonus): **15~20 P / 일**. 100 P 캡 합산 EV 약 173 + 17 = **190 P** 잠재 (캡 100 + 도감 100 bonus 10 = 110). 사용자 활동 인센티브 강화 + anti-abuse 자연 차단.

## 광고 채널 — 보물 진행 랜덤 보상 (PR-48)

`AdRewardChannelModal` 의 "보물" 채널 claim 마다 진행도 +1 + 랜덤 보상 풀 1 개:

| 보상 | 확률 | P 가치 |
| --- | --- | --- |
| ⭐ 별 +1 | 35 % | 0 |
| 💎 보석 +1 | 25 % | 0 |
| 🌱 씨앗 +3 | 15 % | 0 |
| 🍬 캔디 당근 +1 | 10 % | 5 |
| ⚡ 번개 +1 | 10 % | 0 |
| ✨ 황금 당근 +1 | 5 % | 10 |

EV per treasure claim = 0.10 × 5 + 0.05 × 10 = **1.0 P**. 일일 ~1 회 claim 기준 미미한 인플레이션 — 100 P 캡 안전.

## 광고 보상 N-th tier (PR-32)

광고 채널 (`AdRewardChannelModal`) claim 마다 누적 N 회 기준:

| N | 추가 grant | 누적 P |
| --- | --- | --- |
| 1 | +5 carrot | 5 |
| 2 | +5 carrot | 10 |
| 3 | +10 carrot | 20 |
| 4 | +10 carrot | 30 |
| 5 | +20 carrot | **50 (보장)** |
| 6 | +1 gem 또는 +1 bolt (50/50) | 50 |
| 7 | +1 gem 또는 +1 bolt | 50 |
| 8 | +1 gem 또는 +1 bolt | 50 |
| 9 | +1 gem 또는 +1 bolt | 50 |
| 10 | +1 gem 또는 +1 bolt | 50 |
| 11+ | 보너스 없음 (자정 리셋) | 50 |

`cc.ad.dailyCount.<YYYY-MM-DD>` safeStorage 키에 카운터 저장. 자정 KST 이후 키가 새로 생성되어 자동 0 리셋.

기존 채널 보상 (watering refill / gift / treasure progress + 1 heart consume + 5 carrot_coin) 은 그대로 유지. N-th tier 는 **추가** 보너스.

## EV 일일 (PR-32 calibration)

| 소스 | 평균 EV (P) |
| --- | --- |
| 농장 수확 (4 세션 × 25 carrots × 1 P × 0.75 ratio) | 75 |
| 가챠 candy (7% × 약 100 harvests × 5 P) | 35 |
| 가챠 golden (0.6% × 100 × 10 P) | 6 |
| 광고 N-th P (5회 보장) | 50 |
| Daily gift | 2 |
| Weekly treasure (7 progress / 7 = 1 open/week 평균) | 5 |
| **합계 EV** | **~173 P** (집중 시) |

100 P 캡이 적중 — anti-abuse 자연 차단. 2 시간 풀 활용 시 100 P + tokens (gem/bolt) bonus 받음.

## Gem trade options (PR-33)

GemTradeModal — 보석 사용 5 옵션:

| ID | 비용 | 효과 | 즉시 EV |
| --- | --- | --- | --- |
| seeds9 | 5 gem | 씨앗 +9 | 0 P (soft sink) |
| grow | 5 gem | 전체 심은 plot +1 stage | 무시 |
| session | 10 gem | 당근 +25 (25분 세션 1회분) | 25 P → 2.5 P/gem |
| golden | 20 gem | 황금당근 +1 | 10 P → 0.5 P/gem |
| legend | 50 gem | 레전더리 토끼 (보유 시 환불) | 도감 unlock |

## 농장 드랍 (PR-34 + PR-47)

`FarmDropLayer` — 15~60 초 random spawn. **무한 잔존** (탭으로만 사라짐) + 일일 cap 12 + 동시 표시 cap 3 (PR-47). KST 자정 모두 제거.

| Drop | weight | 확률 |
| --- | --- | --- |
| gem | 30 | 30 % |
| bolt | 22 | 22 % |
| heart | 15 | 15 % |
| hourglass | 10 | 10 % |
| juice / soup / cake / seed | 각 4 | 각 4 % |
| golden | 2 | 2 % |
| hidden_bunny | 1 | 1 % |

체류 유도 메커닉. sessionStorage `cc.farmDrop.active.v1` 으로 페이지 라우팅 / 탭 전환 후에도 활성 drop 유지. 클라 카운터만 (anti-abuse 자연 차단).

위치 클러스터 (PR-45): fence-inside 30 / fence-outside 25 / mushroom-house 15 / tree-base 15 / well 10 / random-low 5.

## 히든 토끼 (PR-35)

`HiddenBunnyLayer` — 5~30 분 random 가로지름. 일일 max 4. 탭 시:
- 미획득: forceUnlock + BunnyGachaModal surface (도감 unlock 가치)
- 보유: gem +5 보너스

사양 B (히든 스팟) 는 follow-up.

## 도감 패시브 (PR-38)

`passivesFromOwned(count)` — 도감 unlock 카운트에 비례한 누적 효과:

| 임계 | 효과 |
| --- | --- |
| 1 마리 | 캔디 확률 +0.1 %p |
| 5 마리 | 황금 확률 +0.1 %p |
| 10 마리 | 세션 당근 ×1.05 (잔여 wire) |
| 15 마리 | 광고 보상 +1 carrot |
| 20 마리 | 일일 gift ×1.5 (잔여 wire) |
| 25 마리 | 일일 P 캡 100 → 110 (worker enforcement TBD) |

캐스케이드 (≥ N). gacha rates (1, 5) + 광고 N-th tier (15) 본 PR 에 wire.

## Harvest gacha rates (PR-32 보정)

| 항목 | 이전 | 신규 |
| --- | --- | --- |
| Bunny | 0.5 % | 0.5 % |
| Golden | 1 % | **0.6 %** |
| Candy (base) | 4 % | **7 %** |
| Candy (boost: perfect-combo) | 12 % | 12 % |
| Combo batch bonus | +1 %p | +1 %p |
| Juice buff | +5 %p | +5 %p |

All caps live in the `daily_caps` table keyed by `(user_key, ymd)`.
`ymd` is the KST date string (`YYYY-MM-DD`) — every grant looks up
today's row, increments, and rejects if the new total would exceed
the cap.

## Data model

See `migrations/0003_economy.sql` for the full schema. Five tables:

1. **`pending_points`** — running pending balance per user, plus a
   monotonic lifetime total for analytics.
2. **`point_grants`** — append-only ledger of every grant. One row =
   one (source, kind, amount) tuple. Daily-cap aggregation runs off
   the `(user_key, ymd)` index here too, but `daily_caps` is the hot
   read path.
3. **`daily_caps`** — denormalized per-day counters.
4. **`ad_views`** — every rewarded-ad attempt is logged, including
   dismissed / errored ones. Reward grants are linked via
   `reward_id → point_grants(id)`.
5. **`promotion_withdrawals`** — every executePromotion request and
   response. Reconciliation trail.

## Server endpoints (scaffold — R32 기준 dormant)

> R32 (2026-05-18) — `/economy/balance` 의 `withdrawEnabled` 은 항상
> `false` 로 반환되며, `/economy/withdraw` 는 시크릿 미등록 상태에서
> 503 CONFIG_REQUIRED 로 단락. 프론트엔드는 R32 PR-185 에서 출금
> 진입점을 제거 — 사용자가 환산 시도 자체를 못 합니다. 본 섹션의
> 스펙은 정식 출시 시점의 재활성화를 위해 그대로 보존됩니다.

All endpoints require Bearer JWT auth (`requireUser`). See
`cloudflare/workers/carrot-carrot-api/src/routes/economy.ts`.

- **`GET /economy/balance`** — `{ pending, lifetimeTotal, withdrawEnabled }`.
  Falls back to `0` if migration not applied, so the frontend never
  errors out.
- **`POST /economy/withdraw`** — invokes Toss `executePromotion`. Body:
  `{ amount: number }` (P). Flow:
  1. Snapshot `pending_points` row (`pending`, `updated_at`).
  2. CAS decrement: `UPDATE … WHERE pending >= amount AND updated_at = <snapshot>`. 0 rows → 409 `CONCURRENT_UPDATE`; retry.
  3. Insert `promotion_withdrawals (status='pending')` to obtain a stable id; use `cc-w-<id>` as `Idempotency-Key`.
  4. Call `executePromotion(env, sub, amount, idemKey)` — mTLS POST to `${TOSS_PROMOTION_API_BASE}/api-partner/v1/promotions/execute`.
  5. On success update the row with `toss_txid` + `status`; on failure refund pending + mark row `failed` with a redacted snippet.
  - Returns `503 CONFIG_REQUIRED` if `TOSS_PROMOTION_API_BASE` or
    `TOSS_PROMOTION_API_KEY` is missing. Returns `400 BELOW_MIN`,
    `409 INSUFFICIENT`, `409 CONCURRENT_UPDATE`, `409 SCHEMA_NOT_READY`,
    or `502 UPSTREAM_FAILED` otherwise.

- **`POST /tools/refill`** and **`POST /items/use`** — accept optional
  `{ nonce, signedToken }`. When `TOSS_AD_VERIFY_KEY` is configured the
  pair is required; the route runs `verifyAdToken` first
  (`cloudflare/.../lib/adToken.ts`). Duplicate / invalid / missing →
  `409 DUPLICATE_NONCE` / `401 INVALID_SIG` / `400 MISSING_NONCE`. When
  the verify key is NOT set, a nonce alone serves as best-effort
  idempotency — suitable for preview only.
- **`POST /economy/ad-view`** — `{ placement, status, network }`. ALL
  attempts are logged. A reward is granted only when status =
  `completed` AND a signed callback from the ad network has been
  verified — never inline based on client claims.

## Frontend behavior (current)

The frontend renders the economy UI defensively:

- If `withdrawEnabled === false`, the withdraw button is shown
  disabled with copy "준비 중 — 토스 연동을 기다리고 있어요".
- Pending balance is read from `/economy/balance` and rendered next
  to the carrot counter on the farm tab and on the report tab. When
  the worker returns the migration-fallback zeros the UI shows
  "0 P" silently.
- Rewarded ads: dismissed / error never trigger a reward locally.
  The frontend always posts the outcome to `/economy/ad-view`
  regardless of status.

## Out of scope for this PR

- Live activation of `executePromotion` — requires the maintainer to
  `wrangler secret put TOSS_PROMOTION_API_BASE`, `… API_KEY`, and (for
  ad-token verification) `TOSS_AD_VERIFY_KEY`. Without those the call
  path stays dormant.
- Ad SDK selection (TossAds vs AdMob). Right now we ship a stub
  network=`mock` that always reports `dismissed`.
- Fraud detection beyond per-day caps. Future: device fingerprinting,
  IP reputation, click-through anomaly detection.

## Migration apply checklist (human-only)

1. Confirm staging DB bound: `wrangler d1 list`.
2. Dry-run: `wrangler d1 migrations apply carrot-carrot-db --remote --dry-run`.
3. Apply migrations in order: 0003, 0004, 0005, 0006 (all idempotent):
   `wrangler d1 migrations apply carrot-carrot-db --remote`.
4. Verify tables exist:
   `wrangler d1 execute carrot-carrot-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"`.
5. Register Toss secrets (NEVER commit values):
   ```
   wrangler secret put TOSS_PROMOTION_API_BASE   # e.g. https://apps-in-toss-api.toss.im
   wrangler secret put TOSS_PROMOTION_API_KEY    # Bearer token from Toss merchant console
   wrangler secret put TOSS_AD_VERIFY_KEY        # HMAC-SHA256 secret shared with ad SDK callback
   ```
6. First-promotion smoke test (see `DEPLOY.md → Smoke test: first
   promotion`).

**Do not** run `wrangler deploy` from CI or from an autonomous agent.
The reward economy touches money — every deploy is a human action.
