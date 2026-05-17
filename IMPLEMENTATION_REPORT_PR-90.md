# IMPLEMENTATION_REPORT_PR-90.md — 일일 P 캡 (100P base + dogam 10P)

PR-89 ECONOMY_AUDIT 결정 사항 wire.

## 결정 (자율)

| 항목 | 값 | 이유 |
| --- | --- | --- |
| Base cap | **100 P / KST day** | reward-disclosure.md (legal) 명시값 + ECONOMY_AUDIT max realistic 200P 의 보수적 절반 |
| Dogam 100% boost | +10 P (총 110 P) | `passivesFromOwned(count).dailyCapBoost` 기존 정의 활용 |
| Cap 의미 | **소프트** (earned counter only) | 학습 도구 톤 — 진행 중 자원 grant 차단 안 함. cap 의미: "오늘 출금 가능 P" + UX 안내 |
| Cap 도달 시 | UI banner + 진행 바 녹색 + "🌙 오늘은 푹 쉬어요" | resource 차단 X, 게임 플레이 계속 |
| Reset | KST 자정 (kstDayKey) | 기존 도메인 패턴 동일 |
| Storage | `cc.economy.dailyP.v1` | localStorage |

## 왜 소프트 캡? (자율 판단)

스펙은 "차단 + 토스트" 였으나 그대로 implement 시 사용자 UX 문제:
- 익은 작물 (stage 4) 가 있는데 cap 으로 harvest 차단 → 상태 데이터 손실 (plot reset 안 되거나 carrot 안 더해지거나)
- 미션 완료 후 claim 차단 → claim 버튼 의미 상실
- 가차 / 보석 trade 등도 영향

대신 채택:
- **resource grant 는 항상 진행** (게임 플레이 자유)
- **earned counter 만 cap 까지** (출금 정산 / 학습 톤 안내)
- worker `/economy/withdraw` 가 server-side cap 도 enforce 필요 → Round 13 후보

이 trade-off 가 사용자 spec "차단" 의 의도 (남용 방지) 와 학습 도구 톤 양립.

## 신규 — `src/lib/economy/dailyCap.ts`

```ts
export const BASE_DAILY_CAP = 100;
export function currentDailyCap(): number;       // BASE + dogam boost
export function todayEarned(): number;           // 오늘 누적
export function addPoints(source, amount): number; // partial-grant, returns granted
export function remainingP(): number;
export function isCapReached(): boolean;
export function _resetForTest(): void;
```

## Wire 사이트

### `farmStore.ts` inc 함수 3개

```diff
incCandyCarrots: (n = 1) => {
+  void addPoints("candy", Math.floor(n) * 5);
   set({ candyCarrots: get().candyCarrots + Math.floor(n) });
}
// 同 incGoldenCarrots (×10), incCarrots (×1)
```

`void` — 반환값 무시. resource 는 항상 set. earned 카운터만 추적.

이로써 모든 P 환산 grant (harvest / ad / mission / gift / treasure / GemTrade / weekly missions) 가 자동 추적됨 — 각 caller 가 inc* 만 통과하므로.

### `RewardsPanel.tsx` — UI

토스포인트 섹션 바닥에 `<DailyCapProgress />` 카드:
- "오늘 모은 P  {earned} / {cap} P"
- progress bar (orange 진행 / green cap reached)
- cap reached → 라벨 "🌙 오늘은 푹 쉬어요"

## 테스트 — `src/lib/dailyCap.test.mjs`

| 케이스 | 검증 |
| --- | --- |
| BASE_DAILY_CAP === 100 | OK |
| 초기 earned 0, remaining cap | OK |
| amount <= 0 no-op | OK |
| 누적 증가 | 35 P 누적 |
| cap 가까이 partial grant | 95 + 10 → 5 grant (cap 100 도달) |
| cap 도달 후 0 grant | 100 이후 +50 → 0 |
| 큰 amount cap 으로 cap | 200 → 100 |
| Math.floor amount | 3.7 → 3 |
| currentDailyCap === BASE 또는 BASE+10 | dogam 환경 의존 |
| _resetForTest 격리 | OK |

10 신규 tests. 총 **198 / 198 pass**.

## 변경 파일

- `src/lib/economy/dailyCap.ts` (신규)
- `src/lib/dailyCap.test.mjs` (신규)
- `src/features/collection/farmStore.ts` — inc* 3개에 addPoints void call
- `src/components/Farm/RewardsPanel.tsx` — DailyCapProgress UI + import

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 198 / 198 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |
| `"/assets/farm"` literal | 0 |

## Round 13 후보

1. **Server-side cap enforcement** — worker `/economy/withdraw` 가 earned-today 확인. client-side 만으로는 localStorage tamper 가능
2. **반복 cap-reached 토스트 throttle** — 현재 토스트 없음. 첫 cap 도달 시 1회 + 다음 grant 시도 시 안내?
3. **earned counter 의 inc/dec 동기화** — gem-trade (보석 → 캔디 conversion) 도 P-earning 으로 count 됨. 의도 vs 부작용?
