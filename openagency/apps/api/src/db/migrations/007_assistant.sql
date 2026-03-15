-- 007_assistant.sql
-- Persistent conversation store for Plinth Assistant + Scorecard persistence

-- ─── Assistant conversations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL DEFAULT 'New conversation',
  starred BOOLEAN NOT NULL DEFAULT false,
  run_id TEXT,
  run_type TEXT NOT NULL DEFAULT 'standard',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  actions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_conv
  ON assistant_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated
  ON assistant_conversations(updated_at DESC);

-- ─── Scorecard persistence (replaces in-memory Map) ──────────────────
CREATE TABLE IF NOT EXISTS scorecards (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  client_id TEXT,
  run_type TEXT NOT NULL DEFAULT 'standard',
  ad_spend NUMERIC NOT NULL DEFAULT 0,
  billing JSONB NOT NULL DEFAULT '{}',
  engine_outputs JSONB NOT NULL DEFAULT '{}',
  engine_results JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scorecards_run_id ON scorecards(run_id);
CREATE INDEX IF NOT EXISTS idx_scorecards_client_id ON scorecards(client_id);
CREATE INDEX IF NOT EXISTS idx_scorecards_created ON scorecards(created_at DESC);
