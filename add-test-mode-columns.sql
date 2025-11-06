-- Aggiungi colonne per modalità test nella tabella users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS test_mode_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS test_mode_date DATE,
ADD COLUMN IF NOT EXISTS test_mode_time TIME;
