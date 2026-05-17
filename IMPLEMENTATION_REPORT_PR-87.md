# IMPLEMENTATION_REPORT_PR-87.md — 모종삽 칩 씨앗 수량 표시

## 의도

모종삽 = 씨앗 심기 도구 → 사용자 인지: "심을 수 있는 횟수 = 보유 씨앗". 칩에 시각적 단서 추가.

## audit 결과 — plant() 는 씨앗 소비 안 함

`src/features/collection/farmStore.ts` plant() 함수 확인:
```ts
plant: (id) => {
  const s = get();
  if (s.stages[id] !== 0) return false;
  const next = s.stages.slice();
  next[id] = 1;
  set({ stages: next });
  ...
  return true;
}
```

**씨앗 검사 / 차감 없음**. 그리고 `itemMeta.ts` seed.effect = "농장 씨뿌리기 자원 (현재 무료, 향후 소비 예정)". 그래서 현재는 **plant 가 free**, 씨앗은 informational currency.

## 결정 (자율) — Phase 1: informational, no disable

| 옵션 | 결정 |
| --- | --- |
| Badge 표시 | "🌱 N" |
| 씨앗 0 → disabled | ❌ **NOT 적용** — plant() 가 free 라 disable 하면 plant 자체가 막힘 (현재 사용자 0 부터 시작) |
| Future Phase 2 | seed consumption wire 시 → 0 → disable + 토스트 패턴으로 전환 |

이 결정의 이유:
1. **현재 상태 일관성**: plant() 가 free 인데 칩만 disable 하면 의도 불일치
2. **future-proof**: seed consumption wire 시 단일 위치 (이 PR comment) 만 수정
3. **사용자 인지**: "🌱 N" 으로 시각 단서 충분, 추후 0 도달 시 의미 명확

## 변경

### ToolDock.tsx

```diff
+ const seeds = useFarmStore((s) => s.seeds);
...
+ if (t.id === "shovel") badge = `🌱 ${seeds}`;
...
+ aria-label={
+   t.id === "shovel" ? `모종삽 — 씨앗 ${seeds}개 보유`
+   : t.id === "watering_can" ? `물뿌리개 — 오늘 ${wateringLeft}/10 남음`
+   : t.label
+ }
...
- label: "삽",
+ label: "모종삽",  // 사용자 용어 일치, 씨앗 심기 의미 강화
```

| Test 시나리오 | Badge | 동작 |
| --- | --- | --- |
| seeds = 0 | "🌱 0" | 칩 선택 가능 (plant free) |
| seeds = 5 | "🌱 5" | 정상 |
| seeds = 1000 | "🌱 1000" | badge minWidth 18 + padding 4 + flex, 넓어짐 안전 |

(jsdom 부재로 unit test 불가, build/typecheck 통과로 회귀 차단.)

## 변경 파일

- `src/components/Farm/ToolDock.tsx` — seeds badge + aria-label + label rename

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 188 / 188 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## Round 13 후보

- **Phase 2: seed consumption wire** — `farmStore.plant()` 에 `if (seeds <= 0) return false; set({ seeds: seeds - 1 })` 추가. 동시에 ToolDock 의 shovel chip 도 disable 패턴 적용.
- 씨앗 0 일 때 plant 시도 toast — "씨앗이 없어요. 일일 선물 / 케이크 / 보석 교환으로 받아보세요"
