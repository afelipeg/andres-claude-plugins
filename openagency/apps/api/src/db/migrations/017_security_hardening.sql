-- Migration 017: Security Hardening
-- Multi-tenancy: add agency_id to tenant-scoped tables
-- Foreign key constraints on orphan-prone columns
-- Audit log for impersonation tracking
-- GIN index for full-text search

-- ═══════════════════════════════════════════════════════════════
-- 1. Add agency_id to tenant-scoped tables
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE mesh_runs ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE mesh_runs SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_mesh_runs_agency_id ON mesh_runs(agency_id);

ALTER TABLE scorecards ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE scorecards SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_scorecards_agency_id ON scorecards(agency_id);

ALTER TABLE client_data ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE client_data SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_data_agency_id ON client_data(agency_id);

ALTER TABLE pipeline_schedules ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE pipeline_schedules SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_schedules_agency_id ON pipeline_schedules(agency_id);

ALTER TABLE delivery_files ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE delivery_files SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_files_agency_id ON delivery_files(agency_id);

ALTER TABLE assistant_conversations ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE assistant_conversations SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_agency_id ON assistant_conversations(agency_id);

ALTER TABLE mcp_connections ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE mcp_connections SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_connections_agency_id ON mcp_connections(agency_id);

ALTER TABLE storage_connections ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE storage_connections SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_connections_agency_id ON storage_connections(agency_id);

ALTER TABLE execution_log ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
UPDATE execution_log SET agency_id = 'cerebro' WHERE agency_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_execution_log_agency_id ON execution_log(agency_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. Add missing FK constraints (safe — skip if already exists)
-- ═══════════════════════════════════════════════════════════════

-- Fix: agency_connections.agency_id may contain user IDs instead of agency IDs
UPDATE agency_connections SET agency_id = 'cerebro'
  WHERE agency_id NOT IN (SELECT id FROM agencies);

DO $$ BEGIN
  ALTER TABLE agency_connections ADD CONSTRAINT fk_agency_connections_agency
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE daily_metrics ADD CONSTRAINT fk_daily_metrics_agency
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE delivery_files ADD CONSTRAINT fk_delivery_files_run
    FOREIGN KEY (run_id) REFERENCES mesh_runs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE scorecards ADD CONSTRAINT fk_scorecards_run
    FOREIGN KEY (run_id) REFERENCES mesh_runs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assistant_conversations ADD CONSTRAINT fk_conversations_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3. GIN index for full-text search on agent_memory
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_agent_memory_fts
  ON agent_memory USING GIN (to_tsvector('english', content));

-- Composite index for scorecard lookups (client_id + run_type + created_at)
CREATE INDEX IF NOT EXISTS idx_scorecards_client_type_created
  ON scorecards(client_id, run_type, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 4. Audit log table (impersonation, admin actions)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
