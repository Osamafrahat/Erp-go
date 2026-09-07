-- Migration: Cash Box + Commissions fixes
-- Run this in Supabase SQL Editor

-- Add shift_id to orders (links order to cash shift)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id BIGINT REFERENCES cash_shifts(id) ON DELETE SET NULL;

-- Add index for shift lookups
CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
