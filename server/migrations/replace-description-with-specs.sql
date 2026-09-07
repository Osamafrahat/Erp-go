-- Migration: Replace products.description TEXT with specifications JSONB
-- Run this in Supabase SQL Editor

-- Add specifications column (safe to run even if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'specifications'
  ) THEN
    ALTER TABLE products ADD COLUMN specifications JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Migrate existing description text into specifications (only if description column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'description'
  ) THEN
    UPDATE products
    SET specifications = jsonb_build_array(jsonb_build_object('name', 'Description', 'value', description))
    WHERE description IS NOT NULL AND description != '' AND (specifications IS NULL OR specifications = '[]'::jsonb);

    ALTER TABLE products DROP COLUMN description;
  END IF;
END $$;
