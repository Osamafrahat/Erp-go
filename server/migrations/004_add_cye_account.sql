-- Migration: Add Current Year Earnings (3030) account if missing
-- Run this in Supabase SQL Editor

INSERT INTO accounts (code, name, account_type, balance)
SELECT '3030', 'Current Year Earnings', 'equity', 0
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '3030');
