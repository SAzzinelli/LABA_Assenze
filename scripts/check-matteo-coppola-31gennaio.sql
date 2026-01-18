-- Verifica se ci sono log/record positivi per Matteo Coppola il 31 gennaio
-- Cerca in tutte le tabelle rilevanti: attendance, hours_ledger, current_balances

-- 1. Verifica nella tabella attendance (presenze con balance_hours > 0)
SELECT 
  'attendance' AS tabella,
  a.id,
  u.first_name || ' ' || u.last_name AS nome_dipendente,
  a.date,
  a.actual_hours,
  a.expected_hours,
  a.balance_hours,
  a.notes
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE 
  u.first_name = 'Matteo' 
  AND u.last_name = 'Coppola'
  AND a.date IN ('2025-01-31', '2026-01-31')
  AND (a.balance_hours > 0 OR a.actual_hours > a.expected_hours)
ORDER BY a.date DESC;

-- 2. Verifica nella tabella hours_ledger (transazioni positive) - COMMENTATO se la tabella non esiste
-- SELECT 
--   'hours_ledger' AS tabella,
--   hl.id,
--   u.first_name || ' ' || u.last_name AS nome_dipendente,
--   hl.transaction_date,
--   hl.transaction_type,
--   hl.category,
--   hl.hours_amount,
--   hl.running_balance,
--   hl.description
-- FROM hours_ledger hl
-- JOIN users u ON hl.user_id = u.id
-- WHERE 
--   u.first_name = 'Matteo' 
--   AND u.last_name = 'Coppola'
--   AND hl.transaction_date IN ('2025-01-31', '2026-01-31')
--   AND hl.hours_amount > 0
-- ORDER BY hl.transaction_date DESC, hl.created_at DESC;

-- 3. Verifica se ci sono record anche senza filtro sul balance positivo (tutti i record del 31 gennaio)
SELECT 
  'attendance_all' AS tabella,
  a.id,
  u.first_name || ' ' || u.last_name AS nome_dipendente,
  a.date,
  a.actual_hours,
  a.expected_hours,
  a.balance_hours,
  a.notes
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE 
  u.first_name = 'Matteo' 
  AND u.last_name = 'Coppola'
  AND a.date IN ('2025-01-31', '2026-01-31')
ORDER BY a.date DESC;
