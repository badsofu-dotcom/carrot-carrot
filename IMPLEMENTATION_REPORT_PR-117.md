# IMPLEMENTATION_REPORT_PR-117.md — Worker schema 정리 (씨앗 컬럼)

Client PR-109 (Round 14) 의 worker-side 정리.

## 변경

### `migrations/0008_drop_seeds.sql` (신규)

```sql
ALTER TABLE farm_inventory DROP COLUMN seeds;
```

D1 (SQLite 3.35+) 가 `DROP COLUMN` 지원. 메인테이너가 수동 적용:
```bash
wrangler d1 migrations apply <DB_NAME>
```

### `src/lib/db.ts`

- `FarmState.seeds` 필드 제거
- `selectInventoryWithSeeds` helper 제거 → `getFarmState` 가 단순 `SELECT carrots` 만
- `addSeeds()` 제거

### `src/routes/farm.ts`

- `/state`, `/plant`, `/grow`, `/harvest` 응답에서 `seeds` 필드 제거
- `/grow` body 의 `seedDelta` param 무시 (구 클라 호환 — body 가 와도 fail 안 함)

## Deploy 순서 (메인테이너)

worker code 와 schema 변경의 안전 순서:

1. **선**: worker code deploy (`wrangler deploy`)
   - 새 코드: seeds 컬럼 안 select, addSeeds 미호출
   - 기존 seeds 컬럼 존재해도 무해
2. **후**: migration 적용 (`wrangler d1 migrations apply <DB>`)
   - 컬럼 drop

순서 바뀌면 (migration 먼저) — 기존 worker code 가 `SELECT seeds` 시도 시 fail (try/catch 가 fallback 처리하지만 안전 마진 낮음).

## 5-command

| 명령 | 결과 |
| --- | --- |
| `node --test src/lib/*.test.mjs` | 247 / 247 pass |
| `npm run typecheck` | clean |
| `npm run build` | OK |
| `npm run build:preview` | OK |

(worker 별도 빌드/테스트 없음 — 메인테이너가 wrangler 로 검증)
