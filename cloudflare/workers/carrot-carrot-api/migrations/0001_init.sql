-- 버니타임 — Cloudflare D1 초기 스키마.
-- 사용자 매핑:
--   토스 미니앱은 OAuth(authorizationCode -> access_token) 로 `userKey` 를 돌려준다.
--   해당 userKey 는 base64(AES-256-GCM) 로 암호화되어 있어 Worker 가 복호화한 평문을
--   `users.user_key` 에 그대로 넣는다 (PK). name/email 은 평문으로 보관하지 않고
--   복호화된 텍스트를 그대로 저장하는 대신, 향후 키 회전을 위해 *_encrypted 컬럼명을 유지한다.

-- ============ users ============
CREATE TABLE IF NOT EXISTS users (
  user_key        TEXT PRIMARY KEY,
  name_encrypted  TEXT,
  email_encrypted TEXT,
  gender          TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============ focus_sessions ============
-- 25분 (또는 변형) 집중 시도 1회. 성공/중단 모두 기록.
CREATE TABLE IF NOT EXISTS focus_sessions (
  session_id      TEXT PRIMARY KEY,
  user_key        TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  duration_seconds INTEGER,
  target_seconds  INTEGER NOT NULL DEFAULT 1500,
  status          TEXT NOT NULL DEFAULT 'running'
                   CHECK (status IN ('completed','abandoned','running')),
  carrots_earned  INTEGER NOT NULL DEFAULT 0,
  client_id       TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS focus_sessions_user_started_idx
  ON focus_sessions (user_key, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_client_id_unique
  ON focus_sessions (user_key, client_id) WHERE client_id IS NOT NULL;

-- ============ carrot_collection ============
-- 사용자가 보유한 토끼 변형. 같은 종류를 여러 마리 보유 가능.
CREATE TABLE IF NOT EXISTS carrot_collection (
  user_key           TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  variant_key        TEXT NOT NULL,
  count              INTEGER NOT NULL DEFAULT 1,
  first_obtained_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_key, variant_key)
);

CREATE INDEX IF NOT EXISTS carrot_collection_user_idx
  ON carrot_collection (user_key);

-- ============ unlocked_sounds ============
-- 보상형 광고 시청으로 잠금해제한 백색소음 사운드 ID 목록.
CREATE TABLE IF NOT EXISTS unlocked_sounds (
  user_key      TEXT NOT NULL REFERENCES users(user_key) ON DELETE CASCADE,
  sound_id      TEXT NOT NULL,
  unlocked_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_key, sound_id)
);

CREATE INDEX IF NOT EXISTS unlocked_sounds_user_idx
  ON unlocked_sounds (user_key);
