-- Tabella per tracciare le assenze 104 (legge 104)
-- Ogni dipendente con has104=true ha diritto a 3 giorni interi al mese
-- Non cumulabili, si resetano ogni mese
-- Non influenzano la banca ore

CREATE TABLE IF NOT EXISTS absence_104_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  total_days INTEGER NOT NULL DEFAULT 3, -- Giorni totali disponibili al mese (sempre 3)
  used_days INTEGER NOT NULL DEFAULT 0, -- Giorni utilizzati nel mese
  remaining_days INTEGER NOT NULL DEFAULT 3, -- Giorni rimanenti nel mese
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_absence_104_user_year_month ON absence_104_balances(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_absence_104_user ON absence_104_balances(user_id);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_absence_104_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_absence_104_updated_at
  BEFORE UPDATE ON absence_104_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_absence_104_updated_at();

-- Commenti
COMMENT ON TABLE absence_104_balances IS 'Bilancio assenze legge 104: 3 giorni interi al mese per dipendenti con has104=true, non cumulabili, reset mensile';
COMMENT ON COLUMN absence_104_balances.total_days IS 'Sempre 3 giorni per mese';
COMMENT ON COLUMN absence_104_balances.used_days IS 'Giorni utilizzati nel mese corrente';
COMMENT ON COLUMN absence_104_balances.remaining_days IS 'Giorni rimanenti nel mese (3 - used_days)';

