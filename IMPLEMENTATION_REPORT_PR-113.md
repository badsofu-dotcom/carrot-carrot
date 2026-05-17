# IMPLEMENTATION_REPORT_PR-113.md — cap-reached UI 보강 + GemTrade earned 검증

## A. GemTrade earned 검증 (audit only)

GemTradeModal 5 옵션 중 P-bearing grant 가 dailyCap 안에 들어오는지 검증:

| 옵션 | Grant | farmStore inc* 거침? | addPoints 호출? |
| --- | --- | --- | --- |
| candy3 | `incCandy(3)` | ✅ | ✅ candy × 5 = 15 P |
| grow | `growAllPlanted(1, ...)` | n/a (no P) | n/a |
| session | `incCarrots(25)` | ✅ | ✅ carrot × 1 = 25 P |
| golden | `incGolden(1)` | ✅ | ✅ golden × 10 = 10 P |
| legend | `forceUnlock` / `add("gem", ...)` | n/a (medal/item only) | n/a |

**모든 P-bearing grant 가 farmStore inc* 거치므로 cap 자동 counted.** GemTrade 우회 없음. ✅

## B. cap-reached UI 보강 — 1회 toast

이전: RewardsPanel 의 DailyCapProgress 카드가 cap 도달 시 "🌙 오늘은 푹 쉬어요" 표시. 사용자가 RewardsPanel 안 열면 인지 어려움.

PR-113 추가: **첫 cap-cross 시 1회 toast** (KST day 별).

### 신규 — `dailyCap.ts`

```ts
export const CAP_REACHED_EVENT = "cc:cap:reached";

// addPoints 내부:
if (next.earned >= cap) {
  const flagKey = `${CAP_TOASTED_KEY}.${today}`;
  if (safeStorage.get(flagKey) !== "1") {
    safeStorage.set(flagKey, "1");
    window.dispatchEvent(new CustomEvent(CAP_REACHED_EVENT));
  }
}
```

KST 일자 별 flag — 매일 첫 cap-cross 만 dispatch. 자정 rollover 시 자동 reset (addPoints day mismatch 분기에서 remove).

### Listener — `HomePage.tsx`

```ts
useEffect(() => {
  const onCapReached = () => {
    toast("🌙 오늘 100 P 다 모았어요. 자정에 다시 시작!", { duration: 4000 });
  };
  window.addEventListener(CAP_REACHED_EVENT, onCapReached);
  return () => window.removeEventListener(CAP_REACHED_EVENT, onCapReached);
}, []);
```

홈탭 마운트 시 listener 등록. 사용자가 RewardsPanel 열지 않아도 첫 cap-reach 시 1회 안내.

## Tests

`dailyCap.test.mjs` 에 2 신규 케이스 추가:
- `CAP_REACHED_EVENT` 상수 export
- addPoints cap-cross 동작 (Node 환경에서 SSR-guard, throw 없음)

총 **247 / 247 pass**.

## 변경 파일

- `src/lib/economy/dailyCap.ts` — CAP_REACHED_EVENT export + dispatch logic
- `src/pages/HomePage.tsx` — event listener + toast
- `src/lib/dailyCap.test.mjs` — 2 신규 tests

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 247 / 247 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |
