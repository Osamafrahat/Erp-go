-- ============================================================
-- HR MODULE MIGRATION
-- Run this in Supabase SQL Editor to create all HR tables.
-- Safe to run multiple times (CREATE IF NOT EXISTS).
-- ============================================================

-- 1. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  overtime_hours NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON attendance;
CREATE POLICY "Allow all" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- 2. LEAVE TYPES
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

-- 3. LEAVE REQUESTS
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

-- 4. LEAVE BALANCES
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

-- 5. PAYROLL
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

-- 6. PAYROLL ITEMS
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

-- 7. SHIFTS
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

-- 8. EMPLOYEE SHIFTS
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

-- 9. PERFORMANCE REVIEWS
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

-- 10. REVIEW CRITERIA
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
-- SEED: Default Leave Types
-- ============================================================

INSERT INTO leave_types (name, days_per_year, is_paid) VALUES
  ('Annual Leave', 21, true),
  ('Sick Leave', 14, true),
  ('Personal Leave', 5, false),
  ('Maternity Leave', 90, true),
  ('Bereavement Leave', 5, true)
ON CONFLICT DO NOTHING;
