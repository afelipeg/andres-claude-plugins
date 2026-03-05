-- ─── OpenAgency Phase 1 Database Schema ─────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  prefix        TEXT NOT NULL,
  hash          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'engine_user', 'readonly', 'agent')),
  scopes        JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (prefix);

CREATE TABLE IF NOT EXISTS m2m_clients (
  client_id           TEXT PRIMARY KEY,
  client_secret_hash  TEXT NOT NULL,
  name                TEXT NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('admin', 'engine_user', 'readonly', 'agent')),
  scopes              JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS execution_log (
  trace_id    TEXT PRIMARY KEY,
  client_id   TEXT,
  engine_id   TEXT NOT NULL,
  skill_id    TEXT NOT NULL,
  input_hash  TEXT,
  status      TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  duration_ms INTEGER,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_log_engine ON execution_log (engine_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_client ON execution_log (client_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_created ON execution_log (created_at);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at);
