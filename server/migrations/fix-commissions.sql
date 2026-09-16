-- Migration: Fix commissions table + product commission_rate
-- Run this in Supabase SQL Editor

-- 1. Ensure commissions table exists
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

-- 2. Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_commissions_tenant ON commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_employee ON commissions(employee_id);

-- 3. Ensure commission_rate column exists on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0;

-- 4. Ensure salesperson_id column exists on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS salesperson_id BIGINT REFERENCES employees(id) ON DELETE SET NULL;

-- 5. Disable RLS on commissions (like other tables)
ALTER TABLE commissions DISABLE ROW LEVEL SECURITY;
