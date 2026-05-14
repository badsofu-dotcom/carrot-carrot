-- 0005 — Tool state: watering-can charges + ad-refill counter.
--
-- The user PK in this schema is `users.user_key` (TEXT). See 0001_init.
-- IF NOT EXISTS ensures idempotent partial-apply behavior under
-- wrangler.
--
-- Reset model:
--   `watering_can_resets_at` is a unix-second timestamp marking the
--   NEXT KST midnight. Worker reads this on every /tools/state call
--   and if `unixepoch() >= resets_at`, refreshes watering_can_left
--   back to 10 and ad_refills_today back to 0 then advances the
--   timestamp to the following midnight.
--
-- Migration is purely additive; no destructive ops. Safe to ship
-- without flushing existing farm_inventory / farm_plots rows.

CREATE TABLE IF NOT EXISTS tool_state (
  user_key                TEXT    PRIMARY KEY REFERENCES users(user_key) ON DELETE CASCADE,
  watering_can_left       INTEGER NOT NULL DEFAULT 10,
  watering_can_resets_at  INTEGER NOT NULL,
  ad_refills_today        INTEGER NOT NULL DEFAULT 0,
  updated_at              INTEGER NOT NULL DEFAULT (unixepoch())
);
