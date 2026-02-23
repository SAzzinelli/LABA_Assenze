-- Elenco completo permessi di Matteo Coppola
-- Include: permessi orari, permessi 104, cronologia (created_at, updated_at, approved_at)
-- Esegui in Supabase SQL Editor

-- 1. Utente
SELECT id, first_name, last_name, email, department, has_104 
FROM users 
WHERE first_name = 'Matteo' AND last_name = 'Coppola';

-- 2. TUTTI i permessi orari (type = 'permission')
SELECT 
  lr.id,
  lr.status,
  lr.start_date,
  lr.end_date,
  lr.permission_type,
  lr.hours,
  lr.entry_time,
  lr.exit_time,
  lr.reason,
  lr.notes,
  lr.created_at,
  lr.updated_at,
  lr.approved_at,
  lr.rejection_reason,
  CASE 
    WHEN lr.updated_at IS NOT NULL AND lr.created_at IS NOT NULL 
         AND lr.updated_at > lr.created_at + interval '1 second'
    THEN 'SÌ'
    ELSE 'NO'
  END AS modificato_dopo_creazione
FROM leave_requests lr
JOIN users u ON lr.user_id = u.id
WHERE u.first_name = 'Matteo' AND u.last_name = 'Coppola'
  AND lr.type = 'permission'
ORDER BY lr.start_date DESC;

-- 3. TUTTI i permessi 104 (type = 'permission_104')
SELECT 
  lr.id,
  lr.status,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.reason,
  lr.notes,
  lr.created_at,
  lr.updated_at,
  lr.approved_at,
  lr.rejection_reason,
  CASE 
    WHEN lr.updated_at IS NOT NULL AND lr.created_at IS NOT NULL 
         AND lr.updated_at > lr.created_at + interval '1 second'
    THEN 'SÌ'
    ELSE 'NO'
  END AS modificato_dopo_creazione
FROM leave_requests lr
JOIN users u ON lr.user_id = u.id
WHERE u.first_name = 'Matteo' AND u.last_name = 'Coppola'
  AND lr.type = 'permission_104'
ORDER BY lr.start_date DESC;

-- 4. Permessi ATTIVI (approvati e non scaduti)
SELECT 
  lr.type,
  lr.status,
  lr.start_date,
  lr.end_date,
  lr.permission_type,
  lr.hours,
  lr.days_requested
FROM leave_requests lr
JOIN users u ON lr.user_id = u.id
WHERE u.first_name = 'Matteo' AND u.last_name = 'Coppola'
  AND lr.type IN ('permission', 'permission_104')
  AND lr.status = 'approved'
  AND lr.end_date >= CURRENT_DATE
ORDER BY lr.start_date;
