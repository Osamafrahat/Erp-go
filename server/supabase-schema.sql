-- ============================================================
-- STORE MANAGEMENT SYSTEM - COMPLETE DATABASE SCHEMA
-- Single consolidated file — includes all tables, columns,
-- indexes, RLS policies, seed data, and admin user.
-- Run this in Supabase SQL Editor to set up or reset the DB.
-- ============================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  account_code TEXT UNIQUE,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT UNIQUE,
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
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
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
  username TEXT NOT NULL UNIQUE,
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ACCOUNTING TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  parent_id BIGINT REFERENCES accounts(id),
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EGP',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id BIGSERIAL PRIMARY KEY,
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
  entry_number TEXT NOT NULL UNIQUE,
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  payment_number TEXT NOT NULL UNIQUE,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_balances (
  id BIGSERIAL PRIMARY KEY,
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
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ORDERS & SALES
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
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
  client_order_id TEXT UNIQUE,
  notes TEXT,
  eta_uuid TEXT,
  eta_qr_code TEXT,
  eta_status TEXT DEFAULT 'pending',
  eta_submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
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
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  reference_id BIGINT,
  notes TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. REFUNDS (full & item-level)
-- ============================================================

CREATE TABLE IF NOT EXISTS refunds (
  id BIGSERIAL PRIMARY KEY,
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
  "key" TEXT NOT NULL UNIQUE,
  value TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
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
-- 6. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_client_order_id ON orders(client_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_refund ON refund_items(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_order_item ON refund_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period ON journal_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_account_balances_account ON account_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_period ON account_balances(period_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);

-- Performance indexes from migration 005
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- ============================================================
-- 7. ROW LEVEL SECURITY (ALL tables)
-- ============================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON categories;
CREATE POLICY "Allow all" ON categories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON suppliers;
CREATE POLICY "Allow all" ON suppliers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON products;
CREATE POLICY "Allow all" ON products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON customers;
CREATE POLICY "Allow all" ON customers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON employees;
CREATE POLICY "Allow all" ON employees FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON users;
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON accounts;
CREATE POLICY "Allow all" ON accounts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON fiscal_periods;
CREATE POLICY "Allow all" ON fiscal_periods FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON journal_entries;
CREATE POLICY "Allow all" ON journal_entries FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON journal_entry_lines;
CREATE POLICY "Allow all" ON journal_entry_lines FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payments;
CREATE POLICY "Allow all" ON payments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON account_balances;
CREATE POLICY "Allow all" ON account_balances FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON orders;
CREATE POLICY "Allow all" ON orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON order_items;
CREATE POLICY "Allow all" ON order_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payment_splits;
CREATE POLICY "Allow all" ON payment_splits FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON stock_movements;
CREATE POLICY "Allow all" ON stock_movements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON promotions;
CREATE POLICY "Allow all" ON promotions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON refunds;
CREATE POLICY "Allow all" ON refunds FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE refund_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON refund_items;
CREATE POLICY "Allow all" ON refund_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON expenses;
CREATE POLICY "Allow all" ON expenses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON store_settings;
CREATE POLICY "Allow all" ON store_settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON activity_log;
CREATE POLICY "Allow all" ON activity_log FOR ALL USING (true) WITH CHECK (true);

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
  user_id BIGINT REFERENCES users(id),
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to messages" ON messages
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 13. HR: ATTENDANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
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

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON attendance;
CREATE POLICY "Allow all" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 14. HR: LEAVE TYPES
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  days_per_year INT NOT NULL DEFAULT 0,
  is_paid BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_types;
CREATE POLICY "Allow all" ON leave_types FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 15. HR: LEAVE REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGSERIAL PRIMARY KEY,
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

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_requests;
CREATE POLICY "Allow all" ON leave_requests FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 16. HR: LEAVE BALANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_balances (
  id BIGSERIAL PRIMARY KEY,
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

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON leave_balances;
CREATE POLICY "Allow all" ON leave_balances FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 17. HR: PAYROLL
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll (
  id BIGSERIAL PRIMARY KEY,
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

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payroll;
CREATE POLICY "Allow all" ON payroll FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 18. HR: PAYROLL ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_items (
  id BIGSERIAL PRIMARY KEY,
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

ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON payroll_items;
CREATE POLICY "Allow all" ON payroll_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 19. HR: SHIFTS
-- ============================================================

CREATE TABLE IF NOT EXISTS shifts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON shifts;
CREATE POLICY "Allow all" ON shifts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 20. HR: EMPLOYEE SHIFTS
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_shifts (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON employee_shifts;
CREATE POLICY "Allow all" ON employee_shifts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 21. HR: PERFORMANCE REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS performance_reviews (
  id BIGSERIAL PRIMARY KEY,
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

ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON performance_reviews;
CREATE POLICY "Allow all" ON performance_reviews FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 22. HR: REVIEW CRITERIA
-- ============================================================

CREATE TABLE IF NOT EXISTS review_criteria (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
  criterion TEXT NOT NULL,
  rating NUMERIC,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE review_criteria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON review_criteria;
CREATE POLICY "Allow all" ON review_criteria FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 23. SERVICES & SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS service_plans (
  id BIGSERIAL PRIMARY KEY,
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
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON service_plans;
CREATE POLICY "Allow all" ON service_plans FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON services;
CREATE POLICY "Allow all" ON services FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subscriptions;
CREATE POLICY "Allow all" ON subscriptions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subscription_payments;
CREATE POLICY "Allow all" ON subscription_payments FOR ALL USING (true) WITH CHECK (true);

-- Services/Subscriptions indexes (must be after table creation)
CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_service_plans_cycle ON service_plans(billing_cycle);
CREATE INDEX IF NOT EXISTS idx_service_plans_active ON service_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_service ON subscriptions(service_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_sub ON subscription_payments(subscription_id);

-- Remaining indexes (must be after table creation)
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_date ON employee_shifts(date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll_id ON payroll_items(payroll_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_review_criteria_review_id ON review_criteria(review_id);

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
