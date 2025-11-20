-- Script per aggiornare gli orari di lavoro di Ilaria Spallarossa
-- Email: ilaria.spallarossa@labafirenze.com

-- Prima elimina gli orari esistenti per Ilaria
DELETE FROM work_schedules 
WHERE user_id = (SELECT id FROM users WHERE email = 'ilaria.spallarossa@labafirenze.com');

-- Inserisci i nuovi orari corretti:
-- LUN: 9:30 - 13:30 (no pomeriggio, no pausa) = 4h
-- MAR: 10:00 - 13:00 / 14:00 - 18:00 (pausa 60 minuti 13-14) = 7h
-- MER: 10:00 - 13:00 / 14:00 - 18:00 (pausa 60 minuti 13-14) = 7h
-- GIO: 9:30 - 13:30 (no pomeriggio, no pausa) = 4h
-- VEN: 9:30 - 12:30 (no pomeriggio, no pausa) = 3h

INSERT INTO work_schedules (user_id, day_of_week, is_working_day, work_type, start_time, end_time, break_duration, break_start_time)
SELECT 
  id as user_id,
  day_of_week,
  is_working_day,
  work_type,
  start_time,
  end_time,
  break_duration,
  break_start_time
FROM (
  VALUES
    -- LUNEDÌ (1): 9:30 - 13:30, no pausa
    (1, true, 'morning', '09:30', '13:30', 0, NULL),
    
    -- MARTEDÌ (2): 10:00 - 13:00 / 14:00 - 18:00, pausa 60 minuti 13-14
    (2, true, 'full_day', '10:00', '18:00', 60, '13:00'),
    
    -- MERCOLEDÌ (3): 10:00 - 13:00 / 14:00 - 18:00, pausa 60 minuti 13-14
    (3, true, 'full_day', '10:00', '18:00', 60, '13:00'),
    
    -- GIOVEDÌ (4): 9:30 - 13:30, no pausa
    (4, true, 'morning', '09:30', '13:30', 0, NULL),
    
    -- VENERDÌ (5): 9:30 - 12:30, no pausa
    (5, true, 'morning', '09:30', '12:30', 0, NULL),
    
    -- SABATO (6): non lavorativo
    (6, false, 'full_day', NULL, NULL, 0, NULL),
    
    -- DOMENICA (0): non lavorativo
    (0, false, 'full_day', NULL, NULL, 0, NULL)
) AS schedule_data(day_of_week, is_working_day, work_type, start_time, end_time, break_duration, break_start_time)
CROSS JOIN (SELECT id FROM users WHERE email = 'ilaria.spallarossa@labafirenze.com') AS user_data;

-- Verifica che gli orari siano stati inseriti correttamente
SELECT 
  ws.day_of_week,
  CASE ws.day_of_week
    WHEN 0 THEN 'Domenica'
    WHEN 1 THEN 'Lunedì'
    WHEN 2 THEN 'Martedì'
    WHEN 3 THEN 'Mercoledì'
    WHEN 4 THEN 'Giovedì'
    WHEN 5 THEN 'Venerdì'
    WHEN 6 THEN 'Sabato'
  END as giorno,
  ws.is_working_day,
  ws.work_type,
  ws.start_time,
  ws.end_time,
  ws.break_duration,
  ws.break_start_time
FROM work_schedules ws
JOIN users u ON ws.user_id = u.id
WHERE u.email = 'ilaria.spallarossa@labafirenze.com'
ORDER BY ws.day_of_week;
