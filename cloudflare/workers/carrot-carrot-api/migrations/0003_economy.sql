-- BunnyTime v2 — economy.
--
-- Pending points ledger + grant log + daily cap counters + rewarded-ad
-- audit. Migration is intentionally additive and idempotent
-- (CREATE TABLE IF NOT EXISTS). Do NOT apply automatically — wrangler
-- d1 migrations apply must be run by a human with the staging DB bound
-- and ALLOW_PROMOTION env vars set in cloudflare/workers/.../wrangler.toml.
--
-- See ECONOMY_DESIGN.md at the repo root for full design notes.

-- ----------------------------------------------------------------------
-- pending_points
--   One row per user. Tracks the running balance of points that are
--   waiting to be sent to Toss as a promotion (executePromotion).
--   The lifetime balance is computed from point_grants - withdrawals.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_points (
  user_key       TEXT PRIMARY KEY REFERENCES users(user_key) ON DELETE CASCADE,
  pending        INTEGER NOT NULL DEFAULT 0 CHECK (pending >= 0),
  lifetime_total INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_total >= 0),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ----------------------------------------------------------------------
-- point_grants
--   Append-only ledger. Every successful "carrot → point" conversion,
--   rewarded-ad reward, or daily quest reward is one row.
--   - source: "carrot_harvest" | "rewarded_ad" | "daily_quest" | "admin"
--   - kind:   "candy" (+5p), "golden" (+10p), "carrot" (+1p)
--   - amount: integer points (positive)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS point_grants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key    TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  ymd         TEXT NOT NULL, -- "YYYY-MM-DD" KST — for daily-cap aggregation
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS point_grants_user_idx
  ON point_grants (user_key, created_at);
CREATE INDEX IF NOT EXISTS point_grants_user_ymd_idx
  ON point_grants (user_key, ymd);

-- ----------------------------------------------------------------------
-- daily_caps
--   Tracks per-day grant totals to enforce anti-abuse caps. One row per
--   (user, ymd) — kept independent of point_grants so reads stay O(1).
--   - carrot_count: number of carrots harvested today (cap eg. 24)
--   - reward_points_total: sum of points granted today (cap eg. 50)
--   - ad_views_today: number of rewarded ads watched (cap eg. 10)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_caps (
  user_key            TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  ymd                 TEXT NOT NULL,
  carrot_count        INTEGER NOT NULL DEFAULT 0,
  reward_points_total INTEGER NOT NULL DEFAULT 0,
  ad_views_today      INTEGER NOT NULL DEFAULT 0,
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_key, ymd)
);

CREATE INDEX IF NOT EXISTS daily_caps_ymd_idx ON daily_caps (ymd);

-- ----------------------------------------------------------------------
-- ad_views
--   Audit log of rewarded-ad attempts. ALL attempts are logged, including
--   dismissed / failed ones. A reward is granted only when status='completed'
--   and is recorded as a separate point_grants row, never inline here.
--   - placement: "farm_card" | "report_bonus" | ...
--   - status: "started" | "completed" | "dismissed" | "error"
--   - network: "tossads" | "admob" | "mock"
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_views (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key    TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  placement   TEXT NOT NULL,
  network     TEXT NOT NULL,
  status      TEXT NOT NULL,
  reward_id   INTEGER, -- nullable FK to point_grants(id) when completed
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS ad_views_user_idx ON ad_views (user_key, created_at);

-- ----------------------------------------------------------------------
-- promotion_withdrawals
--   Persists every executePromotion call result. Reconciliation log so
--   we can prove to Toss / the user what was sent and what came back.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotion_withdrawals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key    TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  toss_txid   TEXT,
  status      TEXT NOT NULL, -- "pending" | "succeeded" | "failed"
  failure     TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  settled_at  INTEGER
);

CREATE INDEX IF NOT EXISTS withdrawals_user_idx
  ON promotion_withdrawals (user_key, created_at);
