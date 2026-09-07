-- Fix all foreign key constraints to use ON DELETE CASCADE
-- This allows cascade deletion of tenants and their data

DO $$
DECLARE r RECORD;
BEGIN
  -- Find all foreign key constraints and recreate them with ON DELETE CASCADE
  FOR r IN
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
        r.table_name, r.constraint_name
      );
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE CASCADE',
        r.table_name, r.constraint_name, r.column_name,
        r.foreign_table_name, r.foreign_column_name
      );
      RAISE NOTICE 'Fixed FK: % -> %', r.table_name, r.foreign_table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip FK %: %', r.constraint_name, SQLERRM;
    END;
  END LOOP;
END $$;
