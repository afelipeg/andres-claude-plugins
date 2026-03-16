-- 009: Client batch data storage
-- Stores human-uploaded first-party data (sell-in, sell-out, digital sales, etc.)
-- per client_id. Used by the context assembler to inject batch data into pipeline runs.

CREATE TABLE IF NOT EXISTS client_data (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  data_type     TEXT NOT NULL,         -- 'sell_in', 'sell_out', 'digital_sales', 'investor_relations', 'platform_export', 'other'
  file_name     TEXT NOT NULL,
  platform      TEXT,                  -- detected platform (google_ads, meta_ads, etc.) or NULL
  format        TEXT NOT NULL,         -- csv, xlsx, pdf
  row_count     INTEGER NOT NULL DEFAULT 0,
  columns       JSONB NOT NULL DEFAULT '[]',
  column_map    JSONB,                 -- platform column mapping if detected
  data          JSONB NOT NULL DEFAULT '[]',  -- parsed rows (full data, not preview)
  summary       JSONB,                 -- aggregated summary for quick context injection
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ           -- optional TTL
);

CREATE INDEX IF NOT EXISTS idx_client_data_client ON client_data (client_id);
CREATE INDEX IF NOT EXISTS idx_client_data_type ON client_data (client_id, data_type);
CREATE INDEX IF NOT EXISTS idx_client_data_uploaded ON client_data (uploaded_at DESC);
