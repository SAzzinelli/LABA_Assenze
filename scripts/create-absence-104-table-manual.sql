-- ============================================
-- SCRIPT SQL PER CREARE TABELLA ABSENCE_104_BALANCES
-- ============================================
-- Eseguire questo script nel SQL Editor di Supabase
-- Tabella per tracciare le assenze 104 (legge 104)
-- Ogni dipendente con has104=true ha diritto a 3 giorni interi al mese
-- Non cumulabili, si resetano ogni mese
-- Non influenzano la banca ore
-- ============================================

-- 1. Crea la tabella principale
CREATE TABLE IF NOT EXISTS absence_104_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  total_days INTEGER NOT NULL DEFAULT 3,
  used_days INTEGER NOT NULL DEFAULT 0,
  pending_days INTEGER NOT NULL DEFAULT 0,
  remaining_days INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- 2. Crea gli indici per query veloci
CREATE INDEX IF NOT EXISTS idx_absence_104_user_year_month 
  ON absence_104_balances(user_id, year, month);

CREATE INDEX IF NOT EXISTS idx_absence_104_user 
  ON absence_104_balances(user_id);

-- 3. Crea la funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_absence_104_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crea il trigger per aggiornare updated_at automaticamente
DROP TRIGGER IF EXISTS trigger_absence_104_updated_at ON absence_104_balances;
CREATE TRIGGER trigger_absence_104_updated_at
  BEFORE UPDATE ON absence_104_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_absence_104_updated_at();

-- 5. Aggiungi commenti descrittivi
COMMENT ON TABLE absence_104_balances IS 
  'Bilancio assenze legge 104: 3 giorni interi al mese per dipendenti con has104=true, non cumulabili, reset mensile';

COMMENT ON COLUMN absence_104_balances.total_days IS 
  'Sempre 3 giorni per mese';

COMMENT ON COLUMN absence_104_balances.used_days IS 
  'Giorni utilizzati nel mese corrente';

COMMENT ON COLUMN absence_104_balances.pending_days IS 
  'Giorni in attesa di approvazione nel mese corrente';

COMMENT ON COLUMN absence_104_balances.remaining_days IS 
  'Giorni rimanenti nel mese (3 - used_days - pending_days)';

-- 6. Abilita Row Level Security (RLS)
ALTER TABLE absence_104_balances ENABLE ROW LEVEL SECURITY;

-- 7. Crea policy per permettere agli utenti di vedere solo i propri dati
CREATE POLICY "Users can view their own 104 balances"
  ON absence_104_balances
  FOR SELECT
  USING (auth.uid() = user_id);

-- 8. Crea policy per permettere agli admin di vedere tutti i dati
CREATE POLICY "Admins can view all 104 balances"
  ON absence_104_balances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 9. Crea policy per permettere al sistema di inserire/aggiornare (via service role)
-- Questa policy permette alle operazioni da service role (backend)
CREATE POLICY "Service role can manage all 104 balances"
  ON absence_104_balances
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- FINE SCRIPT
-- ============================================
-- Dopo l'esecuzione, verifica che la tabella sia stata creata:
-- SELECT * FROM absence_104_balances LIMIT 1;
-- ============================================


