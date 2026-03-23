-- 021: Persistent sync results — survives redeploys
-- Stores the latest sync result per agency + platform so the in-memory
-- syncResultCache can be hydrated on startup.
CREATE TABLE IF NOT EXISTS sync_results (
  id              TEXT PRIMARY KEY,
  agency_id       TEXT NOT NULL,
  platform        TEXT NOT NULL,
  advertiser_id   TEXT DEFAULT '_all',
  status          TEXT NOT NULL DEFAULT 'success',
  row_count       INT NOT NULL DEFAULT 0,
  date_range_start TEXT,
  date_range_end   TEXT,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error           TEXT,
  rows_json       JSONB,
  UNIQUE(agency_id, platform, advertiser_id)
);

-- Fix: admin overview was checking status != 'active' but credentials are stored
-- with status = 'connected'. Both are valid active statuses now.
