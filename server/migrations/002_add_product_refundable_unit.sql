-- Migration: Add is_refundable and unit_of_measure to products table
-- Run this in Supabase SQL Editor

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_refundable BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'quantity';
