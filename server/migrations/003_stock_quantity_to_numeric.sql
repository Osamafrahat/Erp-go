-- Migration: Change quantity columns from INTEGER to NUMERIC for fractional units (KG/L/M)
-- Run this in Supabase SQL Editor

-- Products stock_quantity
ALTER TABLE products ALTER COLUMN stock_quantity TYPE NUMERIC USING stock_quantity::NUMERIC;
ALTER TABLE products ALTER COLUMN stock_quantity SET DEFAULT 0;

-- Stock movements quantity
ALTER TABLE stock_movements ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC;

-- Order items quantity
ALTER TABLE order_items ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC;

-- Refund items quantity
ALTER TABLE refund_items ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC;
