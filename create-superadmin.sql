-- Create super admin user (run in Supabase SQL Editor)
INSERT INTO users (username, password, full_name, email, role, permissions, is_active, must_change_password, tenant_id)
VALUES (
  'superadmin',
  '$2a$10$YYA4YHs/6VPur6Db4VGF9e3/lrrTqtIir7/STOOE8Uzg78/SPLMpO',
  'Platform Super Admin',
  'admin@erp-go.com',
  'SUPER_ADMIN',
  '["all"]',
  true,
  false,
  NULL
)
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  is_active = true,
  role = 'SUPER_ADMIN',
  permissions = '["all"]',
  tenant_id = NULL;
