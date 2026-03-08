-- ─── OpenAgency Phase 4: Pipeline Schedules ────────────────────────
-- Stores recurring pipeline schedules with cron expressions.

CREATE TABLE IF NOT EXISTS pipeline_schedules (
  id            TEXT PRIMARY KEY,               -- ULID
  client_id     TEXT NOT NULL,
  pipeline_id   TEXT NOT NULL,
  cron          TEXT NOT NULL,                  -- 5-part cron expression
  auto_approve  BOOLEAN NOT NULL DEFAULT false, -- Skip HFL escalation if risk < threshold
  notify_on_complete BOOLEAN NOT NULL DEFAULT true,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipeline_schedules_client
  ON pipeline_schedules (client_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_schedules_enabled_next
  ON pipeline_schedules (enabled, next_run_at)
  WHERE enabled = true;
