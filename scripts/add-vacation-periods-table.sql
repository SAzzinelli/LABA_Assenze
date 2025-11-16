-- Tabella per i periodi di richiesta ferie
-- L'admin apre e chiude periodi in cui è possibile richiedere ferie
CREATE TABLE IF NOT EXISTS vacation_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL, -- Nome del periodo (es: "Periodo estivo 2025", "Ferie natalizie")
  start_date DATE NOT NULL, -- Data inizio periodo di richiesta
  end_date DATE NOT NULL, -- Data fine periodo di richiesta
  vacation_start_date DATE NOT NULL, -- Data inizio periodo in cui si possono prendere le ferie
  vacation_end_date DATE NOT NULL, -- Data fine periodo in cui si possono prendere le ferie
  is_open BOOLEAN DEFAULT TRUE, -- Se FALSE, i dipendenti non possono richiedere ferie in questo periodo
  max_concurrent_requests INTEGER DEFAULT NULL, -- Numero massimo di richieste contemporanee (opzionale)
  created_by UUID REFERENCES users(id), -- Admin che ha creato il periodo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  CHECK (start_date <= end_date),
  CHECK (vacation_start_date <= vacation_end_date)
);

-- Indice per ricerca rapida dei periodi aperti
CREATE INDEX IF NOT EXISTS idx_vacation_periods_open ON vacation_periods(is_open, start_date, end_date) WHERE is_open = TRUE;

-- Indice per ricerca periodi per data
CREATE INDEX IF NOT EXISTS idx_vacation_periods_dates ON vacation_periods(vacation_start_date, vacation_end_date);

-- Tabella per tracciare le ferie utilizzate (giorni interi)
-- Separata completamente dalla banca ore
CREATE TABLE IF NOT EXISTS vacation_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days INTEGER DEFAULT 30, -- 30 giorni di ferie per tutti
  used_days INTEGER DEFAULT 0, -- Giorni di ferie utilizzati
  pending_days INTEGER DEFAULT 0, -- Giorni in attesa di approvazione
  remaining_days INTEGER DEFAULT 30, -- Giorni rimanenti (calcolato: total_days - used_days - pending_days)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year)
);

-- Indice per ricerca bilanci ferie
CREATE INDEX IF NOT EXISTS idx_vacation_balances_user_year ON vacation_balances(user_id, year);

-- RLS (Row Level Security) - se necessario
ALTER TABLE vacation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_balances ENABLE ROW LEVEL SECURITY;

-- Policy per vacation_periods: tutti possono leggere, solo admin possono modificare
CREATE POLICY "Anyone can view vacation periods" ON vacation_periods FOR SELECT USING (true);
CREATE POLICY "Only admins can manage vacation periods" ON vacation_periods FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Policy per vacation_balances: utenti possono vedere solo i propri bilanci
CREATE POLICY "Users can view own vacation balance" ON vacation_balances FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all vacation balances" ON vacation_balances FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
);

