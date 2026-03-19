-- 013: Advertiser scopes — per-client advertiser selection (Level 2)
CREATE TABLE IF NOT EXISTS advertiser_scopes (
  id                   TEXT PRIMARY KEY,
  agency_connection_id TEXT NOT NULL REFERENCES agency_connections(id) ON DELETE CASCADE,
  platform             TEXT NOT NULL,
  advertiser_id        TEXT NOT NULL,
  advertiser_name      TEXT,
  status               TEXT NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_connection_id, advertiser_id)
);
