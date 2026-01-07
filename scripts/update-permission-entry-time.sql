-- Script per aggiornare manualmente l'ora di entrata di un permesso
-- Dipendente: Simone Azzinelli
-- Data: 22/12/2025
-- Ora originale: 14:00
-- Nuova ora: 11:00

-- Prima, verifichiamo il record esistente
SELECT 
  lr.id,
  u.first_name || ' ' || u.last_name AS nome_dipendente,
  lr.start_date,
  lr.entry_time AS ora_entrata_attuale,
  lr.hours AS ore_attuali,
  lr.permission_type,
  lr.status,
  ws.start_time AS orario_inizio_lavoro,
  ws.end_time AS orario_fine_lavoro,
  ws.break_duration AS durata_pausa_minuti,
  ws.break_start_time AS inizio_pausa
FROM leave_requests lr
JOIN users u ON lr.user_id = u.id
LEFT JOIN work_schedules ws ON ws.user_id = u.id 
  AND ws.day_of_week = EXTRACT(DOW FROM lr.start_date)
  AND ws.is_working_day = true
WHERE 
  u.first_name = 'Simone' 
  AND u.last_name = 'Azzinelli'
  AND lr.start_date = '2025-12-22'
  AND lr.type = 'permission'
  AND lr.permission_type IN ('late_entry', 'entrata_posticipata')
  AND lr.entry_time = '14:00:00';

-- Aggiorniamo l'ora di entrata da 14:00 a 11:00 e ricalcoliamo le ore
-- Il calcolo segue la logica del codice: (entry_time - start_time) - break se la pausa è inclusa nel periodo
DO $$
DECLARE
  v_record_id UUID;
  v_user_id UUID;
  v_start_time TIME;
  v_break_duration INTEGER;
  v_break_start_time TIME;
  v_day_of_week INTEGER;
  v_entry_minutes INTEGER;
  v_start_minutes INTEGER;
  v_break_start_minutes INTEGER;
  v_break_end_minutes INTEGER;
  v_total_minutes_diff INTEGER;
  v_break_minutes_to_subtract INTEGER := 0;
  v_work_minutes_diff INTEGER;
  v_new_hours NUMERIC;
BEGIN
  -- Trova il record
  SELECT lr.id, lr.user_id, EXTRACT(DOW FROM lr.start_date)::INTEGER
  INTO v_record_id, v_user_id, v_day_of_week
  FROM leave_requests lr
  JOIN users u ON lr.user_id = u.id
  WHERE 
    u.first_name = 'Simone' 
    AND u.last_name = 'Azzinelli'
    AND lr.start_date = '2025-12-22'
    AND lr.type = 'permission'
    AND lr.permission_type IN ('late_entry', 'entrata_posticipata')
    AND lr.entry_time = '14:00:00'
  LIMIT 1;

  IF v_record_id IS NULL THEN
    RAISE EXCEPTION 'Record non trovato';
  END IF;

  -- Recupera lo schedule per quel giorno
  SELECT start_time, break_duration, break_start_time
  INTO v_start_time, v_break_duration, v_break_start_time
  FROM work_schedules
  WHERE user_id = v_user_id
    AND day_of_week = v_day_of_week
    AND is_working_day = true
    AND start_time IS NOT NULL
  LIMIT 1;

  IF v_start_time IS NULL THEN
    RAISE EXCEPTION 'Nessun orario di lavoro trovato per questo giorno';
  END IF;

  -- Calcola i minuti
  v_entry_minutes := 11 * 60; -- 11:00 = 660 minuti
  v_start_minutes := EXTRACT(HOUR FROM v_start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM v_start_time)::INTEGER;
  
  -- Differenza totale in minuti
  v_total_minutes_diff := v_entry_minutes - v_start_minutes;

  -- Verifica se la pausa è completamente inclusa nel periodo di permesso
  IF v_break_duration IS NOT NULL AND v_break_duration > 0 THEN
    IF v_break_start_time IS NOT NULL THEN
      v_break_start_minutes := EXTRACT(HOUR FROM v_break_start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM v_break_start_time)::INTEGER;
      v_break_end_minutes := v_break_start_minutes + v_break_duration;
      
      -- La pausa è inclusa se: break_start >= start_time AND break_end <= entry_time
      IF v_break_start_minutes >= v_start_minutes AND v_break_end_minutes <= v_entry_minutes THEN
        v_break_minutes_to_subtract := v_break_duration;
      END IF;
    END IF;
  END IF;

  -- Calcola le ore effettive
  v_work_minutes_diff := GREATEST(0, v_total_minutes_diff - v_break_minutes_to_subtract);
  v_new_hours := ROUND((v_work_minutes_diff / 60.0)::NUMERIC, 2);

  -- Aggiorna il record
  UPDATE leave_requests
  SET 
    entry_time = '11:00:00',
    hours = v_new_hours
  WHERE id = v_record_id;

  RAISE NOTICE 'Permesso aggiornato: entry_time = 11:00:00, hours = %', v_new_hours;
END $$;

-- Verifichiamo il risultato
SELECT 
  lr.id,
  u.first_name || ' ' || u.last_name AS nome_dipendente,
  lr.start_date,
  lr.entry_time AS nuova_ora_entrata,
  lr.hours AS nuove_ore,
  lr.permission_type,
  lr.status
FROM leave_requests lr
JOIN users u ON lr.user_id = u.id
WHERE 
  u.first_name = 'Simone' 
  AND u.last_name = 'Azzinelli'
  AND lr.start_date = '2025-12-22'
  AND lr.type = 'permission'
  AND lr.permission_type IN ('late_entry', 'entrata_posticipata');


