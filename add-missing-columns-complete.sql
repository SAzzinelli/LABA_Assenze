-- Aggiungi tutte le colonne mancanti alla tabella leave_requests
-- Esegui questo script nel SQL Editor di Supabase

ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS doctor TEXT,
ADD COLUMN IF NOT EXISTS permission_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS hours DECIMAL(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS entry_time TIME,
ADD COLUMN IF NOT EXISTS exit_time TIME;

-- Verifica che le colonne siano state aggiunte
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'leave_requests' 
ORDER BY ordinal_position;
