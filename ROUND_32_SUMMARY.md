# Round 32 — candy/golden Re-economy (2026-05-18)

## 한 줄 요약

토스포인트 환산을 dormant 처리하면서 갈 곳 없어진 캔디당근 / 황금당근을
두 in-app sink (**A 프리미엄 가구** + **B 가챠 pity 보조 통화**) 로
재활용. 디자인 문서 / 인프라 / UI / 광고 보상 비중까지 전면 검토.

## 변경 PR (7개)

| PR | sha | 분류 | 한 줄 |
| --- | --- | --- | --- |
| PR-180 | `1d3cf12` | docs | ECONOMY v3 / reward-disclosure / privacy / terms — 토스포인트 dormant + 신규 sink 정책 명시 |
| PR-181 | `26b8855` | feat(economy) | `farmStore.spendCandyCarrots / spendGoldenCarrots` CAS 액션 + `points.ts` 환산 함수 deprecate |
| PR-182 | `ff2bc86` | feat(decor) | `farmhubCatalog` 에 `price: { currency, amount }` 필드. 다통화 결제 인프라 (기존 8 가구는 carrot, 프리미엄 reserved) |
| PR-183 | `1529434` | feat(decor) | `BuyFurnitureModal` 통화별 분기 — emoji / balance / confirm copy 동적 |
| PR-184 | `f3a6944` | feat(gacha) | `drawBunny` 에 `boostTier` ("rare"/"epic") + 신규 `BunnyPityModal` (cc:bunny-pity:open 리스너) |
| PR-185 | `e1da34f` | feat(rewards) | `RewardsPanel` — P 환산 라벨 제거 + 신규 "🐰 자원 사용" 섹션 + BunnyPityModal 트리거 |
| PR-186 | `8143d4a` | balance(ad) | 광고 보물 채널 candy/golden 비중 상향 (sink 흐름 보조) |

PR-187 (도감 토끼 먹이주기) 는 persistence 설계가 필요해 별도 라운드로
deferred — 본 라운드의 핵심 (A+B 두 sink) 는 완결.

## 디자인 결정 (사용자 alignment 후 확정)

| 결정 | 값 | 이유 |
| --- | --- | --- |
| 프리미엄 가구 가격대 | P 가치 비슷게 (candy 10~50 / golden 5~30 → 50~300 P 가치) | 일반 가구 (50~400 carrots / P) 와 균형 — 모이면 살 수 있는 도달감 |
| 가챠 pity boost 강도 | 중간 — candy 10→rare 보장 + epic+ 2x / golden 5→epic 보장 (legendary 12.5%) | legendary 희소성 (100 stars 별도 path) 보존 |
| 프리미엄 가구 자산 | 추후 신규 맵 도입 시 추가 — 인프라만 reserved | 자산 작업 시점 분리, 카탈로그 한 줄 추가만으로 활성화 |

## 아키텍처 개요

### 통화 흐름 (R32 후)

```
                    ┌──────────────┐
   harvest 7%   ──→ │ candyCarrots │ ──→ ┌─────────────────────┐
   광고 30%     ──→ │              │     │ BunnyPityModal      │
   trade 5gem   ──→ │              │     │ rare 보장 가챠 10개  │
                    └──────────────┘     │                     │
                                         └─────────────────────┘
                    ┌──────────────┐
   harvest 0.6% ──→ │ goldenCarrots│ ──→ ┌─────────────────────┐
   광고 10%     ──→ │              │     │ epic 보장 가챠 5개   │
   trade 20gem  ──→ │              │     └─────────────────────┘
                    └──────────────┘
                          ↓
                    farmhubCatalog
                    price: { currency, amount }
                          ↓
                    BuyFurnitureModal
                    (carrot|candy|golden 분기)
                          ↓
                    farmStore.spend{Carrot|Candy|Golden}Carrots
                    (CAS, race-safe)
```

### 진입점 (R32 후)

