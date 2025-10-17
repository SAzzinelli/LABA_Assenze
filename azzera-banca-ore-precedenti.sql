-- =====================================================
-- AZZERA BANCA ORE: Reset saldi storici prima di ottobre 2025
-- =====================================================
--
-- Questo script:
-- 1. Mostra i record prima di ottobre con saldo negativo
-- 2. Azzera SOLO i balance_hours dei record PRIMA del 1 ottobre 2025
-- 3. Mantiene intatti tutti i record di ottobre 2025
-- 
-- ATTENZIONE: Esegui questo script SOLO UNA VOLTA!
-- =====================================================

-- Step 1: Mostra record attuali prima di ottobre (per verificare)
SELECT 
    u.first_name || ' ' || u.last_name AS dipendente,
    a.date,
    a.balance_hours,
    a.actual_hours,
    a.expected_hours
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE a.date < '2025-10-01'
ORDER BY a.date DESC;

-- Step 2: Mostra il saldo totale PRIMA dell'azzeramento
SELECT 
    u.first_name || ' ' || u.last_name AS dipendente,
    SUM(a.balance_hours) AS saldo_totale_prima_azzeramento
FROM attendance a
JOIN users u ON a.user_id = u.id
GROUP BY u.id, u.first_name, u.last_name;

-- Step 3: AZZERA i balance_hours di tutti i record PRIMA del 1 ottobre 2025
UPDATE attendance
SET balance_hours = 0
WHERE date < '2025-10-01';

-- Step 4: Mostra il saldo totale DOPO l'azzeramento (per verifica)
SELECT 
    u.first_name || ' ' || u.last_name AS dipendente,
    SUM(a.balance_hours) AS saldo_totale_dopo_azzeramento
FROM attendance a
JOIN users u ON a.user_id = u.id
GROUP BY u.id, u.first_name, u.last_name;

-- Step 5: Verifica finale - mostra solo record di ottobre
SELECT 
    u.first_name || ' ' || u.last_name AS dipendente,
    COUNT(*) AS giorni_ottobre,
    SUM(a.balance_hours) AS saldo_ottobre
FROM attendance a
JOIN users u ON a.user_id = u.id
WHERE a.date >= '2025-10-01' AND a.date < '2025-11-01'
GROUP BY u.id, u.first_name, u.last_name;

