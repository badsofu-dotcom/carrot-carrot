-- 농장 상태 (farm state) — 토스 로그인 사용자별 9칸 텃밭 + 당근 재고.
--
-- 스키마는 0001_init.sql 의 users.user_key (PK, TEXT) 를 그대로 외래키로 쓴다.
-- 인벤토리: 한 사용자당 1행. 보유 당근 누적치를 보관.
-- 텃밭 칸: (user_key, slot_index) 복합 PK. slot_index 는 0..8.
--          stage 는 0(빈 밭) ~ 4(수확 가능).
--
-- 기존 0001_init.sql 가 FK CASCADE 를 사용하므로 동일 패턴 유지.
-- IF NOT EXISTS 로 멱등성 확보 — 수동 재실행 / partial-apply 시에도 안전.

CREATE TABLE IF NOT EXISTS farm_inventory (
  user_key    TEXT PRIMARY KEY REFERENCES users(user_key) ON DELETE CASCADE,
  carrots     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS farm_plots (
  user_key    TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  slot_index  INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 8),
  stage       INTEGER NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 4),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_key, slot_index)
);

CREATE INDEX IF NOT EXISTS farm_plots_user_idx ON farm_plots (user_key);
