-- Reset all data except users
-- Run this in Supabase SQL Editor

-- Disable triggers temporarily for faster deletion
SET session_replication_role = 'replica';

-- Delete in order (respect foreign key constraints)
DELETE FROM subscription_payments;
DELETE FROM subscriptions;
DELETE FROM service_plans;
DELETE FROM services;
DELETE FROM performance_reviews;
DELETE FROM review_criteria;
DELETE FROM payroll_items;
DELETE FROM payroll;
DELETE FROM leave_requests;
DELETE FROM leave_balances;
DELETE FROM leave_types;
DELETE FROM employee_shifts;
DELETE FROM attendance;
DELETE FROM shifts;
DELETE FROM messages;
DELETE FROM activity_log;
DELETE FROM refund_items;
DELETE FROM refunds;
DELETE FROM payment_splits;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM stock_movements;
DELETE FROM payments;
DELETE FROM expenses;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM promotions;
DELETE FROM customers;
DELETE FROM suppliers;
DELETE FROM journal_entry_lines;
DELETE FROM journal_entries;
DELETE FROM fiscal_periods;
DELETE FROM accounts;
DELETE FROM store_settings;

-- Re-enable triggers
SET session_replication_role = 'origin';
