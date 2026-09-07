-- 1. Create exec_sql function
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create set_current_tenant function (BIGINT matches tenant_id type)
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id BIGINT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant', p_tenant_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Disable RLS on all tables
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 4. Drop all existing policies
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 5. Grant permissions
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT ALL ON %I TO anon', r.tablename);
    EXECUTE format('GRANT ALL ON %I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON %I TO service_role', r.tablename);
  END LOOP;
END $$;

-- 6. Grant execute on functions
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION set_current_tenant(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION set_current_tenant(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_current_tenant(BIGINT) TO service_role;
