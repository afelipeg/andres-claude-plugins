-- 014: Expand role CHECK constraint + add job_title/advertiser_access to users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'agency_admin', 'account_manager', 'viewer', 'admin', 'engine_user'));

-- Add optional fields for account_manager role
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS advertiser_access JSONB DEFAULT '[]';

-- Migrate existing roles to new values
UPDATE users SET role = 'super_admin', scopes = '["*"]'::jsonb WHERE email = 'dedalo@polanyi.tech';
UPDATE users SET role = 'agency_admin' WHERE role = 'admin' AND email != 'dedalo@polanyi.tech';
UPDATE users SET role = 'account_manager' WHERE role = 'engine_user';
