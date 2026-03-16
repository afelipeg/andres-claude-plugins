-- MCP Marketplace connections (persisted across restarts)
CREATE TABLE IF NOT EXISTS mcp_connections (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  auth_type       TEXT NOT NULL DEFAULT 'bearer',
  auth_token      TEXT,
  catalog_id      TEXT,
  tools           JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'connected'
                  CHECK (status IN ('connected', 'failed', 'stale')),
  error           TEXT,
  allowed_engines TEXT[] DEFAULT '{}',
  process_pid     INTEGER,
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_health     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_connections_client ON mcp_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_connections_status ON mcp_connections(status);
