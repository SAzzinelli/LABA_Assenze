-- Aggiunge il campo break_start_time alla tabella work_schedules
-- Questo permette di specificare l'orario di inizio pausa per ogni dipendente

-- 1. Aggiungi la colonna break_start_time
ALTER TABLE work_schedules 
ADD COLUMN IF NOT EXISTS break_start_time TIME DEFAULT '13:00';

-- 2. Commenta: Il campo break_start_time indica quando inizia la pausa pranzo
COMMENT ON COLUMN work_schedules.break_start_time IS 'Orario di inizio pausa pranzo (es. 13:00)';

-- 3. Aggiorna i record esistenti con un orario di default (13:00)
-- Questo verrà poi personalizzato per ogni dipendente
UPDATE work_schedules
SET break_start_time = '13:00'
WHERE break_start_time IS NULL AND is_working_day = true;

-- Verifica
SELECT 
  u.first_name, 
  u.last_name,
  ws.day_of_week,
  ws.start_time,
  ws.end_time,
  ws.break_start_time,
  ws.break_duration
FROM work_schedules ws
JOIN users u ON u.id = ws.user_id
WHERE ws.is_working_day = true
ORDER BY u.last_name, ws.day_of_week;

