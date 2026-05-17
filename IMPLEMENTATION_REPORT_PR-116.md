# IMPLEMENTATION_REPORT_PR-116.md — Worker `/economy/grant` server-side cap

## 동기

Round 14 PR-90 의 client-side `dailyCap` 은 localStorage tamper 가능. Beta ship 전 server 가 권위 있는 quota 관리 필요.

## 신규 — Worker route `/economy/grant`

`cloudflare/workers/carrot-carrot-api/src/routes/economy.ts` 에 추가:

```ts
POST /economy/grant
Body: { source: string, points: number }
Response: { ok, data: { granted, totalToday, cap, capReached } }
```

동작:
1. requireUser 로 JWT 검증
2. KST `ymd` 기준 daily_caps 조회
3. bunnies_owned 카운트로 cap 계산 (12+ 시 +10P)
4. `granted = min(requested, cap - currentTotal)`
5. granted > 0 시 3-step transaction:
   - UPSERT daily_caps.reward_points_total += granted
   - INSERT point_grants (append-only ledger)
   - UPSERT pending_points.pending/lifetime_total += granted

기존 schema 활용 (migration 0003) — 새 migration 불필요.

## 신규 — Client adapter `grantSync.ts`

```ts
export function grantOnServer(source: string, points: number): void
```

Fire-and-forget. `apiCall` 통한 POST. canCallServer 가 false (게스트 / API 미설정 / Node 환경) 면 silent return.

## Wire — `dailyCap.ts`

```diff
const grant = Math.min(Math.floor(amount), cap - state.earned);
const next = { day: state.day, earned: state.earned + grant };
save(next);
+ // PR-116 — fire-and-forget server grant (권위 quota tracking).
+ grantOnServer(source, grant);
```

Client cap 통과 → server 호출. Server cap 미달 시 grant + record. 초과 시 server-side partial. 클라 게임 흐름 영향 없음.

## 보안 모델

| Layer | 역할 |
| --- | --- |
| Client `dailyCap` | UX 진행도 + 학습 톤 안내 ("🌙 오늘 100P 다 모았어요") |
| Server `/economy/grant` | 권위 quota — withdraw 시 사용할 pending_points 의 진실 |
| Tamper 대비 | localStorage 조작 시 client 만 속음. server pending_points 가 정확 |
| 출금 (`/economy/withdraw`) | pending_points 기반 — server 가 결정 |

→ 사용자가 localStorage 의 earned 카운터를 0 으로 재설정해도 server pending_points 는 보존. 출금 시 server quota 적용.

## Migration 불필요

- `daily_caps` (PR-32 의 0003) 이미 존재 — `reward_points_total` 컬럼 활용
- `point_grants` 이미 존재 — kind='p' 로 source 기록
- `pending_points` 이미 존재 — UPSERT

기존 schema 그대로 사용. 새 migration 추가 없음.

## 변경 파일

- `cloudflare/workers/carrot-carrot-api/src/routes/economy.ts` — `/grant` route + serverKstYmd helper
- `src/lib/economy/grantSync.ts` (신규) — client adapter
- `src/lib/economy/dailyCap.ts` — addPoints 가 grantOnServer 호출

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 247 / 247 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |
| forbidden token scrub | 0 |

## Worker 적용 단계 (수동)

```bash
# Worker 디플로이 (메인테이너 수동, 클로드는 안 함)
cd cloudflare/workers/carrot-carrot-api
wrangler deploy
```

NOTE: CLAUDE.md 정책상 클로드는 wrangler 명령 실행 금지. 메인테이너가 직접.