| 진입점 | 위치 | trigger |
| --- | --- | --- |
| 가구 구매 | 농장 → 🍄 집 들어가기 → 보관함 자물쇠 슬롯 | `MushroomHouseRoom` |
| 가챠 pity | 농장 → 🎁 보상함 → 🐰 자원 사용 섹션 | `cc:bunny-pity:open` |
| 가챠 기본 | harvest 0.5% 자동 | `FarmHub` 내부 |
| 가챠 legendary | 보관함 → 보석 사용 → 전설 친구 만나기 | `cc:gem-trade:open` → 50 gem |

## 검증 결과 (라운드 종합)

| 검사 | R31 끝 | R32 끝 |
| --- | --- | --- |
| `node --test` | 290 pass | **315 pass** (+25 신규: PR-182 8개, PR-184 17개) |
| `npm run typecheck` | clean | clean |
| `npm run build` | OK | OK |
| `npm run build:preview` | OK | OK |
| `npm run build:ait` | OK | (R32 wrap 시점 빌드) |
| `dist-preview` forbidden-token | 0/8 | 0/8 |
| `pointsFor / canWithdraw` 호출 사이트 | 0 | 0 (deprecated 마킹) |

## 회귀 위험 / 후속

### R32 회귀 위험

- **광고 보물 채널 star 분포 감소** (35% → 28%): legendary 100 stars
  가챠 도달 시간 35일 → ~45일. candy/golden pity 옵션이 추가됐으므로
  legendary 외 tier 의 도달감은 더 빨라짐 (offset).
- **기존 8개 가구 결제 흐름**: 모두 carrot 통화 그대로라 사용자 UX
  동일. UI/UX 변화는 신규 candy/golden 가구가 추가될 때 비로소 노출.
- **RewardsPanel +P 라벨 제거**: 일부 사용자가 P 환산값을 기대했을
  수 있음. 신규 "자원 사용" 섹션이 보유 자원의 의미를 더 직접적으로
  설명하므로 UX 후퇴 우려는 낮음.

### 후속 가능 작업 (이번 라운드 미포함)

| ID | 한 줄 | 우선순위 |
| --- | --- | --- |
| R32+1 | 실제 프리미엄 가구 자산 (candy/golden 결제) — 새 맵 도입 시 catalog 한 줄 추가만으로 활성화 | 신규 맵 콘텐츠 PR 시 |
| R32+2 | 도감 토끼 먹이주기 (candy/golden → CSS sparkle 효과 + persistence) — 본 라운드에서 PR-187 로 계획됐다가 persistence 설계 필요해 deferred | 중 |
| R32+3 | `points.ts` 의 deprecated 함수 / `MIN_PAYOUT` 실제 삭제 (정식 출시 시점 토스 환산 재활성화 결정 후) | 정식 출시 결정 후 |
| R32+4 | 일일 가구 사용 / 가챠 사용 horizon 추적 (analytics `logFarmhubBuy` + `logEvent` 활용) | 베타 수치 분석 단계 |

## 사용자 액션

1. AIT 콘솔에 새 .ait 업로드 후 실기 확인:
   - 농장 → 🎁 보상함 → 🐰 자원 사용 섹션 노출 / "친구 만나기" CTA
     → BunnyPityModal 진입 / 캔디·황금 충분 시 추첨 진행 → 도감 unlock
     셀러브레이션 (BunnyGachaModal).
   - 농장 → 🍄 집 들어가기 → 보관함 자물쇠 슬롯 → BuyFurnitureModal —
     기존 8개 가구는 모두 carrot 결제 그대로 (UI 변화 없음).
   - 일일 선물 / 주간 보물 결과 텍스트에서 "+5 P" / "+10 P" 사라짐
     확인.
2. **자산 추가 계획**: 신규 맵 / 프리미엄 가구 PNG 준비되면
   `src/features/decor/farmhubCatalog.ts` 의 `FARMHUB_FURNITURE` 배열에
   다음 형태로 한 줄 추가하면 BuyFurnitureModal 까지 자동 작동:
   ```ts
   {
     id: "magic_lamp",
     name: "마법 램프",
     step: 9,                          // 9 부터 신규 step
     sprite: "/assets/decor/premium/farmhub_magic_lamp.png",
     price: { currency: "candy", amount: 20 },
   }
   ```
   FARMHUB_FINAL_STEP 상수도 신규 step max 로 갱신.
