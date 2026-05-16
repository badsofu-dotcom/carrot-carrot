# IMPLEMENTATION_REPORT_PR-32.md — 100 P/일 캡 + 광고 N-th tier + 가챠 calibration

## A. 가챠 rates 재보정

| | 이전 | 신규 |
| --- | --- | --- |
| `HARVEST_BUNNY_RATE` | 0.5% | 0.5% (변경 없음) |
| `HARVEST_GOLD` | 1% | **0.6%** |
| `HARVEST_BASE_CANDY` | 4% | **7%** |
| `HARVEST_BOOST_CANDY` | 12% | 12% (변경 없음) |

새 cumulative bands:
- bunny [0, 0.005)
- gold [0.005, 0.011)
- candy [0.011, 0.081)
- carrot [0.081, 1)

`seasonalBunny.test.mjs` 의 5개 test 의 rng 값 새 boundary 에 맞춰 갱신 (golden/candy/perfect-combo/comboStreak/juice/juice+combo).

## B. 광고 N-th tier (PR-32 보강 spec 반영)

`AdRewardChannelModal.claim` 성공 path 마지막에서 daily count 누적 (`cc.ad.dailyCount.<KST_DAY>`). 매 claim 의 N 번째 시도에 따라 추가 보상:

| N | 추가 grant |
| --- | --- |
| 1 | +5 carrot |
| 2 | +5 carrot |
| 3 | +10 carrot |
| 4 | +10 carrot |
| 5 | +20 carrot (누적 50 P 보장) |
| 6~10 | +1 gem 또는 +1 bolt (50/50 random) |
| 11+ | 보너스 없음 (자정 리셋) |

기존 PR-24 채널 보상 (heart -1, carrot_coin +5) + 채널별 사이드 이펙트 (watering refill / gift / treasure progress) 는 그대로. N-th tier 는 **추가** 보너스.

자정 리셋: safeStorage 키가 KST 일자 string 포함 → 자정 이후 키 새로 생성 → 자동 0 으로 시작.

## C. EV 재계산 (calibrated)

| 소스 | EV (P/일) |
| --- | --- |
| 농장 수확 carrots (4 세션 × 25 × 1 P × 0.75 ratio) | 75 |
| 가챠 candy (7% × ~100 harvests × 5 P) | 35 |
| 가챠 golden (0.6% × 100 × 10 P) | 6 |
| 광고 N-th P (5회 보장) | 50 |
| Daily gift | 2 |
| Weekly treasure (7 progress / 7 일 × 5 P 평균) | 5 |
| **합계** | **~173 P** |

`daily_caps.reward_points_total` 캡 50 → **100** 으로 doc 갱신 (`0003_economy.sql` 주석). 실제 enforcement 는 worker 코드에서 (현재 미연결, 향후 wire 시 100 적용). 110 P 한계 + 토큰 (gem/bolt) 보너스는 그대로.

## D. 변경 파일

1. **`src/lib/seasonalBunny.ts`** — HARVEST_GOLD 0.006, HARVEST_BASE_CANDY 0.07. doc-comment 갱신.
2. **`src/lib/seasonalBunny.test.mjs`** — rng 값 새 boundary 정합 (5 test cases).
3. **`src/components/Inventory/AdRewardChannelModal.tsx`**:
   - `adDailyKey / readAdDailyCount / writeAdDailyCount` 헬퍼.
   - 성공 path 에 N-th tier switch (1~5: carrot, 6~10: gem/bolt random, 11+: no bonus).
   - `useFarmStore` import 추가.
4. **`ECONOMY_DESIGN.md`**: 광고 보상 N-th tier 표 + EV 재계산 + 가챠 rates 보정.
5. **`cloudflare/.../migrations/0003_economy.sql`**: `daily_caps` 컬럼 주석 cap eg. 50 → cap 100.

## E. Maintainer 후속 조치

- 신규 D1 마이그 없음 (0003 schema 변동 없이 주석만). SQL re-apply 불필요.
- 워커 코드의 daily-cap enforcement (현재 코드 없음) — 향후 wire 시 100 P 적용.

## F. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |

## G. 다음 작업

PR-34 — 농장 드랍 시스템 (FarmDropLayer).
