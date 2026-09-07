-- Create a function to safely delete a tenant and all its data with CASCADE
CREATE OR REPLACE FUNCTION delete_tenant_cascade(tenant_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Deepest children first
  DELETE FROM refund_items WHERE order_id IN (SELECT id FROM orders WHERE tenant_id = tenant_uuid);
  DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE tenant_id = tenant_uuid);
  DELETE FROM payment_splits WHERE tenant_id = tenant_uuid;
  DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE tenant_id = tenant_uuid);
  DELETE FROM stock_movements WHERE tenant_id = tenant_uuid;
  DELETE FROM payroll_items WHERE payroll_id IN (SELECT id FROM payroll WHERE tenant_id = tenant_uuid);
  DELETE FROM shift_assignments WHERE tenant_id = tenant_uuid;
  DELETE FROM review_criteria WHERE tenant_id = tenant_uuid;
  DELETE FROM subscription_payments WHERE tenant_id = tenant_uuid;
  DELETE FROM credit_payments WHERE tenant_id = tenant_uuid;
  DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE tenant_id = tenant_uuid);
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
$$ LANGUAGE plpgsql;
