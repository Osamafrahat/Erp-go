-- ============================================================================
-- Enable Row Level Security (deny-by-default) across the public schema
-- ============================================================================
--
-- WHY: RLS was disabled, and the browser ships the `anon` key
-- (VITE_SUPABASE_ANON_KEY, used for chat realtime). Anyone could therefore
-- query PostgREST directly and read EVERY tenant's data — including
-- users.password (bcrypt hashes), saved_payment_methods (Paymob card
-- tokens), tenant_payments, orders — and the key also had UPDATE grants.
--
-- WHAT THIS DOES:
--   1. ENABLE ROW LEVEL SECURITY on every table in `public`. With no
--      policies defined, PostgREST access as anon/authenticated is denied
--      for SELECT/INSERT/UPDATE/DELETE. (FORCE is deliberately NOT set so
--      the table owner keeps access from the Supabase SQL Editor.)
--   2. REVOKE the anon/authenticated grants on all tables, views and
--      sequences. RLS alone does not cover views (they execute with owner
--      rights), so the revoke is required for full coverage.
--   3. REVOKE default privileges so tables created in the future are not
--      automatically exposed to anon either.
--
-- WHY THE APP KEEPS WORKING:
--   * The server (Fly.io) talks to PostgREST with the service_role key,
--     which has BYPASSRLS and keeps its grants — all API routes unaffected.
--   * The client never queries tables through the anon key; it only opens
--     Realtime channels and calls the app's own REST API.
--
-- KNOWN DEGRADATION:
--   * Chat's `postgres_changes` subscription on `messages` is RLS-filtered,
--     so realtime events stop reaching the browser. The chat UI's existing
--     10-second polling fallback (GET /api/chat) keeps messages flowing.
--     A future fix is tenant-scoped realtime via an authenticated Supabase
--     JWT; until then polling is the delivery path.
--
-- IDEMPOTENT: safe to run more than once.
--
-- VERIFY AFTER RUNNING (expect 0 rows):
--   SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public' AND rowsecurity = false;
--
-- TO ROLL BACK (do NOT in production):
--   ALTER TABLE public.<t> DISABLE ROW LEVEL SECURITY; -- per table
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

BEGIN;

-- 1. RLS on every public table (no policies => deny by default)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 2. Drop direct PostgREST grants for the browser-facing roles.
--    Covers views as well (RLS cannot be enabled on views).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3. Future tables/views must not be auto-exposed either
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
