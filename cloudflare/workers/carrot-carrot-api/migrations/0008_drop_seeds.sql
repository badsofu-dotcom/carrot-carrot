-- 0008 — Drop seeds column from farm_inventory (PR-117).
--
-- Client (PR-109) 가 씨앗 자원 완전 폐기. Worker schema 도 정리.
--
-- SQLite (D1) 가 `DROP COLUMN` 을 지원 (3.35+). Wrangler 의 D1 도
-- 동일 SQLite 빌드. 단 일부 dialect 는 미지원이라 try/catch 패턴 권장
-- — wrangler 가 fail 하면 메인테이너가 수동 cleanup.
--
-- Backwards-compatible: 미적용 worker 는 seeds 컬럼 유지 (해 없음).
-- 적용 후 worker code (src/lib/db.ts) 가 seeds 안 select / addSeeds
-- 미호출 → 컬럼 자체 안 봐도 됨.
--
-- 신규 worker 코드 deploy 와 본 마이그레이션 적용 순서:
--   1. (선) worker code deploy — seeds 안 읽음. 컬럼 존재해도 무해.
--   2. (후) `wrangler d1 migrations apply <DB>` — seeds 컬럼 drop.

ALTER TABLE farm_inventory DROP COLUMN seeds;
