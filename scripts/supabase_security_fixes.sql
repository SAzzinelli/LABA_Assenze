-- SUPABASE SECURITY FIXES
-- 1) Fix mutable search_path for functions (0011_function_search_path_mutable)
-- 2) Add minimal RLS policies for service_role on key tables (0008_rls_enabled_no_policy)

-- ============================================
-- 1) Set immutable search_path for listed functions
-- This will generate and execute ALTER FUNCTION ... SET search_path = public
-- for the functions reported by Supabase advisors
DO $$
DECLARE
  rec RECORD;
  fn_sql text;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema,
           p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at_column',
        'calculate_worked_hours',
        'is_holiday',
        'update_leave_balance'
      )
  LOOP
    fn_sql := format('ALTER FUNCTION %I.%I(%s) SET search_path = public;',
                     rec.schema, rec.name, rec.args);
    RAISE NOTICE 'Executing: %', fn_sql;
    EXECUTE fn_sql;
  END LOOP;
END $$;

-- ============================================
-- 2) Minimal RLS policies for service_role
-- These policies allow only Supabase service role to perform CRUD.
-- Your backend (using SERVICE_KEY) bypasses RLS via this policy; clients remain blocked.

-- Helper: create policy if not exists
DO $$
DECLARE
  t text;
  pol_name text;
  ddl text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'attendance',
    'business_trips',
    'contract_types',
    'current_balances',
    'employees',
    'hours_balance',
    'hours_ledger',
    'leave_requests',
    'users',
    'work_patterns'
  ]
  LOOP
    -- READ policy
    pol_name := 'svc_read_' || t;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=pol_name
    ) THEN
      ddl := format('CREATE POLICY %I ON public.%I FOR SELECT USING (auth.role() = ''service_role'');', pol_name, t);
      RAISE NOTICE 'Executing: %', ddl;
      EXECUTE ddl;
    END IF;

    -- WRITE policy
    pol_name := 'svc_write_' || t;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=pol_name
    ) THEN
      ddl := format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'');', pol_name, t);
      RAISE NOTICE 'Executing: %', ddl;
      EXECUTE ddl;
    END IF;
  END LOOP;
END $$;

-- NOTE:
-- If any of these tables do NOT use RLS intentionally, you can disable RLS instead of adding policies:
--   ALTER TABLE public.table_name DISABLE ROW LEVEL SECURITY;
-- Otherwise, keep RLS enabled and refine policies later for end-user access.


