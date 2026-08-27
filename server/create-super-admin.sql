-- ============================================================
-- CREATE SUPER ADMIN USER
-- Run this in Supabase SQL Editor to create a platform super admin.
-- This user has no tenant_id and can manage all tenants via /api/super-admin.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'superadmin') THEN
    INSERT INTO users (username, password, full_name, email, role, permissions, is_active, must_change_password)
    VALUES (
      'superadmin',
      crypt('SuperAdmin123!', gen_salt('bf', 10)),
      'Platform Super Admin',
      'admin@erp-go.com',
      'SUPER_ADMIN',
      '["all"]',
      true,
      false
    );
  END IF;
END $$;

-- Verify
SELECT id, username, full_name, role, tenant_id FROM users WHERE username = 'superadmin';
