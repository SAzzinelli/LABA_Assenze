-- Aggiungi campi mancanti alla tabella leave_requests
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS permission_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS hours DECIMAL(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS exit_time TIME,
ADD COLUMN IF NOT EXISTS entry_time TIME;
