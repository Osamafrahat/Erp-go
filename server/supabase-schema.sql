-- ============================================================
-- STORE MANAGEMENT SYSTEM - COMPLETE DATABASE SCHEMA
-- Single consolidated file — includes all tables, columns,
-- indexes, RLS policies, seed data, and admin user.
-- Run this in Supabase SQL Editor to set up or reset the DB.
-- ============================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 0. SAAS / MULTI-TENANT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
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
-- 1. CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_code TEXT,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, account_code)
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  stock_quantity NUMERIC DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  is_refundable BOOLEAN DEFAULT true,
  unit_of_measure TEXT DEFAULT 'quantity',
  image_url TEXT,
  specifications JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  reorder_point INTEGER DEFAULT 0,
  reorder_quantity INTEGER DEFAULT 0,
  commission_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, sku),
  UNIQUE (tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  account_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CASHIER',
  phone TEXT,
  email TEXT,
  salary NUMERIC DEFAULT 0,
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'CASHIER',
  permissions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  session_token TEXT,
  employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, username)
);

-- ============================================================
-- 2. ACCOUNTING TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  parent_id BIGINT REFERENCES accounts(id),
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  closed_by BIGINT REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference TEXT,
  source_type TEXT,
  source_id BIGINT,
  period_id BIGINT REFERENCES fiscal_periods(id),
  is_posted BOOLEAN DEFAULT false,
  is_reversed BOOLEAN DEFAULT false,
  reversed_by BIGINT REFERENCES journal_entries(id),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, entry_number)
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_id BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  method TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  partner_type TEXT,
  partner_id BIGINT,
  reference TEXT,
  notes TEXT,
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  recorded_by BIGINT REFERENCES users(id),
  payment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, payment_number)
);

CREATE TABLE IF NOT EXISTS account_balances (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  period_id BIGINT NOT NULL REFERENCES fiscal_periods(id),
  opening_balance NUMERIC DEFAULT 0,
  debit_total NUMERIC DEFAULT 0,
  credit_total NUMERIC DEFAULT 0,
  closing_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, period_id)
);

-- ============================================================
-- 3. PROMOTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS promotions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

-- ============================================================
-- 4. ORDERS & SALES
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  payment_status TEXT DEFAULT 'paid',
  user_id BIGINT REFERENCES users(id),
  customer_id BIGINT REFERENCES customers(id),
  promotion_id BIGINT REFERENCES promotions(id),
  is_refunded BOOLEAN DEFAULT false,
  journal_entry_id BIGINT REFERENCES journal_entries(id),
  client_order_id TEXT,
  notes TEXT,
  eta_uuid TEXT,
  eta_qr_code TEXT,
  eta_status TEXT DEFAULT 'pending',
  eta_submitted_at TIMESTAMPTZ,
  salesperson_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, order_number),
  UNIQUE (tenant_id, client_order_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  product_name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  type TEXT DEFAULT 'product'
);

