-- ============================================================
-- MIGRATION: Add 10 new features
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Cash Drawer Shifts (Reconciliation)
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
CREATE INDEX IF NOT EXISTS idx_cash_shifts_tenant ON cash_shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_user ON cash_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);

-- 2. Product Variants
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
CREATE INDEX IF NOT EXISTS idx_product_variants_tenant ON product_variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

-- 3. Credit Sales (Accounts Receivable)
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
CREATE INDEX IF NOT EXISTS idx_credit_sales_tenant ON credit_sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_customer ON credit_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_status ON credit_sales(status);
CREATE INDEX IF NOT EXISTS idx_credit_payments_tenant ON credit_payments(tenant_id);

-- 4. Add reorder fields to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER DEFAULT 0;

-- 5. Product Batches (Expiry Tracking)
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
CREATE INDEX IF NOT EXISTS idx_product_batches_tenant ON product_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(expiry_date);

-- 6. Purchase Orders
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
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant ON purchase_order_items(tenant_id);

-- 7. Hold/Recall is frontend-only (localStorage), no DB needed

-- 8. Customer Statements is query-only, no new tables

-- 9. Salesperson Commission
ALTER TABLE orders ADD COLUMN IF NOT EXISTS salesperson_id BIGINT REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0;
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
CREATE INDEX IF NOT EXISTS idx_commissions_tenant ON commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_employee ON commissions(employee_id);

-- 10. Dead Stock is query-only (products with no sales in X days), no new tables
