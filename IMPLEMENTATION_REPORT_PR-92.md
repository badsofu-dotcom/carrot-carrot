# IMPLEMENTATION_REPORT_PR-92.md — 도구 재설계 (수프 / 케이크 / 번개 audit)

PR-91 모래시계 가드 이어서 — 도구 효과 재설계 + 번개 audit.

## 변경 매트릭스

| 도구 | Before | After (PR-92) |
| --- | --- | --- |
| 🍲 수프 | 다음 물뿌리개 충전 +1 차지 (한도 11/10) | 다음 수확 황금당근 +5%p (당근주스의 황금 버전) |
| 🍰 케이크 | 다음 포커스 완료 시 씨앗 +1 | 다음 포커스 완료 시 모든 농장 보상 1.5배 |
| ⚡ 번개 | 물뿌리개 +3 충전 | (유지 — audit 결과 의도 명확) |
| 🥤 주스 | 다음 수확 캔디 +5%p | (변경 없음 — 수프의 대칭 reference) |
| ⏳ 모래시계 | 작물 1단계 성장 | (PR-91 가드 추가, 효과 동일) |

## 수프 재설계 — 황금당근 +5%p

### 왜?
- 이전 효과: "한도 일시 상승" 직관 약함, 학습 도구 톤에 distant.
- 새 효과: 주스 (캔디 +5%p) 의 자연스러운 황금 버전. **대칭 디자인** — 사용자가 "주스 = 캔디, 수프 = 황금" 으로 단순 매핑.

### 구현

**`src/lib/seasonalBunny.ts`**:
- `SOUP_GOLDEN_BONUS = 0.05` (새 상수, JUICE_CANDY_BONUS 와 동일 값)
- `RollOpts.soupActive?: boolean` 추가
- `rollHarvestGacha()`: golden bucket 에 `+= SOUP_GOLDEN_BONUS` 적용

**`src/features/collection/FarmHub.tsx`** harvest path:
```ts
const soupActive = useBuffsStore.getState().consume("soup");
const outcome = rollHarvestGacha({
  juiceActive,
  soupActive,  // 신규
  ...
});
```

**구버전 효과 제거**:
- `InventoryModal.tsx` bolt case — soup combo (`+1 if soup`) 삭제 → 단순 +3 charge
- `AdRewardChannelModal.tsx` watering case — 同上

## 케이크 재설계 — 모든 보상 1.5배

### 왜?
- 이전 효과: +1 seed 가 너무 사소 (seed = 0P, 거의 무의미)
- 새 효과: 다음 포커스 완료 시 모든 농장 보상 (growSteps × 1.5 + seedDelta × 1.5)
- 일일 P 캡 (PR-90) 안에서 자동 cap — 캡 우회 불가

### 구현

**`src/pages/HomePage.tsx`** focus complete:
```ts
const cakeActive = useBuffsStore.getState().consume("cake");
const mul = cakeActive ? 1.5 : 1;
const effectiveSteps = Math.ceil(reward.growSteps * mul);
const effectiveSeed = Math.ceil(reward.seedDelta * mul);
useFarmStore.getState().growAllPlanted(effectiveSteps, lastSnapshot.at, effectiveSeed);
```

`Math.ceil` — 사용자 유리 (생산성 보상). growSteps 는 stage cap (max 4) 으로 추가 보호.

### 1.5× 적용 매트릭스 (focus tier)

| 분 | grow / seed (base) | grow / seed (cake) |
| --- | --- | --- |
| 5-14 | 1 / 0 | 2 / 0 (Math.ceil(0×1.5)=0) |
| 15-29 | 1 / 1 | 2 / 2 |
| 30-49 | 2 / 2 | 3 / 3 |
| 50+ | 3 / 3 | 5 / 5 (growSteps 5 면 stage cap 4 가 더 빨리 도달) |

캐러트 직접 증가는 없음 (focus tier 자체가 카로트 grant 안 함, 카로트는 harvest 시점). seed×1.5 가 미래 수확 + tier 보상 양쪽 amplify.

## 번개 audit

### 현재 효과
- bolt → `refillFromAd(0)` (+3 물뿌리개 charges, 광고 카운터와 분리)
- 사용자 인지: "전기 = 즉시 충전" — 직관 명확

### 결정: **유지** (자율 판단)

이유:
1. 효과 명확 (전기 = 충전)
2. 변경 시 다른 시스템 영향 (광고 채널 / soup combo / wateringCanLeft 등)
3. 사용자 spec "직관 약하면 재설계" — 직관 명확하므로 변경 불필요

대안 검토 ("+5분 포커스 연장" / "휴식 즉시 종료") 는 타이머 모듈 수정 필요 → 위험 대비 가치 낮음.

`itemMeta.ts` longDescription 만 마이너 polish (기존 그대로 유지).

## 테스트

`src/lib/seasonalBunny.test.mjs` PR-92 신규 4 케이스:

| 케이스 | 검증 |
| --- | --- |
| SOUP_GOLDEN_BONUS 양수 + JUICE 와 동일 | 대칭 디자인 |
| soup buff golden bucket 확장 | rng 0.04 → soup 없으면 candy, 있으면 golden |
| soup 는 candy bucket 영향 없음 | rng 0.08 → 양쪽 candy |
| soup + juice 동시 — 각자 자기 bucket | 0.04 → golden (soup 우선) |

4 신규 tests. 총 **214 / 214 pass**.

## 변경 파일

- `src/features/buffs/buffEffects.ts` — soup/cake description 갱신
- `src/features/collection/itemsStore.ts` — soup/cake effect 갱신
- `src/lib/itemMeta.ts` — soup/cake longDescription 갱신
- `src/lib/seasonalBunny.ts` — soupActive RollOpts + SOUP_GOLDEN_BONUS + roll 분기
- `src/lib/seasonalBunny.test.mjs` — 4 신규 tests
- `src/features/collection/FarmHub.tsx` — soup consume + roll 파라미터
- `src/components/Inventory/InventoryModal.tsx` — bolt soup combo 제거
- `src/components/Inventory/AdRewardChannelModal.tsx` — watering soup combo 제거 + useBuffsStore import 정리
- `src/pages/HomePage.tsx` — cake 1.5× 적용

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 214 / 214 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## 일일 P 캡 정합성 (PR-90 과 동기)

- 수프 효과 (황금당근 grant) → `incGoldenCarrots(1)` 호출 → addPoints("golden", 10) 자동 적용
- 케이크 효과 (씨앗 ×1.5, growSteps ×1.5) → seed 는 P=0, growSteps 는 stage 변화만 (직접 P grant 없음). 추후 harvest 가 incCarrots 호출 시 addPoints 자동 적용
- **캡 우회 없음** — 모든 P-bearing grant 가 farmStore inc* 거침
