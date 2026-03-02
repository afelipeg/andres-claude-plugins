-- ─── OpenAgency Phase 2: Autonomous Agent Tables ────────────────────

-- Agent runtime state (OODA loop state machine)
CREATE TABLE IF NOT EXISTS agent_state (
  agent_id          TEXT PRIMARY KEY,
  engine_id         TEXT NOT NULL,
  status            TEXT NOT NULL,
  current_phase     TEXT,
  active_goals      JSONB DEFAULT '[]',
  last_cycle        TIMESTAMPTZ,
  cycles_completed  INTEGER DEFAULT 0,
  configuration     JSONB NOT NULL DEFAULT '{}',
  started_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_state_status ON agent_state (status);
CREATE INDEX IF NOT EXISTS idx_agent_state_engine ON agent_state (engine_id);

-- Decisions produced by the OODA decide phase
CREATE TABLE IF NOT EXISTS decisions (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  goal_id           TEXT,
  actions           JSONB NOT NULL DEFAULT '[]',
  reasoning         TEXT NOT NULL,
  confidence        NUMERIC(3,2),
  risk_level        TEXT NOT NULL,
  requires_approval BOOLEAN DEFAULT false,
  status            TEXT NOT NULL DEFAULT 'pending_approval',
  orientation_id    TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  approved_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_decisions_agent ON decisions (agent_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions (status);
CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions (created_at);

-- Audit trail for every action executed
CREATE TABLE IF NOT EXISTS action_log (
  id                TEXT PRIMARY KEY,
  decision_id       TEXT NOT NULL,
  agent_id          TEXT NOT NULL,
  action_type       TEXT NOT NULL,
  target_platform   TEXT,
  target_id         TEXT,
  parameters        JSONB DEFAULT '{}',
  previous_value    JSONB,
  new_value         JSONB,
  status            TEXT NOT NULL,
  dry_run           BOOLEAN DEFAULT false,
  duration_ms       INTEGER,
  executed_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_log_decision ON action_log (decision_id);
CREATE INDEX IF NOT EXISTS idx_action_log_agent ON action_log (agent_id);
CREATE INDEX IF NOT EXISTS idx_action_log_platform ON action_log (target_platform);
CREATE INDEX IF NOT EXISTS idx_action_log_executed ON action_log (executed_at);

-- Before/after metric snapshots to measure decision impact
CREATE TABLE IF NOT EXISTS outcomes (
  id                TEXT PRIMARY KEY,
  decision_id       TEXT NOT NULL,
  agent_id          TEXT NOT NULL,
  metric_before     JSONB DEFAULT '{}',
  metric_after      JSONB,
  improvement_pct   NUMERIC(8,2),
  verdict           TEXT,
  measured_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_decision ON outcomes (decision_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_agent ON outcomes (agent_id);

-- Goal-driven execution hierarchy
CREATE TABLE IF NOT EXISTS goals (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT,
  parent_goal_id    TEXT REFERENCES goals(id),
  name              TEXT NOT NULL,
  description       TEXT,
  type              TEXT NOT NULL,
  target_metric     TEXT NOT NULL,
  target_value      NUMERIC NOT NULL,
  current_value     NUMERIC,
  deadline          TIMESTAMPTZ,
  priority          INTEGER DEFAULT 5,
  status            TEXT NOT NULL DEFAULT 'active',
  constraints       JSONB DEFAULT '{}',
  sub_tasks         JSONB DEFAULT '[]',
  progress_pct      NUMERIC(5,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_agent ON goals (agent_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals (status);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals (parent_goal_id);

-- Agent episodic memory (observations, learnings, context)
-- NOTE: When pgvector extension is available, add column:
--   embedding vector(1536)
-- and create an ivfflat index:
--   CREATE INDEX idx_agent_memory_embedding ON agent_memory USING ivfflat (embedding vector_cosine_ops);
CREATE TABLE IF NOT EXISTS agent_memory (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  content           TEXT NOT NULL,
  content_type      TEXT NOT NULL DEFAULT 'text',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory (content_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_created ON agent_memory (created_at);
