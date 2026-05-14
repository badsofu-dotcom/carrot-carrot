-- 0006 — Items, gift box, treasure box, bunny collection, sky visits.
--
-- Additive migration. Existing user_key (TEXT PK) is the FK target;
-- no destructive changes to 0001..0005.
--
-- NOT applied automatically; the maintainer must run:
--   wrangler d1 migrations apply <DB_NAME>            (local)
--   wrangler d1 migrations apply <DB_NAME> --remote   (production)
--
-- Idempotent via IF NOT EXISTS so partial-applies are safe to retry.

-- ----------------------------------------------------------------------
-- user_items — 13-slot inventory (carrot/candy/golden/carrot_bag/
--   carrot_coin/hourglass/bolt/juice/soup/cake/medal/star/gem/heart).
--   `code` is one of the ItemCode strings in src/features/collection/
--   itemsStore.ts. Count is a non-negative integer.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_items (
  user_key   TEXT    NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  code       TEXT    NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_key, code)
);

-- ----------------------------------------------------------------------
-- gift_box_state — once-per-KST-day claim flag.
--   `last_claim_ymd` is "YYYY-MM-DD" KST. If matches today, the user
--   can't open the daily gift again.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gift_box_state (
  user_key       TEXT PRIMARY KEY REFERENCES users(user_key) ON DELETE CASCADE,
  last_claim_ymd TEXT,
  total_claims   INTEGER NOT NULL DEFAULT 0,
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ----------------------------------------------------------------------
-- treasure_box_state — progress accumulates 1 per ad/harvest tier;
--   at 7 the player can `open` and roll the WEEKLY_TREASURE_TABLE.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treasure_box_state (
  user_key   TEXT PRIMARY KEY REFERENCES users(user_key) ON DELETE CASCADE,
  progress   INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  opens      INTEGER NOT NULL DEFAULT 0 CHECK (opens >= 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ----------------------------------------------------------------------
-- bunny_collection — owned bunny ids per user. Compound key so we
--   can never double-record. Owned timestamp + tier for analytics.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bunny_collection (
  user_key   TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  bunny_id   TEXT NOT NULL,
  tier       TEXT NOT NULL,  -- "common"|"rare"|"epic"|"legendary"
  owned_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_key, bunny_id)
);
CREATE INDEX IF NOT EXISTS bunny_collection_user_idx
  ON bunny_collection (user_key);

-- ----------------------------------------------------------------------
-- sky_visits — per-day visit count + accumulated seconds. The
--   `quiet_sky` medal unlocks at 5 minutes total across all days.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sky_visits (
  user_key     TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  ymd          TEXT NOT NULL,    -- "YYYY-MM-DD" KST
  visit_count  INTEGER NOT NULL DEFAULT 0,
  seconds      INTEGER NOT NULL DEFAULT 0,
  /** First-visit-of-day event override picked at sky-view open. Stored
      so re-opens within the same KST day re-use the same scene. */
  event        TEXT,
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_key, ymd)
);

-- ----------------------------------------------------------------------
-- ad_redeem_nonces — anti-replay guard for AdRewardChannelModal's
--   nonce-based idempotency. (Optional; the channel modal also uses
--   `cc.ad.<channel>.<ymd>` as a coarse local key.)
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_redeem_nonces (
  nonce      TEXT PRIMARY KEY,
  user_key   TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  channel    TEXT NOT NULL,    -- "watering"|"gift"|"treasure"
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS ad_redeem_user_idx
  ON ad_redeem_nonces (user_key, channel);
