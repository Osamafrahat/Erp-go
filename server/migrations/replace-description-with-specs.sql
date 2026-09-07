-- Migration: Replace product description with specifications JSONB
-- Run this in Supabase SQL Editor

-- Add specifications column
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '[]';

-- Migrate existing description data to specifications format (if any descriptions exist)
UPDATE products
SET specifications = jsonb_build_array(jsonb_build_object('name', 'Description', 'value', description))
WHERE description IS NOT NULL AND description != '' AND specifications = '[]'::jsonb;

-- Drop the old description column
ALTER TABLE products DROP COLUMN IF EXISTS description;
