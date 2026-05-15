-- 0007 — Friends / visitor bunny.
--
-- Additive migration. Existing user_key (TEXT PK) is the FK target;
-- no destructive changes to 0001..0006.
--
-- NOT applied automatically; the maintainer must run:
--   wrangler d1 migrations apply carrot-carrot-db            (local)
--   wrangler d1 migrations apply carrot-carrot-db --remote   (production)
--
-- Idempotent via IF NOT EXISTS so partial-applies are safe to retry.

-- ----------------------------------------------------------------------
-- friend_visits — one row per (user_key, KST ymd). The PK enforces
--   "at most one wave per day" semantics. Inserted by POST /friends/wave;
--   GET /friends/today computes the visitor deterministically (does NOT
--   insert) so reads stay idempotent.
--
-- Columns:
--   visitor_bunny_id: which bunny showed up today (deterministic pick
--                     from the existing CHARACTERS roster — see
--                     cloudflare/.../src/lib/visitorRng.ts).
--   hearts_gained:    how many hearts the wave dropped (currently
--                     always 1 in v1 — value preserved for analytics +
--                     future weighting).
--   waved_at:         server timestamp of the wave action.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_visits (
  user_key         TEXT    NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  ymd              TEXT    NOT NULL,
  visitor_bunny_id TEXT    NOT NULL,
  hearts_gained    INTEGER NOT NULL DEFAULT 1 CHECK (hearts_gained >= 0),
  waved_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_key, ymd)
);

CREATE INDEX IF NOT EXISTS friend_visits_user_idx
  ON friend_visits (user_key, ymd);
