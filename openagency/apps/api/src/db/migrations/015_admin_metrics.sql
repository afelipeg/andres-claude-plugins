-- 015: Admin metrics persistence + federation audit log
-- Replaces in-memory consumption tracking with durable DB storage.

-- Daily aggregated metrics (populated by event bus listener)
CREATE TABLE IF NOT EXISTS daily_metrics (
  id                TEXT PRIMARY KEY,
  date              DATE NOT NULL,
  agency_id         TEXT,
  model             TEXT,
  engine_id         TEXT,
  tokens_prompt     INTEGER NOT NULL DEFAULT 0,
  tokens_completion INTEGER NOT NULL DEFAULT 0,
  llm_cost_usd      NUMERIC(12,4) NOT NULL DEFAULT 0,
  runs_started      INTEGER NOT NULL DEFAULT 0,
  runs_completed    INTEGER NOT NULL DEFAULT 0,
  runs_failed       INTEGER NOT NULL DEFAULT 0,
  skills_invoked    INTEGER NOT NULL DEFAULT 0,
  a2a_calls         INTEGER NOT NULL DEFAULT 0,
  mcp_calls         INTEGER NOT NULL DEFAULT 0,
  outcome_fees_usd  NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, agency_id, model, engine_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_agency ON daily_metrics(agency_id) WHERE agency_id IS NOT NULL;

-- Federation peer interaction log (A2A audit trail)
CREATE TABLE IF NOT EXISTS federation_log (
  id            TEXT PRIMARY KEY,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  peer_url      TEXT NOT NULL,
  peer_name     TEXT,
  engine_id     TEXT,
  skill_id      TEXT,
  status        TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
  duration_ms   INTEGER,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_federation_log_created ON federation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_federation_log_peer ON federation_log(peer_url);
