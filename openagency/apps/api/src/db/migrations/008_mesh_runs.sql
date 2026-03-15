-- ─── Mesh Pipeline Run Persistence ──────────────────────────────────
-- Stores completed pipeline runs so they survive server restarts.

CREATE TABLE IF NOT EXISTS mesh_runs (
  id              TEXT        PRIMARY KEY,
  pipeline_id     TEXT        NOT NULL,
  status          TEXT        NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  total_duration_ms INTEGER   NOT NULL DEFAULT 0,
  goal_id         TEXT,
  client_id       TEXT,
  stage_results   JSONB       NOT NULL DEFAULT '{}',
  usage           JSONB
);

CREATE INDEX IF NOT EXISTS mesh_runs_started_at_idx  ON mesh_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS mesh_runs_status_idx      ON mesh_runs (status);
CREATE INDEX IF NOT EXISTS mesh_runs_client_id_idx   ON mesh_runs (client_id) WHERE client_id IS NOT NULL;
