-- FIX SUPABASE LINTER ISSUES
-- Risolve i warning e suggerimenti del database linter di Supabase

-- ============================================
-- 1) FIX WARNING: Function Search Path Mutable
-- ============================================
-- La funzione update_absence_104_updated_at() deve avere search_path sicuro
-- per prevenire attacchi SQL injection tramite search_path manipulation

-- Fix search_path per sicurezza (previene SQL injection via search_path manipulation)
-- Usiamo public, pg_catalog per mantenere accesso a NOW() e altre funzioni standard
ALTER FUNCTION public.update_absence_104_updated_at() 
SET search_path = public, pg_catalog;

-- ============================================
-- 2) FIX SUGGESTIONS: RLS Enabled No Policy
-- ============================================
-- Le tabelle recovery_requests, test_attendance, test_leave_requests
-- hanno RLS abilitato ma senza policy, quindi sono bloccate per tutti.
-- 
-- Opzioni:
-- A) Creare policy per service_role (consigliato se vuoi mantenere RLS)
-- B) Disabilitare RLS (se queste tabelle non necessitano RLS)

-- OPZIONE A: Creare policy per service_role (consigliato)
-- Questo permette al backend (che usa SERVICE_KEY) di accedere alle tabelle
-- mentre i client diretti rimangono bloccati

-- Policy per recovery_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'recovery_requests' 
    AND policyname = 'svc_all_recovery_requests'
  ) THEN
    CREATE POLICY svc_all_recovery_requests ON public.recovery_requests
    FOR ALL 
    USING (auth.role() = 'service_role') 
    WITH CHECK (auth.role() = 'service_role');
    
    RAISE NOTICE 'Created policy svc_all_recovery_requests for recovery_requests';
  END IF;
END $$;

-- Policy per test_attendance (tabella di test)
-- Riabilitiamo RLS e creiamo policy per service_role (backend può accedere, client no)
DO $$
BEGIN
  -- Assicurati che RLS sia abilitato
  ALTER TABLE IF EXISTS public.test_attendance ENABLE ROW LEVEL SECURITY;
  
  -- Rimuovi policy esistenti se ci sono
  DROP POLICY IF EXISTS svc_all_test_attendance ON public.test_attendance;
  
  -- Crea policy per service_role
  CREATE POLICY svc_all_test_attendance ON public.test_attendance
  FOR ALL 
  USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');
  
  RAISE NOTICE 'Created policy svc_all_test_attendance for test_attendance';
END $$;

-- Policy per test_leave_requests (tabella di test)
-- Riabilitiamo RLS e creiamo policy per service_role (backend può accedere, client no)
DO $$
BEGIN
  -- Assicurati che RLS sia abilitato
  ALTER TABLE IF EXISTS public.test_leave_requests ENABLE ROW LEVEL SECURITY;
  
  -- Rimuovi policy esistenti se ci sono
  DROP POLICY IF EXISTS svc_all_test_leave_requests ON public.test_leave_requests;
  
  -- Crea policy per service_role
  CREATE POLICY svc_all_test_leave_requests ON public.test_leave_requests
  FOR ALL 
  USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');
  
  RAISE NOTICE 'Created policy svc_all_test_leave_requests for test_leave_requests';
END $$;

-- ============================================
-- NOTE IMPORTANTI:
-- ============================================
-- 1. Le policy per service_role permettono al backend (con SERVICE_KEY) 
--    di accedere alle tabelle normalmente. I client diretti (anon/authenticated)
--    rimangono bloccati a meno che non aggiungi policy specifiche per loro.
--
-- 2. Le tabelle test_* hanno RLS abilitato con policy per service_role.
--    Questo soddisfa i requisiti di sicurezza di Supabase (tutte le tabelle
--    pubbliche devono avere RLS) mantenendo l'accesso dal backend.
--
-- 3. Se in futuro vuoi permettere accesso anche agli utenti autenticati,
--    aggiungi policy aggiuntive tipo:
--    CREATE POLICY user_read_own ON public.recovery_requests
--    FOR SELECT USING (auth.uid() = user_id);

