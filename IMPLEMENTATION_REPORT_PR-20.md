# IMPLEMENTATION_REPORT_PR-20.md — 씨앗 자원 헤더 노출 (옵션 A)

## A. 진단

`seeds` 소비처 grep 결과:

| 액션 | 효과 | 소비? |
| --- | --- | --- |
| `farmStore.plant(id)` | 빈 plot → 1 단계로 변경 | ❌ 소비 안 함 (seeds 필드 변화 없음) |
| `growAllPlanted(steps, snap, seedDelta)` | seedDelta > 0 일 때 `seeds += delta` (Math.max(0, ...)) | ❌ 증가만 |
| 신규 `spendSeed` / `consumeSeed` / `subtractSeed` | 없음 | — |

**소비처 없음.** 다만 다섯 경로에서 grant 됨:
1. Daily gift (60 % +1, 6 % +3)
2. Focus tier `seedDelta` (1/2/3 분 단계별)
3. Cake buff (+1, PR-10)
4. Weekly treasure 추첨 (+3)
5. Gem 5→1 교환 (PR-7)

## B. 결정 — 옵션 A

사용자 spec: "사용처 없으면 → 옵션 B (제거)" 였으나, seeds 가 **5 경로의 grant SoT** 로 이미 깊이 연결됨. 제거 시:
- giftRoll.ts 60+6=66 % 배합 재구성
- farmRules.ts seedDelta + 모든 호출자 정리
- cake buff 효과 다른 보상으로 교체
- 모든 UI 푸터 노출 (InventoryModal, RewardsPanel) 제거
→ 대규모 invasive 변경 + 게임 밸런스 영향.

**문제의 근본 원인은 가시성 부족** (사용자 표현: "씨앗 잔여량 확인 못 함"). 헤더 chip 추가로 즉시 해소되고, 향후 sink (예: 친구에게 선물, 10 seeds = 1 candy) 가 추가될 때 그대로 활용 가능.

옵션 A 채택.

## C. 변경

- `src/pages/CollectionPage.tsx`:
  - `FarmView` 가 `useFarmStore(s => s.seeds)` 구독.
  - 헤더 inventory 영역에 4번째 `<CurrencyChip label="씨앗">` 추가. icon = `crop_stage1_seed.webp` (기존 자산), emoji fallback = 🌱.
  - aria-label 에 "씨앗 N 개" 추가.

소비 sink 는 본 PR 범위 밖.

## D. 폭 검증

375 px viewport 기준:
- main padding 좌우 12 × 2 = 24
- 가용 폭 351
- 우측 도감 버튼 (~120) + 보상함 (32) + gap 6 = ~160
- 좌측 4 chips: icon 18 + count text + gap 4 ≈ 35 px/chip × 4 + gap 10 × 3 = 170
- **합계 330 + gap 8 (양쪽 컨테이너 사이) = 338 < 351** → fit

## E. 5-command 결과

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 93/93 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## F. 다음 작업

PR-19 (DEV 패널 대확장 — production 빌드에서 dead-code-eliminate 보장).
