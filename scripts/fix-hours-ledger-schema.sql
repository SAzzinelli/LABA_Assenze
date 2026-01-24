-- Script per aggiungere le colonne mancanti alla tabella hours_ledger
-- Esegui questo script nel database Supabase se la tabella esiste ma mancano le colonne

-- Verifica se la tabella esiste, altrimenti creala
CREATE TABLE IF NOT EXISTS hours_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  hours_amount DECIMAL(6,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  period_year INTEGER,
  period_month INTEGER,
  running_balance DECIMAL(6,2) NOT NULL,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggiungi colonne mancanti se la tabella esiste già
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS hours_amount DECIMAL(6,2);
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS transaction_date DATE;
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS period_year INTEGER;
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS period_month INTEGER;
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS running_balance DECIMAL(6,2);
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE hours_ledger ADD COLUMN IF NOT EXISTS notes TEXT;

-- Crea indici se non esistono
CREATE INDEX IF NOT EXISTS idx_hours_ledger_user_date ON hours_ledger(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_hours_ledger_user_category ON hours_ledger(user_id, category);
CREATE INDEX IF NOT EXISTS idx_hours_ledger_type ON hours_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_hours_ledger_reference ON hours_ledger(reference_type, reference_id);
