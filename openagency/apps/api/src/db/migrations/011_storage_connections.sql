-- 011: Storage connections (Google Drive, OneDrive) with encrypted tokens
CREATE TABLE IF NOT EXISTS storage_connections (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  provider      TEXT NOT NULL,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ,
  scope         TEXT,
  email         TEXT,
  status        TEXT NOT NULL DEFAULT 'connected',
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, provider)
);
