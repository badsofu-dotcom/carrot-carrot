# ECONOMY_AUDIT.md — 일일 P 획득 가능량 audit

PR-89 자율 audit. 코드 변경 0. 결과 → PR-90 일일 캡 도입에 사용.

## A. P 환산 기준 (변경 없음)

| 자원 | 환산 | 출처 |
| --- | --- | --- |
| 당근 | 1 P | `src/lib/points.ts` |
| 캔디 당근 | 5 P | 同上 |
| 황금 당근 | 10 P | 同上 |
| 씨앗 | 0 P (local-only) | rewardTables.ts comment |
| 별 / 보석 / 하트 | 0 P (local-only) | 同上 |
| MIN_PAYOUT | 50 P | `src/lib/points.ts` |

## B. 일일 P source 매트릭스

### B-1. 직접 P grant 사이트

| Source | 자원 | 일일 cap | 평균 EV | 최대 P/일 |
| --- | --- | --- | --- | --- |
| **Daily mission** (PR-75) | carrot | 3개 | 35 P | 35 |
| **Weekly mission** (PR-76) | carrot | 3개/주 | 17 (=120/7) | 30~50 |
| **Daily gift** (rewardTables) | candy/golden/seed | 1/일 | 2.0 | 10 (golden roll) |
| **Weekly treasure** | candy/golden/etc | 1/주 | 1 (=7/7) | 5~30 |
| **Ad reward channel** (1-5회) | carrot | 5회/일 | 50 | 55 (+passive) |
| **Harvest gacha** | candy/golden | unlimited | ~0.41/plot | 무제한 (집중 시간 비례) |
| **Drop pickup** golden | golden | 30/일 cap | ~6/일 (P=0.02×10×30) | 60 (전부 golden 가정) |
| **GemTrade** | gem → carrot/golden | 5-50/일 | 0 (exchange) | 0 (신규 P 아님) |
| **Friend invite** | seed/gem | 1회 lifetime | 0 | 0 (P=0) |
| **Hidden bunny tap** | gem | 5/일 | 0 | 0 |

### B-2. Harvest gacha 상세 (가장 큰 가변 source)

per plot harvest EV (PR-71 dogam 적용):
- base: +1 P (carrot)
- candy: 7% × 5 P + dogam candyBonusP +0.1%p × ~6 tiers = 0.35 + ~0.30 = **0.65 P**
- golden: 0.6% × 10 P + dogam goldenBonusP +0.1%p × ~5 tiers = 0.06 + ~0.05 = **0.11 P**
- sessionCarrotMul (4+ dogam): +5% × 1 P = **0.05 P**

**per plot harvest EV ≈ 1.81 P** (heavy dogam) / 1.06 P (zero dogam)

집중 시간별 harvest 가능량:
| 세션 길이 | 동시 grow steps | 9-plot 1 cycle = ~? 세션 |
| --- | --- | --- |
| 5-14 분 | +1 step | 4 세션 (4 step × 9 plot) |
| 15-29 분 | +1 + seed | 4 세션 |
| 30-49 분 | +2 + seed×2 | 2 세션 |
| 50+ 분 | +3 + seed×3 | ~2 세션 |

→ **하루 9 plot 5 사이클 가능** (50분 × 5 세션 또는 25분 × 10 세션 등)
→ Harvest 만으로 9 × 5 × 1.81 ≈ **81 P/일** (heavy dogam) / 48 P (zero dogam)

### B-3. 일일 max 시나리오 합산

**Casual user** (1 × 25-min 세션 + 1 daily gift + 1 ad):
- 1 cycle harvest 9 plot × 1.06 = **9.5 P**
- daily gift: 2 P
- 1st ad: 5 P
- mission 0회 클리어 (1 세션으로 미션 미충족): 0 P
- Total: **~16.5 P / day**

**Mid user** (2 × 25-min 세션 + daily gift + 3 ads + 일일 미션 부분 클리어):
- 2 cycle harvest 9 × 2 × 1.06 = 19 P
- daily gift: 2 P
- 3 ads: 5+5+10 = 20 P
- daily mission: min25Sessions 1/2 + totalFocusMin50 (50/50 클리어) + perfectCombo1 (?) = ~15-20 P
- Total: **~56-61 P / day**

**Heavy user** (5 × 50-min 세션 + 모든 미션 + 5 ads + 무거운 drop):
- 5 cycle harvest 9 × 5 × 1.81 = 81 P (dogam 가정)
- daily gift: 2 P
- weekly treasure prorated: ~1 P
- daily mission EV: 35 P (다 클리어)
- weekly mission prorated: ~17 P
- 5 ads: 5+5+10+10+20 = 50 P + dogam +5 = 55 P
- drop 평균: 5 P
- Total: **~196 P / day** (이론적 ceiling)

→ **현재 시스템은 heavy player 가 일일 ~200 P 도달 가능**. 사용자 의도 (100~150P) 대비 cap 필요.

## C. 캡 권장선 (자율 결정)

### 결정: **base 100P/일 + dogam_100 (12 마리 unlock) 시 +10P = 최대 110P/일**

