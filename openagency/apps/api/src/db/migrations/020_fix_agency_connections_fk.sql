-- Migration 020: Fix agency_connections FK constraint
-- agency_connections.agency_id contained user IDs instead of agency IDs
-- This prevented the FK constraint in migration 017 from applying

-- Step 1: Fix bad data — map user IDs to 'cerebro' (the only agency)
UPDATE agency_connections SET agency_id = 'cerebro'
  WHERE agency_id NOT IN (SELECT id FROM agencies);

-- Step 2: Now add the FK constraint (017 failed to apply it)
DO $$ BEGIN
  ALTER TABLE agency_connections ADD CONSTRAINT fk_agency_connections_agency
    FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
