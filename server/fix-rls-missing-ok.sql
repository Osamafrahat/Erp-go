-- Fix RLS policies that use current_setting('app.current_tenant') without missing_ok=true
-- This causes error 42704 on first request (signup) when the param isn't set yet.
-- Drop and recreate all tenant_isolation policies with the safe form.

-- tenants
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

-- tenant_payments
DROP POLICY IF EXISTS "tenant_isolation" ON tenant_payments;
CREATE POLICY "tenant_isolation" ON tenant_payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- categories
DROP POLICY IF EXISTS "tenant_isolation" ON categories;
CREATE POLICY "tenant_isolation" ON categories
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- suppliers
DROP POLICY IF EXISTS "tenant_isolation" ON suppliers;
CREATE POLICY "tenant_isolation" ON suppliers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- products
DROP POLICY IF EXISTS "tenant_isolation" ON products;
CREATE POLICY "tenant_isolation" ON products
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- customers
DROP POLICY IF EXISTS "tenant_isolation" ON customers;
CREATE POLICY "tenant_isolation" ON customers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- employees
DROP POLICY IF EXISTS "tenant_isolation" ON employees;
CREATE POLICY "tenant_isolation" ON employees
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- users
DROP POLICY IF EXISTS "tenant_isolation" ON users;
CREATE POLICY "tenant_isolation" ON users
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- accounts
DROP POLICY IF EXISTS "tenant_isolation" ON accounts;
CREATE POLICY "tenant_isolation" ON accounts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- fiscal_periods
DROP POLICY IF EXISTS "tenant_isolation" ON fiscal_periods;
CREATE POLICY "tenant_isolation" ON fiscal_periods
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- journal_entries
DROP POLICY IF EXISTS "tenant_isolation" ON journal_entries;
CREATE POLICY "tenant_isolation" ON journal_entries
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- journal_entry_lines
DROP POLICY IF EXISTS "tenant_isolation" ON journal_entry_lines;
CREATE POLICY "tenant_isolation" ON journal_entry_lines
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- payments
DROP POLICY IF EXISTS "tenant_isolation" ON payments;
CREATE POLICY "tenant_isolation" ON payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- account_balances
DROP POLICY IF EXISTS "tenant_isolation" ON account_balances;
CREATE POLICY "tenant_isolation" ON account_balances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- promotions
DROP POLICY IF EXISTS "tenant_isolation" ON promotions;
CREATE POLICY "tenant_isolation" ON promotions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- orders
DROP POLICY IF EXISTS "tenant_isolation" ON orders;
CREATE POLICY "tenant_isolation" ON orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- order_items
DROP POLICY IF EXISTS "tenant_isolation" ON order_items;
CREATE POLICY "tenant_isolation" ON order_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- payment_splits
DROP POLICY IF EXISTS "tenant_isolation" ON payment_splits;
CREATE POLICY "tenant_isolation" ON payment_splits
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- stock_movements
DROP POLICY IF EXISTS "tenant_isolation" ON stock_movements;
CREATE POLICY "tenant_isolation" ON stock_movements
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- refunds
DROP POLICY IF EXISTS "tenant_isolation" ON refunds;
CREATE POLICY "tenant_isolation" ON refunds
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- refund_items
DROP POLICY IF EXISTS "tenant_isolation" ON refund_items;
CREATE POLICY "tenant_isolation" ON refund_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- expenses
DROP POLICY IF EXISTS "tenant_isolation" ON expenses;
CREATE POLICY "tenant_isolation" ON expenses
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- store_settings
DROP POLICY IF EXISTS "tenant_isolation" ON store_settings;
CREATE POLICY "tenant_isolation" ON store_settings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- activity_log
DROP POLICY IF EXISTS "tenant_isolation" ON activity_log;
CREATE POLICY "tenant_isolation" ON activity_log
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- messages
DROP POLICY IF EXISTS "tenant_isolation" ON messages;
CREATE POLICY "tenant_isolation" ON messages
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- attendance
DROP POLICY IF EXISTS "tenant_isolation" ON attendance;
CREATE POLICY "tenant_isolation" ON attendance
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- leave_types
DROP POLICY IF EXISTS "tenant_isolation" ON leave_types;
CREATE POLICY "tenant_isolation" ON leave_types
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- leave_requests
DROP POLICY IF EXISTS "tenant_isolation" ON leave_requests;
CREATE POLICY "tenant_isolation" ON leave_requests
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- leave_balances
DROP POLICY IF EXISTS "tenant_isolation" ON leave_balances;
CREATE POLICY "tenant_isolation" ON leave_balances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- payroll
DROP POLICY IF EXISTS "tenant_isolation" ON payroll;
CREATE POLICY "tenant_isolation" ON payroll
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- payroll_items
DROP POLICY IF EXISTS "tenant_isolation" ON payroll_items;
CREATE POLICY "tenant_isolation" ON payroll_items
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- shifts
DROP POLICY IF EXISTS "tenant_isolation" ON shifts;
CREATE POLICY "tenant_isolation" ON shifts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- employee_shifts
DROP POLICY IF EXISTS "tenant_isolation" ON employee_shifts;
CREATE POLICY "tenant_isolation" ON employee_shifts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- performance_reviews
DROP POLICY IF EXISTS "tenant_isolation" ON performance_reviews;
CREATE POLICY "tenant_isolation" ON performance_reviews
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- review_criteria
DROP POLICY IF EXISTS "tenant_isolation" ON review_criteria;
CREATE POLICY "tenant_isolation" ON review_criteria
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- service_plans
DROP POLICY IF EXISTS "tenant_isolation" ON service_plans;
CREATE POLICY "tenant_isolation" ON service_plans
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- services
DROP POLICY IF EXISTS "tenant_isolation" ON services;
CREATE POLICY "tenant_isolation" ON services
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- subscriptions
DROP POLICY IF EXISTS "tenant_isolation" ON subscriptions;
CREATE POLICY "tenant_isolation" ON subscriptions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- subscription_payments
DROP POLICY IF EXISTS "tenant_isolation" ON subscription_payments;
CREATE POLICY "tenant_isolation" ON subscription_payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::bigint)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::bigint);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