**이유 1: 기존 legal disclosure 와 일치**
`src/legal/reward-disclosure.md` 의 line 13-14:
```
- **기본 한도**: 100 P / 일
- **확장 한도**: 도감 100% 완성 시 +10 P 보너스 (총 110 P)
```
이미 문서화된 정책 → 코드만 enforce 하면 됨.

**이유 2: `dogamPassives.ts` 의 dailyCapBoost 기존 존재**
PR-71 (Round 9) 에서 `passivesFromOwned(count).dailyCapBoost` 가 dogam 12+ 마리 → 10 으로 정의됨. 클라이언트 표시 가능, worker enforcement 만 미완료. **이번 PR 이 그 wire**.

**이유 3: MIN_PAYOUT (50P) 대비 hreadroom 충분**
- 50P 부터 출금 가능
- 100P/일 = 2일 만에 출금 가능
- 200P 이상 = 비현실적 grinding 방지

**이유 4: 사용자 의도 (100~150P) 의 보수적 endpoint**
- 100P 채택: 학습 동기 유지 + 노가다 방지 양립
- 150P 선택 시 heavy farming 유인 → 학습 도구 톤 위반
- 120P 도 후보였으나 disclosure 와 일관성 위해 100P 채택

### Alternative considered (각 후보 + 기각 이유)

| 후보 | 이유 | 기각 사유 |
| --- | --- | --- |
| 70P | 매우 보수적, 학습 강제 | MIN_PAYOUT 50P 대비 마진 약함, 의욕 저하 |
| 100P (base) | disclosure 일치, 균형 | ✅ **채택** |
| 120P | 사용자 의도 중심 | disclosure 와 불일치, dogam +10P 더하면 130P 가 더 자연 |
| 150P | 사용자 의도 상한 | heavy farming 허용 (~200P 달성도) 위험 |

## D. 사이드 효과 / Round 13 후보

1. **확률 audit** — PR-91 별도. rewardTables / bunnyGacha / harvestGacha 가 명시적 정의 (rewardTables.ts) vs 일부 hardcode (FarmHub.tsx 의 sessionCarrotMul 0.05) 혼재.
2. **Worker dailyCapBoost wire** — PR-90 은 client-side cap. worker `/economy/withdraw` 도 server-side check 필요 (불일치 시 client tamper 가능). Round 13 후보.
3. **GemTrade balancing** — 50 gem = 전설 토끼 (P 가치 0). 보석 획득 경로가 daily gift (2% × 1) 라 매우 느림 — 의도된 페이스인지 확인 필요.

## E. 결론

**100P base + 10P dogam_100 = 최대 110P/일** 캡 채택.
- PR-90: `lib/economy/dailyCap.ts` 신설, addPoints(source, amount) 인터페이스, KST 자정 리셋, safeStorage `cc.economy.dailyP.v1`.
- UI: HomePage 또는 RewardsPanel 에 "오늘 N/cap P" 진행도. cap 도달 시 "🌙 오늘은 푹 쉬어요" 안내.

---

## G. Round 14 (PR-109) 후 — 씨앗 자원 폐기 영향 (PR-114)

PR-109 가 씨앗 자원 폐기 + 모든 seed reward → candy/golden 흡수. 이로 인해 EV 변화:

| Source | Before EV | After EV (PR-109) | 변화 |
| --- | --- | --- | --- |
| Daily gift | 2.0 P | **5.6 P** | +180% |
| Weekly treasure (per claim) | 7.0 P | **7.75 P** | +11% |
| Friend invite | 0 P (씨앗+10) | 10 P (캔디+2) | 신규 P |
| GemTrade seeds9 | 0 P | 15 P (캔디+3) | 가성비 ↑ |
| Farm drop seed slot | 0 P | 5 P (캔디 흡수) | 가성비 ↑ |
| Ad reward seed +3 옵션 | 0 P | (candy 0.25 흡수) | 가치 보존 |
| Focus tier seedDelta | 0 P (씨앗만) | 0 P (제거) | 영향 없음 |

### Heavy player 시나리오 재산출

이전: ~196 P/일 추정.
PR-109 후 (가정 동일):
- harvest 81 P (변화 없음)
- daily mission 35 P (변화 없음)
- weekly mission ~17 P (변화 없음)
- daily gift 5.6 P (+3.6)
- weekly treasure prorated 1.1 P (+0.1)
- ad channel 55 P (변화 없음)
- drop 5 P (변화 없음 — candy 흡수)
- friend invite (lifetime) 무관
- **Total: ~200 P/일** (이전 196 → 200, +2%)

→ cap 100P 가 여전히 적절. heavy player 최대치는 약간 상승했지만 캡으로 자동 제한.

## H. PR-109 후 결론

- **Daily gift EV 1.5→4.7P** = casual user 의 일일 보상 가시성 향상 (seed=0 → candy=5)
- **씨앗 P 가치 0** 이라 EV 미반영 사이트들 (예: 친구 초대 0 → 10) 이 실 P 로 환산되며 사용자 만족도 ↑
- **일일 캡 100P** 유지 — 변경 불필요. heavy ceiling 거의 동일.
