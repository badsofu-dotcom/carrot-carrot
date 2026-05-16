# IMPLEMENTATION_REPORT_PR-38.md — 도감 패시브 효과

도감 unlock 카운트에 비례한 누적 패시브. 도감을 "장식" 에서 "메타 진행" 으로 의미 부여.

## A. 패시브 매트릭스

| 임계 | 효과 | 적용 site |
| --- | --- | --- |
| 1 마리 | 캔디 확률 +0.1 %p | `rollHarvestGacha` opts |
| 5 마리 | 황금 확률 +0.1 %p | `rollHarvestGacha` opts |
| 10 마리 | 세션 당근 ×1.05 | 향후 HomePage focus reward wire |
| 15 마리 | 광고 보상 +1 carrot | `AdRewardChannelModal` N-th tier |
| 20 마리 | 일일 gift ×1.5 | 향후 `rollGift` consumer wire |
| 25 마리 | 일일 P 캡 100 → 110 | doc 갱신 (worker enforcement TBD) |

캐스케이드 (≥ N): 1마리 보유 시 1마리 효과만, 25마리 보유 시 1+5+10+15+20+25 모든 효과 활성.

## B. 변경 파일

### 신규
1. **`src/lib/dogamPassives.ts`** — `passivesFromOwned(count)` pure helper + `nextPassiveLabel(count)`.
2. **`src/lib/dogamPassives.test.mjs`** — 8 test 임계값별 활성화 + nextPassiveLabel.

### 수정
3. **`src/lib/seasonalBunny.ts`**:
   - `RollOpts` 에 `candyBonusP?` / `goldenBonusP?` 추가.
   - `rollHarvestGacha` 의 golden + candy band 에 옵셔널 bonus 누적.
4. **`src/features/collection/FarmHub.tsx`**:
   - `passivesFromOwned` import.
   - harvest 분기에서 `useCollectionStore.getState().ownedCharacters.length` 로 카운트 → passives 계산 → `rollHarvestGacha({ candyBonusP, goldenBonusP, ... })` 전달.
5. **`src/components/Inventory/AdRewardChannelModal.tsx`**:
   - `passivesFromOwned` import.
   - N-th tier carrot grant 직전 `adRewardBonusCarrot` 계산 + 모든 tier (1~5) 의 `farm.incCarrots()` 값에 추가.

## C. 잔여 wiring (향후 PR)

- **10 마리: sessionCarrotMul** — HomePage focus 완료 시 `growAllPlanted` carrot grant 에 곱하기. 현재 `getFocusFarmReward` 가 carrot 직접 grant 안 함 (harvest 만 grant) → 별도 reward path 추가 필요.
- **20 마리: giftBoostX** — `rollGift` 결과의 amount 를 multiplier 로 boost. consumer 측 (RewardsPanel onClaim) 에서 amount × X 적용.
- **25 마리: dailyCapBoost** — worker daily-cap enforcement 코드에서 100 + boost 적용. 현재 enforcement 미연결.

## D. 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | **101/101 pass** (PR-38 신규 8) |
| `npm run typecheck` | clean |
| `npm run build` | OK |

## E. 다음 작업

PR-37/36 reload (verify), PR-39 (docs ROADMAP), PR-40 (정합 검증).
