-- ─── OpenAgency Phase 6: User Management ────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL CHECK (role IN ('admin', 'engine_user', 'viewer')) DEFAULT 'viewer',
  scopes        JSONB NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL CHECK (status IN ('active', 'invited', 'deactivated')) DEFAULT 'active',
  invite_token  TEXT UNIQUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_invite_token ON users (invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
