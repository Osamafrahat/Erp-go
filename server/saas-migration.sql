-- ============================================================
-- MULTI-TENANT SaaS MIGRATION
-- Converts single-store POS to multi-tenant architecture.
-- Run this in Supabase SQL Editor after the base schema.
-- ============================================================

-- ============================================================
-- 0. SAFETY: Wrap entire migration in a transaction
-- ============================================================
BEGIN;

-- ============================================================
-- 1. TENANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('active','trialing','past_due','cancelled')),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  subscription_ends_at TIMESTAMPTZ,
  max_products INT DEFAULT 50,
  max_users INT DEFAULT 2,
  max_orders_monthly INT DEFAULT 100,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. SUBSCRIPTION PLANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC DEFAULT 0,
  price_yearly NUMERIC DEFAULT 0,
  max_products INT,
  max_users INT,
  max_orders_monthly INT,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TENANT PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ADD tenant_id TO ALL EXISTING TABLES
-- ============================================================

-- Core tables
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

-- Accounting tables
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

-- Promotions, orders, sales
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE payment_splits ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

-- Refunds
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE refund_items ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

-- Expenses, settings, activity
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

-- Team chat
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

-- HR tables
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE review_criteria ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

-- Services & subscriptions
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================================
-- 5. DROP & RECREATE UNIQUE CONSTRAINTS AS PER-TENANT
-- ============================================================

-- users: username must be unique per tenant, not globally
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE users ADD CONSTRAINT users_tenant_username_unique UNIQUE (tenant_id, username);

-- products: SKU unique per tenant
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products ADD CONSTRAINT products_tenant_sku_unique UNIQUE (tenant_id, sku);

-- products: barcode unique per tenant
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;
ALTER TABLE products ADD CONSTRAINT products_tenant_barcode_unique UNIQUE (tenant_id, barcode);

-- store_settings: key unique per tenant
ALTER TABLE store_settings DROP CONSTRAINT IF EXISTS store_settings_key_key;
ALTER TABLE store_settings ADD CONSTRAINT store_settings_tenant_key_unique UNIQUE (tenant_id, "key");

-- orders: order_number unique per tenant
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
ALTER TABLE orders ADD CONSTRAINT orders_tenant_order_number_unique UNIQUE (tenant_id, order_number);

-- orders: client_order_id unique per tenant
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_client_order_id_key;
ALTER TABLE orders ADD CONSTRAINT orders_tenant_client_order_id_unique UNIQUE (tenant_id, client_order_id);

-- journal_entries: entry_number unique per tenant
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_entry_number_key;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_tenant_entry_number_unique UNIQUE (tenant_id, entry_number);

-- payments: payment_number unique per tenant
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_number_key;
ALTER TABLE payments ADD CONSTRAINT payments_tenant_payment_number_unique UNIQUE (tenant_id, payment_number);

-- promotions: code unique per tenant
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_code_key;
ALTER TABLE promotions ADD CONSTRAINT promotions_tenant_code_unique UNIQUE (tenant_id, code);

-- suppliers: account_code - make per-tenant (drop global unique)
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_account_code_key;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_tenant_account_code_unique UNIQUE (tenant_id, account_code);

-- accounts: code unique per tenant
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_code_key;
ALTER TABLE accounts ADD CONSTRAINT accounts_tenant_code_unique UNIQUE (tenant_id, code);

-- account_balances: already has UNIQUE(account_id, period_id), keep as-is
-- (account_id is already tenant-scoped via the accounts table FK)

