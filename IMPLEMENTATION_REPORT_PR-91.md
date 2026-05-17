# IMPLEMENTATION_REPORT_PR-91.md — 모래시계 사용 가드 (작물 없음 / 만렙 시 차단)

## 발견 (사용자 보고)

InventoryModal "모래시계 사용하기" 가 effect 없는 케이스에서도 아이템 소비:
- 빈 밭 (모든 plot stage 0) → `growAllPlanted(1, ...)` 가 `grown = 0` 반환, set state 안 함, 그러나 caller (InventoryModal.onUse) 가 이미 `consume()` 호출 → 아이템 낭비.
- 만렙 (모든 plot stage 4) → 同上.

## 신규 — `src/lib/farmHelpers.ts`

순수 predicate 4 종 (pure, side-effect 없음):

| Function | 의미 |
| --- | --- |
| `canGrowAnyStages(stages)` | stage 1..3 (성장 중) 인 plot 이 1개 이상이면 true |
| `isFarmEmpty(stages)` | 모든 plot stage 0 |
| `isFarmAllRipe(stages)` | 빈 plot 없이 모두 stage 4 |
| `hourglassBlockReason(stages)` | `"empty"` / `"all-ripe"` / `"all-grown-mixed"` / `null` |

3 분기 매트릭스:
- `empty`: 모두 0 (빈 밭)
- `all-ripe`: 빈 plot 없이 모두 4 (완전 만렙)
- `all-grown-mixed`: 빈 plot 도 있지만 심은 건 모두 4 (혼합 — 효과 0)

## Wire — `InventoryModal.tsx`

### onUse 가드 (consume 전)

```ts
if (code === "hourglass") {
  const stages = useFarmStore.getState().stages;
  const reason = hourglassBlockReason(stages);
  if (reason === "empty") {
    toast("심은 작물이 없어요. 씨앗을 심고 다시 시도해주세요");
    return;  // consume 안 함
  }
  if (reason === "all-ripe" || reason === "all-grown-mixed") {
    toast("이미 모든 작물이 다 자랐어요");
    return;
  }
}
// consume + apply...
```

### ActionBar 시각 가드 (사전 시각 신호)

| reason | label | disabled |
| --- | --- | --- |
| `null` | "사용하기" | false |
| `"empty"` | "심은 작물 없음" | true |
| `"all-ripe"` 또는 `"all-grown-mixed"` | "모두 다 자람" | true |

button background → grey, cursor → not-allowed (기존 `canUse=false` 패턴 재사용).

## 테스트

`src/lib/farmHelpers.test.mjs` — 12 케이스:

| 함수 | 케이스 |
| --- | --- |
| canGrowAnyStages | 모두 0 / 모두 4 / 1..3 하나라도 |
| isFarmEmpty | 모두 0 / 부분 |
| isFarmAllRipe | 모두 4 / mixed / 빈 밭 |
| hourglassBlockReason | empty / all-ripe / all-grown-mixed / null |

12 신규 tests. 총 **210 / 210 pass** (198 → 210).

## 변경 파일

- `src/lib/farmHelpers.ts` (신규)
- `src/lib/farmHelpers.test.mjs` (신규)
- `src/components/Inventory/InventoryModal.tsx` — onUse 가드 + ActionBar reason 시각화

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 210 / 210 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
