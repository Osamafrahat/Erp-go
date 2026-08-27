-- ============================================================
-- CREATE SUPER ADMIN USER
-- Run this in Supabase SQL Editor to create a platform super admin.
-- This user has no tenant_id and can manage all tenants via /api/super-admin.
-- ============================================================

-- Insert super admin (password: SuperAdmin123!)
INSERT INTO users (
  username,
  password,
  full_name,
  email,
  role,
  permissions,
  is_active,
  must_change_password
) VALUES (
  'superadmin',
  crypt('SuperAdmin123!', gen_salt('bf', 10)),
  'Platform Super Admin',
  'admin@erp-go.com',
  'SUPER_ADMIN',
  '["all"]',
  true,
  false
)
ON CONFLICT (username) DO NOTHING;

-- Verify
SELECT id, username, full_name, role, tenant_id FROM users WHERE username = 'superadmin';
