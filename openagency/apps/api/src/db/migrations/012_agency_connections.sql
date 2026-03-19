-- 012: Agency connections — master credentials per platform (Level 1)
CREATE TABLE IF NOT EXISTS agency_connections (
  id              TEXT PRIMARY KEY,
  agency_id       TEXT NOT NULL,
  platform        TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  credentials     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'connected',
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, platform)
);
