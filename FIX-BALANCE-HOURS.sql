-- =====================================================
-- FIX BALANCE HOURS: Ricalcola tutti i saldi correttamente
-- =====================================================
--
-- Problema: balance_hours non è coerente con actual_hours - expected_hours
-- Soluzione: Ricalcola balance_hours = actual_hours - expected_hours per TUTTI i record
-- 
-- ESEGUI QUESTO SQL SU SUPABASE SQL EDITOR
-- =====================================================

-- Step 1: Mostra il problema attuale
SELECT 
    u.first_name || ' ' || u.last_name AS dipendente,
    a.date,
    a.actual_hours,
    a.expected_hours,
    a.balance_hours AS balance_salvato,
    (a.actual_hours - a.expected_hours) AS balance_calcolato,
    (a.balance_hours - (a.actual_hours - a.expected_hours)) AS differenza
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE ABS(a.balance_hours - (a.actual_hours - a.expected_hours)) > 0.01
ORDER BY a.date DESC;

-- Step 2: RICALCOLA balance_hours per TUTTI i record
UPDATE attendance
SET balance_hours = (actual_hours - expected_hours);

-- Step 3: Verifica che ora sia tutto corretto
SELECT 
    u.first_name || ' ' || u.last_name AS dipendente,
    SUM(a.balance_hours) AS saldo_totale_CORRETTO
FROM attendance a
JOIN users u ON a.user_id = u.id
GROUP BY u.id, u.first_name, u.last_name;

-- Step 4: Mostra tutti i record di ottobre
SELECT 
    u.first_name || ' ' || u.last_name AS dipendente,
    a.date,
    a.actual_hours,
    a.expected_hours,
    a.balance_hours
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE a.date >= '2025-10-01' AND a.date < '2025-11-01'
ORDER BY a.date ASC, u.last_name ASC;

