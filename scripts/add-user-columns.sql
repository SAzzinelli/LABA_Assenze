-- Aggiungi colonne mancanti alla tabella users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS workplace TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Aggiorna dati per Simone
UPDATE users SET 
  phone = '+39 333 123 4567',
  position = 'Sviluppatore Full Stack',
  department = 'Reparto IT',
  hire_date = '2023-01-15',
  workplace = 'LABA Firenze - Sede Via Vecchietti',
  contract_type = 'Full Time - Indeterminato',
  birth_date = '1994-05-15'
WHERE email = 'simone.azzinelli@labafirenze.com';

-- Verifica aggiornamento
SELECT id, email, first_name, last_name, phone, position, department, hire_date, workplace, contract_type, birth_date, has_104 
FROM users 
WHERE email = 'simone.azzinelli@labafirenze.com';
