-- HFL Decision Persistence
-- Stores Human Feedback Loop decisions so they survive redeploys.

CREATE TABLE IF NOT EXISTS hfl_decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  client_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  risk_score NUMERIC,
  risk_level TEXT,
  reasons JSONB DEFAULT '[]',
  rendered_payload JSONB DEFAULT '{}',
  channel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  feedback TEXT
);

CREATE INDEX IF NOT EXISTS idx_hfl_decisions_run ON hfl_decisions(run_id);
CREATE INDEX IF NOT EXISTS idx_hfl_decisions_status ON hfl_decisions(status);
CREATE INDEX IF NOT EXISTS idx_hfl_decisions_created ON hfl_decisions(created_at DESC);
