-- ============================================================
-- RESET ALL DATA (except users)
-- Truncates all transactional data, re-seeds settings & accounts
-- ============================================================

-- Ensure new columns exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'cash';

TRUNCATE TABLE
  refund_items,
  order_items,
  payment_splits,
  stock_movements,
  refunds,
  expenses,
  promotions,
  notifications,
  activity_log,
  journal_entry_lines,
  account_balances,
  payments,
  journal_entries,
  fiscal_periods,
  accounts,
  orders,
  products,
  categories,
  suppliers,
  customers,
  employees,
  store_settings
CASCADE;

-- Re-seed store settings
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
  ('loyaltyPointsPerCurrency', '1')
ON CONFLICT ("key") DO NOTHING;

-- Re-seed chart of accounts
INSERT INTO accounts (code, name, account_type, description) VALUES
  ('1010', 'Cash',                'asset',     'Physical cash in register and vault'),
  ('1020', 'Bank Account',        'asset',     'Business bank account'),
  ('1030', 'Accounts Receivable', 'asset',     'Amounts owed by customers'),
  ('1050', 'Inventory',           'asset',     'Products held for resale'),
  ('2010', 'Accounts Payable',    'liability', 'Amounts owed to suppliers'),
  ('2030', 'VAT Payable',         'liability', 'Tax collected on sales'),
  ('3010', 'Owner Equity',        'equity',    'Capital invested by owner'),
  ('3020', 'Retained Earnings',   'equity',    'Accumulated profit'),
  ('3030', 'Current Year Earnings','equity',   'Net income for current period'),
  ('4010', 'Sales Revenue',       'revenue',   'Revenue from product sales'),
  ('4020', 'Sales Returns',       'revenue',   'Returns and refunds'),
  ('5010', 'Cost of Goods Sold',  'expense',   'Direct cost of products sold'),
  ('5020', 'Operating Expenses',  'expense',   'General operating costs'),
  ('5030', 'Salary Expense',      'expense',   'Employee salaries'),
  ('5040', 'Rent Expense',        'expense',   'Office/store rent'),
  ('5050', 'Utilities Expense',   'expense',   'Electricity, water, internet')
ON CONFLICT (code) DO NOTHING;

-- Re-seed default fiscal period
INSERT INTO fiscal_periods (name, start_date, end_date)
SELECT
  'FY ' || EXTRACT(YEAR FROM NOW()),
  (EXTRACT(YEAR FROM NOW()) || '-01-01')::date,
  (EXTRACT(YEAR FROM NOW()) || '-12-31')::date
WHERE NOT EXISTS (
  SELECT 1 FROM fiscal_periods WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
);
