# IMPLEMENTATION_REPORT_PR-63.md — 도감 패시브 잔여 wire

PR-38 의 6 임계 중 wire 안 된 sessionCarrotMul / giftBoostX 추가.

## A. 패시브 wire 상태

| 임계 | 효과 | 이전 | 신규 (PR-63) |
| --- | --- | --- | --- |
| 1 마리 | 캔디 +0.1%p | ✅ PR-38 | ✅ |
| 5 마리 | 황금 +0.1%p | ✅ PR-38 | ✅ |
| 10 마리 | **세션 당근 ×1.05** | 🟡 미연결 | ✅ **PR-63** |
| 15 마리 | 광고 보상 +1 carrot | ✅ PR-38 | ✅ |
| 20 마리 | **일일 gift ×1.5** | 🟡 미연결 | ✅ **PR-63** |
| 25 마리 | 일일 P 캡 100 → 110 | 🟡 worker doc only | 🟡 (worker 미연결, 기록만) |

## B. 변경

### `src/features/collection/FarmHub.tsx` — sessionCarrotMul wire
- harvest 분기 마지막 `outcome.kind === "carrot"` 후 dogamOwned 가 10 이상이면 `Math.random() < 0.05` 시 추가 `incCarrots(1)`.
- 평균 효과 = base +1 carrot × 1.05 = 1.05 (확률적 +1).
- candy / golden outcome 도 base +1 carrot 그랜트 다음에 같은 경로 통과 — 모든 harvest 가 적용 대상.

### `src/components/Farm/RewardsPanel.tsx` — giftBoostX wire
- `onClaim` 의 `incCandy(reward.amount)` / `incGolden(reward.amount)` / `add("gem", reward.amount)` 모두 `Math.round(reward.amount * giftBoost)` 로 증폭.
- 20마리 미만 → `giftBoost === 1` → 변화 없음.
- 20마리 이상 → ×1.5. candy 1 → 1.5 → round 2 (= +5 P bonus). golden 1 → 1.5 → round 2 (= +10 P bonus). seed gift 는 본 path 안 옴 (별도 분기).
- `Math.max(1, ...)` 으로 round-down 안전.

## C. dailyCapBoost (25마리) 노트

Worker `/economy` 의 daily cap enforcement 코드가 현재 미연결 — `passivesFromOwned(count).dailyCapBoost` 는 ECONOMY_DESIGN.md 의 doc + UI 표시 (`AchievementsCard` 의 dogam_100 description) 에서만 surface. 실제 enforcement 는 worker wire PR 에서.

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 130 / 130 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