CREATE TABLE IF NOT EXISTS payment_splits (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  reference_id BIGINT,
  notes TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4b. REFUNDS (full & item-level)
-- ============================================================

CREATE TABLE IF NOT EXISTS refunds (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  is_partial BOOLEAN DEFAULT false,
  processed_by BIGINT REFERENCES users(id),
  refund_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refund_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  refund_id BIGINT NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  order_item_id BIGINT NOT NULL REFERENCES order_items(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. EXPENSES, SETTINGS, ACTIVITY
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  receipt_image TEXT,
  recorded_by BIGINT REFERENCES users(id),
  expense_date DATE DEFAULT CURRENT_DATE,
  method TEXT DEFAULT 'cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_settings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  value TEXT,
  UNIQUE (tenant_id, "key")
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5b. CASH SHIFTS (Reconciliation)
-- ============================================================

CREATE TABLE IF NOT EXISTS cash_shifts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  opening_balance NUMERIC DEFAULT 0,
  closing_balance NUMERIC,
  expected_cash NUMERIC DEFAULT 0,
  actual_cash NUMERIC,
  variance NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5c. PRODUCT VARIANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  stock_quantity NUMERIC DEFAULT 0,
  attributes JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5d. CREDIT SALES (Accounts Receivable)
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_sales (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  total_amount NUMERIC NOT NULL,
  paid_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue')),
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credit_sale_id BIGINT NOT NULL REFERENCES credit_sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5e. PRODUCT BATCHES (Expiry Tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_batches (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  batch_number TEXT,
  expiry_date DATE,
  quantity NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5f. PURCHASE ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','received','cancelled')),
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  expected_date DATE,
  received_date DATE,
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  received_quantity NUMERIC DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5g. SALESPERSON COMMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS commissions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  product_id BIGINT REFERENCES products(id),
  sale_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. INDEXES
-- ============================================================

-- Core
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);

-- Accounting
CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_tenant ON fiscal_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant ON journal_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period ON journal_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_tenant ON journal_entry_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_account_balances_tenant ON account_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_account ON account_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_period ON account_balances(period_id);

-- Promotions, orders, sales
CREATE INDEX IF NOT EXISTS idx_promotions_tenant ON promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_client_order_id ON orders(client_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_tenant ON payment_splits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

-- Refunds
CREATE INDEX IF NOT EXISTS idx_refunds_tenant ON refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_tenant ON refund_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_refund ON refund_items(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_order_item ON refund_items(order_item_id);

-- Expenses, settings, activity
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_store_settings_tenant ON store_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant ON activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);

-- Cash shifts
CREATE INDEX IF NOT EXISTS idx_cash_shifts_tenant ON cash_shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_user ON cash_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);

-- Product variants
CREATE INDEX IF NOT EXISTS idx_product_variants_tenant ON product_variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

-- Credit sales
CREATE INDEX IF NOT EXISTS idx_credit_sales_tenant ON credit_sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_customer ON credit_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_status ON credit_sales(status);
CREATE INDEX IF NOT EXISTS idx_credit_payments_tenant ON credit_payments(tenant_id);

-- Product batches
CREATE INDEX IF NOT EXISTS idx_product_batches_tenant ON product_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(expiry_date);

-- Purchase orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant ON purchase_order_items(tenant_id);

-- Commissions
CREATE INDEX IF NOT EXISTS idx_commissions_tenant ON commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_employee ON commissions(employee_id);

-- Team chat
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- HR tables
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_leave_types_tenant ON leave_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_tenant ON leave_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_tenant ON payroll(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_tenant ON payroll_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll_id ON payroll_items(payroll_id);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_tenant ON employee_shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_date ON employee_shifts(date);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_tenant ON performance_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_criteria_tenant ON review_criteria(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_criteria_review_id ON review_criteria(review_id);

-- Services & subscriptions
CREATE INDEX IF NOT EXISTS idx_service_plans_tenant ON service_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_plans_cycle ON service_plans(billing_cycle);
CREATE INDEX IF NOT EXISTS idx_service_plans_active ON service_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_service ON subscriptions(service_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant ON subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_sub ON subscription_payments(subscription_id);

-- SaaS tables
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant ON tenant_payments(tenant_id);

-- ============================================================
-- 7. ROW LEVEL SECURITY (ALL tables — tenant isolation)
-- ============================================================

-- Helper function for tenant isolation
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id BIGINT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant', p_tenant_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- tenants: special policy (tenant + super_admin access)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON tenants;
DROP POLICY IF EXISTS "tenant_isolation" ON tenants;
CREATE POLICY "tenant_isolation" ON tenants
  FOR ALL
  USING (
    id = current_setting('app.current_tenant', true)::bigint
    OR current_setting('app.current_tenant', true) IS NULL
    OR current_setting('app.current_tenant', true) = ''
  )
  WITH CHECK (
    id = current_setting('app.current_tenant', true)::bigint
    OR current_setting('app.current_tenant', true) IS NULL
    OR current_setting('app.current_tenant', true) = ''
  );

-- subscription_plans: global read
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subscription_plans;
DROP POLICY IF EXISTS "tenant_isolation" ON subscription_plans;
DROP POLICY IF EXISTS "allow_all_subscription_plans" ON subscription_plans;
CREATE POLICY "allow_all_subscription_plans" ON subscription_plans
  FOR ALL USING (true) WITH CHECK (true);

-- tenant_payments: tenant-scoped
ALTER TABLE tenant_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON tenant_payments;
DROP POLICY IF EXISTS "tenant_isolation" ON tenant_payments;
CREATE POLICY "tenant_isolation" ON tenant_payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Core tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON categories;
CREATE POLICY "tenant_isolation" ON categories
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON suppliers;
CREATE POLICY "tenant_isolation" ON suppliers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON products;
CREATE POLICY "tenant_isolation" ON products
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON customers;
CREATE POLICY "tenant_isolation" ON customers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON employees;
CREATE POLICY "tenant_isolation" ON employees
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON users;
CREATE POLICY "tenant_isolation" ON users
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Accounting tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON accounts;
CREATE POLICY "tenant_isolation" ON accounts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON fiscal_periods;
CREATE POLICY "tenant_isolation" ON fiscal_periods
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON journal_entries;
CREATE POLICY "tenant_isolation" ON journal_entries
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON journal_entry_lines;
CREATE POLICY "tenant_isolation" ON journal_entry_lines
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payments;
CREATE POLICY "tenant_isolation" ON payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON account_balances;
CREATE POLICY "tenant_isolation" ON account_balances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Promotions, orders, sales
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON promotions;
CREATE POLICY "tenant_isolation" ON promotions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON orders;
CREATE POLICY "tenant_isolation" ON orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON order_items;
CREATE POLICY "tenant_isolation" ON order_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payment_splits;
CREATE POLICY "tenant_isolation" ON payment_splits
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON stock_movements;
CREATE POLICY "tenant_isolation" ON stock_movements
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON refunds;
CREATE POLICY "tenant_isolation" ON refunds
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE refund_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON refund_items;
CREATE POLICY "tenant_isolation" ON refund_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Expenses, settings, activity
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON expenses;
CREATE POLICY "tenant_isolation" ON expenses
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON store_settings;
CREATE POLICY "tenant_isolation" ON store_settings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON activity_log;
CREATE POLICY "tenant_isolation" ON activity_log
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Cash shifts
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON cash_shifts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Product variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON product_variants
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Credit sales
ALTER TABLE credit_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON credit_sales
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON credit_payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Product batches
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON product_batches
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Purchase orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON purchase_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON purchase_order_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Commissions
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON commissions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Team chat
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to messages" ON messages;
DROP POLICY IF EXISTS "Allow all" ON messages;
DROP POLICY IF EXISTS "tenant_isolation" ON messages;
CREATE POLICY "tenant_isolation" ON messages
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- HR tables
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON attendance;
CREATE POLICY "tenant_isolation" ON attendance
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_types;
CREATE POLICY "tenant_isolation" ON leave_types
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_requests;
CREATE POLICY "tenant_isolation" ON leave_requests
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_balances;
CREATE POLICY "tenant_isolation" ON leave_balances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payroll;
CREATE POLICY "tenant_isolation" ON payroll
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payroll_items;
CREATE POLICY "tenant_isolation" ON payroll_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON shifts;
CREATE POLICY "tenant_isolation" ON shifts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON employee_shifts;
CREATE POLICY "tenant_isolation" ON employee_shifts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON performance_reviews;
CREATE POLICY "tenant_isolation" ON performance_reviews
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE review_criteria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON review_criteria;
CREATE POLICY "tenant_isolation" ON review_criteria
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Services & subscriptions
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON service_plans;
CREATE POLICY "tenant_isolation" ON service_plans
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON services;
CREATE POLICY "tenant_isolation" ON services
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subscriptions;
CREATE POLICY "tenant_isolation" ON subscriptions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subscription_payments;
CREATE POLICY "tenant_isolation" ON subscription_payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- ============================================================
-- 8. SEED: Admin User (password: admin123)
-- ============================================================

DELETE FROM users WHERE username = 'admin';

INSERT INTO users (username, password, full_name, role, permissions, is_active, must_change_password)
VALUES (
  'admin',
  crypt('admin123', gen_salt('bf', 10)),
  'Admin Manager',
  'MANAGER',
  '["dashboard_view","pos_access","inventory_view","inventory_edit","reports_view","suppliers_view","suppliers_edit","promotions_view","promotions_edit","settings_view","settings_edit","user_manage","customers_view","customers_edit","expenses_view","expenses_edit","refunds_view","refunds_edit","employees_view","employees_edit","hr_view","hr_edit","services_view","services_edit","accounting_view","accounting_edit","accounting_post"]',
  true,
  true
);

-- ============================================================
-- 9. SEED: Default Store Settings
-- ============================================================

INSERT INTO store_settings ("key", value) VALUES
  ('storeName', 'My Store'),
  ('storeAddress', ''),
  ('storePhone', ''),
  ('storeLogo', ''),
  ('taxRate', '14'),
  ('currency', 'EGP'),
  ('currencySymbol', 'ج.م'),
  ('receiptFooter', 'Thank you for your purchase!'),
  ('lowStockThreshold', '10'),
  ('loyaltyPointsPerCurrency', '1'),
  ('attendance.lateGraceMinutes', '5'),
  ('attendance.overtimeThresholdHours', '8'),
  ('attendance.autoClockOut', 'false'),
  ('attendance.autoClockOutTime', '23:00'),
  ('attendance.enableGeolocation', 'false'),
  ('attendance.requiredRadiusMeters', '100'),
  ('attendance.storeLatitude', '30.0444'),
  ('attendance.storeLongitude', '31.2357')
ON CONFLICT ("key") DO NOTHING;

-- ============================================================
-- 10. SEED: Chart of Accounts (18 accounts)
-- ============================================================

INSERT INTO accounts (code, name, account_type, description) VALUES
  ('1010', 'Cash',                  'asset',     'Physical cash in register and vault'),
  ('1020', 'Bank Account',          'asset',     'Business bank account'),
  ('1030', 'Accounts Receivable',   'asset',     'Amounts owed by customers'),
  ('1050', 'Inventory',             'asset',     'Products held for resale'),
  ('2010', 'Accounts Payable',      'liability', 'Amounts owed to suppliers'),
  ('2030', 'VAT Payable',           'liability', 'Tax collected on sales'),
  ('3010', 'Owner Equity',          'equity',    'Capital invested by owner'),
  ('3020', 'Retained Earnings',     'equity',    'Accumulated profit'),
  ('3030', 'Current Year Earnings', 'equity',    'Net income for current period'),
  ('4010', 'Sales Revenue',         'revenue',   'Revenue from product sales'),
  ('4015', 'Service Revenue',       'revenue',   'Revenue from service sales'),
  ('4020', 'Sales Returns',         'revenue',   'Returns and refunds'),
  ('4025', 'Subscription Revenue',  'revenue',   'Revenue from subscriptions'),
  ('5010', 'Cost of Goods Sold',    'expense',   'Direct cost of products sold'),
  ('5020', 'Operating Expenses',    'expense',   'General operating costs'),
  ('5030', 'Salary Expense',        'expense',   'Employee salaries'),
  ('5040', 'Rent Expense',          'expense',   'Office/store rent'),
  ('5050', 'Utilities Expense',     'expense',   'Electricity, water, internet')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 11. SEED: Default Fiscal Period (current year)
-- ============================================================

INSERT INTO fiscal_periods (name, start_date, end_date)
SELECT
  'FY ' || EXTRACT(YEAR FROM NOW()),
  (EXTRACT(YEAR FROM NOW()) || '-01-01')::date,
  (EXTRACT(YEAR FROM NOW()) || '-12-31')::date
WHERE NOT EXISTS (
  SELECT 1 FROM fiscal_periods WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
);

-- ============================================================
-- 12. TEAM CHAT
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id),
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. HR: ATTENDANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  overtime_hours NUMERIC DEFAULT 0,
  total_hours NUMERIC DEFAULT 0,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  break_minutes NUMERIC DEFAULT 0,
  clock_in_location JSONB,
  clock_out_location JSONB,
  source TEXT DEFAULT 'manager',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- ============================================================
-- 14. HR: LEAVE TYPES
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_types (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_per_year INT NOT NULL DEFAULT 0,
  is_paid BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. HR: LEAVE REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id BIGINT NOT NULL REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by BIGINT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. HR: LEAVE BALANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_balances (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id BIGINT NOT NULL REFERENCES leave_types(id),
  year INT NOT NULL,
  total_days NUMERIC DEFAULT 0,
  used_days NUMERIC DEFAULT 0,
  remaining_days NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, leave_type_id, year)
);

-- ============================================================
-- 17. HR: PAYROLL
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount NUMERIC DEFAULT 0,
  processed_by BIGINT REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. HR: PAYROLL ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_id BIGINT NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  base_salary NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0,
  bonuses NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  advance_deduction NUMERIC DEFAULT 0,
  net_pay NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. HR: SHIFTS
-- ============================================================

CREATE TABLE IF NOT EXISTS shifts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 20. HR: EMPLOYEE SHIFTS
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_shifts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- ============================================================
-- 21. HR: PERFORMANCE REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS performance_reviews (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id BIGINT NOT NULL REFERENCES users(id),
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  overall_rating NUMERIC,
  strengths TEXT,
  improvements TEXT,
  goals TEXT,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 22. HR: REVIEW CRITERIA
-- ============================================================

CREATE TABLE IF NOT EXISTS review_criteria (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_id BIGINT NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  rating NUMERIC,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 23. SERVICES & SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS service_plans (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual', 'one_time')),
  duration_months INTEGER DEFAULT 1,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  service_type TEXT NOT NULL DEFAULT 'maintenance' CHECK (service_type IN ('maintenance', 'warranty', 'custom')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  plan_id BIGINT REFERENCES service_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  next_billing_date DATE,
  auto_renew BOOLEAN DEFAULT true,
  billing_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 24. SEED: Default Leave Types
-- ============================================================

INSERT INTO leave_types (name, days_per_year, is_paid) VALUES
  ('Annual Leave', 21, true),
  ('Sick Leave', 14, true),
  ('Personal Leave', 5, false),
  ('Maternity Leave', 90, true),
  ('Bereavement Leave', 5, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 25. SEED: Default Subscription Plans
-- ============================================================

INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, max_products, max_users, max_orders_monthly, features) VALUES
  ('Free', 'free', 0, 0, 50, 2, 100, '["basic_pos","inventory","reports"]'),
  ('Pro', 'pro', 599, 5990, 500, 15, -1, '["basic_pos","inventory","reports","accounting","hr","services","priority_support"]'),
  ('Enterprise', 'enterprise', 1499, 14990, -1, -1, -1, '["basic_pos","inventory","reports","accounting","hr","services","priority_support","custom_integrations","dedicated_support"]')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_products = EXCLUDED.max_products,
  max_users = EXCLUDED.max_users,
  max_orders_monthly = EXCLUDED.max_orders_monthly,
  features = EXCLUDED.features;

-- ============================================================
-- 26. TENANT USAGE VIEW (helper for limit checks)
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
-- RELOAD PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
