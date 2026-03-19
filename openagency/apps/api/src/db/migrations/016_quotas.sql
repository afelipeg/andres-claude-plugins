-- 016: Agencies table (first-class entity) + Quota system
-- Agency quota = brand_count × 8 runs/month (4 initial + 4 optimization)
-- Assistant quota = 10 new conversations per user per month
-- Non-accumulative, resets 1st of each calendar month

-- Agencies table (previously implicit via auth.sub)
CREATE TABLE IF NOT EXISTS agencies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  brand_count INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link users to agencies
ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id TEXT REFERENCES agencies(id);
CREATE INDEX IF NOT EXISTS idx_users_agency ON users(agency_id) WHERE agency_id IS NOT NULL;

-- Monthly quota usage per agency (run tracking)
CREATE TABLE IF NOT EXISTS agency_quota_usage (
  id                     TEXT PRIMARY KEY,
  agency_id              TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  month                  TEXT NOT NULL,
  initial_runs_used      INTEGER NOT NULL DEFAULT 0,
  optimization_runs_used INTEGER NOT NULL DEFAULT 0,
  extra_runs_granted     INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, month)
);

-- Monthly assistant conversation usage per user
CREATE TABLE IF NOT EXISTS user_assistant_usage (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month           TEXT NOT NULL,
  sessions_used   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Extra run requests (agency_admin → super_admin approval flow)
CREATE TABLE IF NOT EXISTS quota_requests (
  id                    TEXT PRIMARY KEY,
  agency_id             TEXT NOT NULL REFERENCES agencies(id),
  requested_by          TEXT NOT NULL REFERENCES users(id),
  month                 TEXT NOT NULL,
  extra_runs_requested  INTEGER NOT NULL,
  reason                TEXT,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by           TEXT REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quota_requests_pending ON quota_requests(status) WHERE status = 'pending';

-- Seed: Cerebro SM as first agency
INSERT INTO agencies (id, name, brand_count, status)
VALUES ('cerebro', 'Cerebro SM', 1, 'active')
ON CONFLICT (id) DO NOTHING;

-- Assign all existing users to Cerebro
UPDATE users SET agency_id = 'cerebro' WHERE agency_id IS NULL;
