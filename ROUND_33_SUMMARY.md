# Round 33 — 광고 무제한 + heart 부스트 재정의 (2026-05-18)

## 한 줄 요약

사용자 결정 — 광고 시청을 통한 자원 grant 를 **일일 캡 면제** + heart
의 광고 gate 역할 폐기 → **부스트 자원**으로 재정의. ad-source 만
`addPointsUncapped` 로 분리 (다른 source 는 100 P 가치 캡 유지).

## 변경 PR (5개)

| PR | sha | 분류 | 한 줄 |
| --- | --- | --- | --- |
| PR-188 | `1c71abe` | docs | ECONOMY v3.1 / reward-disclosure / privacy / terms — 광고 무제한 + heart 재정의 정책 |
| PR-189 | `2a6d7d0` | feat(economy) | `addPointsUncapped` 신규 — 광고 source 일일 캡 면제 + earned 카운터 영향 X. inc* 시그니처에 opts.bypassDailyCap |
| PR-190 | `e61e41d` | feat(ad) | AdRewardChannelModal heart gate / consume 제거 + N-th tier 11+회 carrot +1 small (지속 incentive) |
| PR-191 | `18f5e67` | feat(buff) | heart 부스트 자원 — `HEART_CANDY_BONUS=0.10` + buffsStore heart 지원 + 신규 HeartUseModal (옵션 2종) |
| PR-192 | `c2384d0` | feat(items) | InventoryModal heart "사용하기" → cc:heart-use:open dispatch + itemsStore.heart.usable: true |

PR-193 은 농장 드랍 검토 결과 변경 불필요 (heart 슬롯 weight 15% 유지)
→ wrap-up doc 만 작성.

## 디자인 결정 (사용자 답변 기반)

| 결정 | 값 | 이유 |
| --- | --- | --- |
| 광고 cap 처리 | source 분리 — ad 만 `addPointsUncapped` (cap 면제) | 광고로 얻는 carrot 은 무제한, 다른 source 는 abuse 차단 |
| heart 의미 재정의 | 부스트 자원 (옵션 C) | dead resource 방지 + 즉시 도파민 |
| heart 부스트 강도 | 중간 — candy +10%p (juice 2배) 또는 plot +1 stage 즉시 | 광고 무제한 시대의 의미 있는 보상 |
| 11+회 광고 보상 | carrot +1 small | 무한 시청 incentive (이전엔 "한도 도달" toast only) |
| 친구 wave +1 heart | 유지 | heart 가 부스트라 보상 의미 유지 |
| 농장 드랍 heart 15% | 유지 | source 의미 강화 (부스트 → 자연 sink) |

## 아키텍처 개요

### 자원 흐름 (R33 후)

```
┌─────────────────────────────────────────────────────────────┐
│  광고 시청 (무제한)                                          │
│    1~5회 → carrot 5/5/10/10/20 (보장)                       │
│    6~10회 → gem/bolt random                                 │
│    11+회 → carrot +1 small (지속)                           │
│      ↓ farm.incCarrots(n, { bypassDailyCap: true })         │
│      ↓ addPointsUncapped("ad_carrot", n) ─ cap 무시         │
│                                                              │
│  광고 보물 채널 → candy/golden 도 bypassDailyCap: true       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  daily cap (100 P 가치)                                      │
│    ❌ 광고 source (ad_carrot/ad_candy/ad_golden) 면제         │
│    ✅ 수확 / 가챠 / 일일 선물 / 주간 보물 — 캡 적용           │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐       cc:heart-use:open
│ heart        │ ─────────────────────────→ ┌─────────────────┐
│ (자정 +3 /   │                            │ HeartUseModal   │
│  wave +1 /   │ ←─ consume 1 ──────────── │ ┌─────────────┐ │
│  드랍 15%)   │                            │ │ 🍬 candy    │ │
└──────────────┘                            │ │   +10%p     │ │
                                            │ │ (heart buff)│ │
                                            │ ├─────────────┤ │
                                            │ │ 🌱 plot 모두│ │
                                            │ │   +1 stage  │ │
                                            │ │ (즉시)       │ │
                                            │ └─────────────┘ │
                                            └─────────────────┘
                                                     ↓
                                      buffsStore.activate("heart")
                                                     ↓
                          다음 harvest → rollHarvestGacha({ heartActive })
                                  → candy band +10%p stack
```

### 진입점 (R33 후)

| 진입점 | 위치 | trigger |
| --- | --- | --- |
| 광고 시청 | 농장 → 광고 채널 / 보상함 / heart 잔량 무관 항상 가능 | `AdRewardChannelModal` |
| heart 사용 | 인벤토리 → 토큰 탭 → 하트 → 사용하기 | `cc:heart-use:open` → `HeartUseModal` |

## 검증 결과

| 검사 | R32 끝 | R33 끝 |
| --- | --- | --- |
| `node --test` | 315 pass | **325 pass** (+10 신규: PR-189 6개, PR-191 4개) |
| `npm run typecheck` | clean | clean |
| `npm run build` | OK | OK |
| `npm run build:preview` | OK | OK |
| `dist-preview` forbidden-token | 0/8 | 0/8 |

## 회귀 위험 / 후속

### R33 회귀 위험

- **광고 보상 인플레이션** — 광고 무제한 + cap 면제로 heavy viewer 가
  하루 100+ 회 시청 시 carrot 인플레이션 가능. abuse 차단은 server-side
  enforcement (현재 client only) + 광고 SDK 측 일일 제한에 의존.
  → 정식 출시 시점에 worker 측에서도 ad source 면제 vs 캡 정책 재확정
  필요. 베타에서는 사용자 자유.
- **heart 사용 도파민 불균형** — heart 1개 → plot +1 stage 옵션은
  hourglass (1회 +1 stage) 와 동등 강도. juice (+5%p) 와 비교하면
  heart candy +10%p 가 2배 강함. 의도된 design (광고 무제한 시대의 heart
  사용 가치). 균형 깨지면 후속 PR 에서 +10%p → +7%p 조정 가능.
- **friend wave 보상 의미 유지** — heart +1 보상이 이제 부스트 자원
  source 가 되어 의미 자연 강화 (변경 없이도 OK).

### 후속 가능 작업

| ID | 한 줄 | 우선순위 |
| --- | --- | --- |
| R33+1 | worker `daily_caps` 테이블 ad source 면제 enforcement (server-side 권위) | 정식 출시 결정 후 |
| R33+2 | heart 부스트 강도 calibration (10%p → 7%p / plot +1 → +2 stage 등) — 실 사용 데이터 기반 | 베타 수치 분석 단계 |
| R33+3 | InventoryModal heart 슬롯에 부스트 안내 카피 보강 (현재는 effect 텍스트만) | 낮음 |

## 사용자 액션

1. AIT 콘솔에 새 .ait 업로드 후 실기 확인:
   - 광고 시청: heart 잔량 무관 항상 가능 + 5회 후 토큰 / 11회 이후
     carrot +1 small 적립 확인
   - 인벤토리 → 토큰 탭 → 💗 하트 → 사용하기 → HeartUseModal 진입
     → 옵션 2종 (candy +10%p / plot +1 stage) 선택
   - HeartUseModal 닫고 농장 plot 탭 → 수확 시 candy 확률 상승 확인
     (heart buff active 동안)
2. **abuse / 균형 모니터링**: 광고 무제한 + cap 면제로 heavy viewer 의
   carrot 인플레이션 가능. 베타 사용자 피드백 / 데이터 보고 시 균형
   재조정 가능.