-- ============================================================
-- 6. SET_CURRENT_TENANT FUNCTION (for RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant', p_tenant_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. REPLACE ALL RLS POLICIES WITH TENANT ISOLATION
-- ============================================================

-- Helper: Drop old "Allow all" / "Allow all access to" policies and
-- create new tenant_isolation policy for every table.

-- tenants table: special policy (tenant + super_admin access)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON tenants;
DROP POLICY IF EXISTS "tenant_isolation" ON tenants;
CREATE POLICY "tenant_isolation" ON tenants
  FOR ALL
  USING (
    id = current_setting('app.current_tenant')::bigint
    OR current_setting('app.current_tenant', true) IS NULL
    OR current_setting('app.current_tenant', true) = ''
  )
  WITH CHECK (
    id = current_setting('app.current_tenant')::bigint
    OR current_setting('app.current_tenant', true) IS NULL
    OR current_setting('app.current_tenant', true) = ''
  );

-- subscription_plans: global read, no tenant scoping needed
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subscription_plans;
DROP POLICY IF EXISTS "tenant_isolation" ON subscription_plans;
CREATE POLICY "allow_all_subscription_plans" ON subscription_plans
  FOR ALL USING (true) WITH CHECK (true);

-- tenant_payments: tenant-scoped
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON tenant_payments;
DROP POLICY IF EXISTS "tenant_isolation" ON tenant_payments;
CREATE POLICY "tenant_isolation" ON tenant_payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- Core tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON categories;
CREATE POLICY "tenant_isolation" ON categories
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON suppliers;
CREATE POLICY "tenant_isolation" ON suppliers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON products;
CREATE POLICY "tenant_isolation" ON products
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON customers;
CREATE POLICY "tenant_isolation" ON customers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON employees;
CREATE POLICY "tenant_isolation" ON employees
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON users;
CREATE POLICY "tenant_isolation" ON users
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- Accounting tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON accounts;
CREATE POLICY "tenant_isolation" ON accounts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON fiscal_periods;
CREATE POLICY "tenant_isolation" ON fiscal_periods
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON journal_entries;
CREATE POLICY "tenant_isolation" ON journal_entries
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON journal_entry_lines;
CREATE POLICY "tenant_isolation" ON journal_entry_lines
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payments;
CREATE POLICY "tenant_isolation" ON payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON account_balances;
CREATE POLICY "tenant_isolation" ON account_balances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- Promotions, orders, sales
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON promotions;
CREATE POLICY "tenant_isolation" ON promotions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON orders;
CREATE POLICY "tenant_isolation" ON orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON order_items;
CREATE POLICY "tenant_isolation" ON order_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payment_splits;
CREATE POLICY "tenant_isolation" ON payment_splits
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON stock_movements;
CREATE POLICY "tenant_isolation" ON stock_movements
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- Refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON refunds;
CREATE POLICY "tenant_isolation" ON refunds
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE refund_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON refund_items;
CREATE POLICY "tenant_isolation" ON refund_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- Expenses, settings, activity
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON expenses;
CREATE POLICY "tenant_isolation" ON expenses
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON store_settings;
CREATE POLICY "tenant_isolation" ON store_settings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON activity_log;
CREATE POLICY "tenant_isolation" ON activity_log
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- Team chat
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to messages" ON messages;
DROP POLICY IF EXISTS "Allow all" ON messages;
CREATE POLICY "tenant_isolation" ON messages
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- HR tables
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON attendance;
CREATE POLICY "tenant_isolation" ON attendance
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_types;
CREATE POLICY "tenant_isolation" ON leave_types
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_requests;
CREATE POLICY "tenant_isolation" ON leave_requests
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_balances;
CREATE POLICY "tenant_isolation" ON leave_balances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payroll;
CREATE POLICY "tenant_isolation" ON payroll
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payroll_items;
CREATE POLICY "tenant_isolation" ON payroll_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON shifts;
CREATE POLICY "tenant_isolation" ON shifts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON employee_shifts;
CREATE POLICY "tenant_isolation" ON employee_shifts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON performance_reviews;
CREATE POLICY "tenant_isolation" ON performance_reviews
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE review_criteria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON review_criteria;
CREATE POLICY "tenant_isolation" ON review_criteria
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- Services & subscriptions
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON service_plans;
CREATE POLICY "tenant_isolation" ON service_plans
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON services;
CREATE POLICY "tenant_isolation" ON services
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subscriptions;
CREATE POLICY "tenant_isolation" ON subscriptions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subscription_payments;
CREATE POLICY "tenant_isolation" ON subscription_payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::bigint);

-- ============================================================
-- 8. SEED DEFAULT SUBSCRIPTION PLANS
-- ============================================================
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, max_products, max_users, max_orders_monthly, features) VALUES
  ('Free', 'free', 0, 0, 50, 2, 100, '["basic_pos","inventory","reports"]'),
  ('Pro', 'pro', 29, 290, 500, 20, -1, '["basic_pos","inventory","reports","accounting","hr","services","priority_support"]'),
  ('Enterprise', 'enterprise', 99, 990, -1, -1, -1, '["basic_pos","inventory","reports","accounting","hr","services","priority_support","custom_integrations","dedicated_support"]')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 9. ADD tenant_id INDEXES FOR EVERY TABLE
-- ============================================================

-- Core
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Accounting
CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_tenant ON fiscal_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant ON journal_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_tenant ON journal_entry_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_tenant ON account_balances(tenant_id);

-- Promotions, orders, sales
CREATE INDEX IF NOT EXISTS idx_promotions_tenant ON promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_tenant ON payment_splits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);

-- Refunds
CREATE INDEX IF NOT EXISTS idx_refunds_tenant ON refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_tenant ON refund_items(tenant_id);

-- Expenses, settings, activity
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_settings_tenant ON store_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant ON activity_log(tenant_id);

-- Team chat
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);

-- HR tables
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_tenant ON leave_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_tenant ON leave_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_tenant ON payroll(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_tenant ON payroll_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_tenant ON employee_shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_tenant ON performance_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_criteria_tenant ON review_criteria(tenant_id);

-- Services & subscriptions
CREATE INDEX IF NOT EXISTS idx_service_plans_tenant ON service_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant ON subscription_payments(tenant_id);

-- New SaaS tables
CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant ON tenant_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);

-- ============================================================
-- 10. TENANT USAGE VIEW (helper for limit checks)
-- ============================================================
CREATE OR REPLACE VIEW tenant_usage AS
SELECT
  t.id as tenant_id,
  t.name,
  t.subscription_tier,
  t.max_products,
  t.max_users,
  t.max_orders_monthly,
  (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id) as used_products,
  (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as used_users,
  (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id AND o.created_at >= date_trunc('month', NOW())) as used_orders_this_month
FROM tenants t;

-- ============================================================
-- COMMIT TRANSACTION
-- ============================================================
COMMIT;
