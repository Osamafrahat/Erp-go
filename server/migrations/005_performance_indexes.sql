-- Performance indexes for frequently queried columns
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Orders: user_id, customer_id, payment_status
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Attendance: employee_id, date
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- Employee shifts: employee_id, date
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_date ON employee_shifts(date);

-- Leave requests: employee_id, status
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- Leave balances: employee_id
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);

-- Payroll items: payroll_id
CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll_id ON payroll_items(payroll_id);

-- Payments: order_id
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- Messages: created_at
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Review criteria: review_id
CREATE INDEX IF NOT EXISTS idx_review_criteria_review_id ON review_criteria(review_id);
