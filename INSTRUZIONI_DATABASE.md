# 🔧 ISTRUZIONI PER AGGIUNGERE CAMPI AL DATABASE

## ❌ PROBLEMA IDENTIFICATO:
I campi della registrazione non sono visibili nel profilo perché **non esistono nel database**.

## 📋 CAMPI MANCANTI:
- `phone` (TEXT)
- `position` (TEXT) 
- `department` (TEXT)
- `hire_date` (DATE)
- `workplace` (TEXT)
- `contract_type` (TEXT)
- `birth_date` (DATE)

## ✅ SOLUZIONE:

### 1. Vai su Supabase Dashboard
- Apri https://supabase.com/dashboard
- Accedi al progetto LABA

### 2. Vai su SQL Editor
- Clicca su "SQL Editor" nel menu laterale
- Clicca su "New Query"

### 3. Esegui questo SQL:
```sql
-- Aggiungi colonne mancanti alla tabella users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS workplace TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
```

### 4. Aggiorna dati per Simone:
```sql
-- Aggiorna dati per Simone con dati completi
UPDATE users SET 
  phone = '+39 333 123 4567',
  position = 'Sviluppatore Full Stack',
  department = 'Reparto IT',
  hire_date = '2023-01-15',
  workplace = 'LABA Firenze - Sede Via Vecchietti',
  contract_type = 'Full Time - Indeterminato',
  birth_date = '1994-05-15'
WHERE email = 'simone.azzinelli@labafirenze.com';
```

### 5. Verifica:
```sql
-- Controlla che i dati siano stati aggiunti
SELECT id, email, first_name, last_name, phone, position, department, hire_date, workplace, contract_type, birth_date 
FROM users 
WHERE email = 'simone.azzinelli@labafirenze.com';
```

## 🎯 RISULTATO ATTESO:
Dopo aver eseguito questi SQL:
1. **La registrazione funzionerà** con tutti i campi
2. **Il profilo si popolerà** automaticamente con i dati reali
3. **Il salvataggio funzionerà** sia nel database che in localStorage

## 📝 NOTA:
Una volta aggiunti i campi, tutti i nuovi utenti registrati avranno i dati completi nel database e il profilo funzionerà perfettamente.
