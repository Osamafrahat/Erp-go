-- 1. Create exec_sql function (needed by migrations)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create set_current_tenant function (needed by auth middleware)
CREATE OR REPLACE FUNCTION set_current_tenant(tid UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant', tid::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create delete_tenant_cascade function
CREATE OR REPLACE FUNCTION delete_tenant_cascade(tenant_uuid UUID)
RETURNS void AS $$
DECLARE
  order_ids BIGINT[];
  journal_ids BIGINT[];
  payroll_ids BIGINT[];
  po_ids BIGINT[];
  refund_ids BIGINT[];
BEGIN
  SELECT array_agg(id) INTO order_ids FROM orders WHERE tenant_id = tenant_uuid;
  SELECT array_agg(id) INTO journal_ids FROM journal_entries WHERE tenant_id = tenant_uuid;
  SELECT array_agg(id) INTO payroll_ids FROM payroll WHERE tenant_id = tenant_uuid;
  SELECT array_agg(id) INTO po_ids FROM purchase_orders WHERE tenant_id = tenant_uuid;
  SELECT array_agg(id) INTO refund_ids FROM refunds WHERE tenant_id = tenant_uuid;

  -- Deepest children
  IF order_ids IS NOT NULL THEN
    DELETE FROM order_items WHERE order_id = ANY(order_ids);
    DELETE FROM refund_items WHERE refund_id IN (SELECT id FROM refunds WHERE order_id = ANY(order_ids));
  END IF;
  DELETE FROM payment_splits WHERE tenant_id = tenant_uuid;
  IF journal_ids IS NOT NULL THEN
    DELETE FROM journal_entry_lines WHERE journal_entry_id = ANY(journal_ids);
  END IF;
  DELETE FROM stock_movements WHERE tenant_id = tenant_uuid;
  IF payroll_ids IS NOT NULL THEN
    DELETE FROM payroll_items WHERE payroll_id = ANY(payroll_ids);
  END IF;
  DELETE FROM shift_assignments WHERE tenant_id = tenant_uuid;
  DELETE FROM review_criteria WHERE tenant_id = tenant_uuid;
  DELETE FROM subscription_payments WHERE tenant_id = tenant_uuid;
  DELETE FROM credit_payments WHERE tenant_id = tenant_uuid;
  IF po_ids IS NOT NULL THEN
    DELETE FROM purchase_order_items WHERE purchase_order_id = ANY(po_ids);
  END IF;
  DELETE FROM commissions WHERE tenant_id = tenant_uuid;
  DELETE FROM cash_shifts WHERE tenant_id = tenant_uuid;
  DELETE FROM product_variants WHERE tenant_id = tenant_uuid;
  DELETE FROM product_batches WHERE tenant_id = tenant_uuid;
  DELETE FROM saved_payment_methods WHERE tenant_id = tenant_uuid;
  DELETE FROM messages WHERE tenant_id = tenant_uuid;

  -- Mid-level
  DELETE FROM refunds WHERE tenant_id = tenant_uuid;
  DELETE FROM orders WHERE tenant_id = tenant_uuid;
  DELETE FROM payments WHERE tenant_id = tenant_uuid;
  DELETE FROM journal_entries WHERE tenant_id = tenant_uuid;
  DELETE FROM expenses WHERE tenant_id = tenant_uuid;
  DELETE FROM attendance WHERE tenant_id = tenant_uuid;
  DELETE FROM leave_requests WHERE tenant_id = tenant_uuid;
  DELETE FROM performance_reviews WHERE tenant_id = tenant_uuid;
  DELETE FROM payroll WHERE tenant_id = tenant_uuid;
  DELETE FROM subscriptions WHERE tenant_id = tenant_uuid;
  DELETE FROM credit_sales WHERE tenant_id = tenant_uuid;
  DELETE FROM purchase_orders WHERE tenant_id = tenant_uuid;
  DELETE FROM promotions WHERE tenant_id = tenant_uuid;
  DELETE FROM activities WHERE tenant_id = tenant_uuid;
  DELETE FROM activity_log WHERE tenant_id = tenant_uuid;

  -- Top-level
  DELETE FROM products WHERE tenant_id = tenant_uuid;
  DELETE FROM categories WHERE tenant_id = tenant_uuid;
  DELETE FROM customers WHERE tenant_id = tenant_uuid;
  DELETE FROM employees WHERE tenant_id = tenant_uuid;
  DELETE FROM suppliers WHERE tenant_id = tenant_uuid;
  DELETE FROM shifts WHERE tenant_id = tenant_uuid;
  DELETE FROM leave_types WHERE tenant_id = tenant_uuid;
  DELETE FROM services WHERE tenant_id = tenant_uuid;
  DELETE FROM service_plans WHERE tenant_id = tenant_uuid;
  DELETE FROM accounts WHERE tenant_id = tenant_uuid;
  DELETE FROM account_balances WHERE tenant_id = tenant_uuid;
  DELETE FROM store_settings WHERE tenant_id = tenant_uuid;
  DELETE FROM users WHERE tenant_id = tenant_uuid;
  DELETE FROM tenant_payments WHERE tenant_id = tenant_uuid;

  -- Tenant itself
  DELETE FROM tenants WHERE id = tenant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Disable RLS on all tables
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 5. Drop all existing policies
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 6. Grant permissions to anon and authenticated roles
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT ALL ON %I TO anon', r.tablename);
    EXECUTE format('GRANT ALL ON %I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON %I TO service_role', r.tablename);
  END LOOP;
END $$;

-- 7. Grant execute on functions
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION set_current_tenant(UUID) TO anon;
GRANT EXECUTE ON FUNCTION set_current_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_tenant_cascade(UUID) TO anon;
GRANT EXECUTE ON FUNCTION delete_tenant_cascade(UUID) TO authenticated;
