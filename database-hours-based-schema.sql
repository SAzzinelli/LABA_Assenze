-- =====================================================
-- DATABASE SISTEMA HR BASATO SU ORE - PRESENZE LABA
-- Implementa le linee guida per gestione contratti, ferie, permessi, monte ore e trasferte
-- =====================================================

-- =====================================================
-- 1. TABELLA CONTRATTI E PATTERN DI LAVORO
-- =====================================================

-- Tabella per definire i tipi di contratto
CREATE TABLE IF NOT EXISTS contract_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL, -- 'full_time', 'part_time_horizontal', 'part_time_vertical', 'apprenticeship', 'cococo', 'internship'
  description TEXT,
  annual_vacation_days DECIMAL(5,2) DEFAULT 26, -- giorni ferie annue
  annual_permission_days DECIMAL(5,2) DEFAULT 0, -- giorni permessi ROL annui
  max_carryover_days DECIMAL(5,2) DEFAULT 13, -- max giorni riportabili anno successivo
  accrual_frequency VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'weekly', 'daily'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per pattern di lavoro personalizzati per utente
CREATE TABLE IF NOT EXISTS work_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_type_id UUID NOT NULL REFERENCES contract_types(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Pattern settimanale
  monday_hours DECIMAL(4,2) DEFAULT 8.0,
  tuesday_hours DECIMAL(4,2) DEFAULT 8.0,
  wednesday_hours DECIMAL(4,2) DEFAULT 8.0,
  thursday_hours DECIMAL(4,2) DEFAULT 8.0,
  friday_hours DECIMAL(4,2) DEFAULT 8.0,
  saturday_hours DECIMAL(4,2) DEFAULT 0.0,
  sunday_hours DECIMAL(4,2) DEFAULT 0.0,
  
  -- Calcoli derivati
  weekly_hours DECIMAL(5,2) GENERATED ALWAYS AS (
    monday_hours + tuesday_hours + wednesday_hours + 
    thursday_hours + friday_hours + saturday_hours + sunday_hours
  ) STORED,
  
  monthly_hours DECIMAL(6,2) GENERATED ALWAYS AS (
    (monday_hours + tuesday_hours + wednesday_hours + 
     thursday_hours + friday_hours + saturday_hours + sunday_hours) * 4.33
  ) STORED,
  
  -- Configurazioni speciali
  has_training_hours BOOLEAN DEFAULT FALSE, -- per apprendistato
  training_hours_per_month DECIMAL(4,2) DEFAULT 0,
  is_remote_work BOOLEAN DEFAULT FALSE,
  base_location VARCHAR(255),
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, effective_from)
);

-- =====================================================
-- 2. LEDGER A MOVIMENTI PER FERIE, PERMESSI E MONTE ORE
-- =====================================================

-- Tabella principale per tutti i movimenti di ore
CREATE TABLE IF NOT EXISTS hours_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'accrual', 'usage', 'expiry', 'adjustment', 'transfer', 'business_trip'
  category VARCHAR(50) NOT NULL, -- 'vacation', 'permission', 'overtime_bank', 'training', 'business_trip'
  
  -- Movimento
  hours_amount DECIMAL(6,2) NOT NULL, -- positivo per maturazione, negativo per utilizzo
  description TEXT NOT NULL,
  
  -- Riferimenti
  reference_id UUID, -- ID della richiesta, trasferta, etc.
  reference_type VARCHAR(50), -- 'leave_request', 'business_trip', 'overtime', 'adjustment'
  
  -- Periodo di riferimento
  period_year INTEGER,
  period_month INTEGER,
  
  -- Saldo dopo il movimento
  running_balance DECIMAL(6,2) NOT NULL,
  
  -- Metadati
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. SALDI CORRENTI PER CATEGORIA
-- =====================================================

-- Tabella per i saldi attuali (vista aggregata del ledger)
CREATE TABLE IF NOT EXISTS current_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'vacation', 'permission', 'overtime_bank', 'training'
  year INTEGER NOT NULL,
  
  -- Saldi
  total_accrued DECIMAL(6,2) DEFAULT 0,
  total_used DECIMAL(6,2) DEFAULT 0,
  total_expired DECIMAL(6,2) DEFAULT 0,
  current_balance DECIMAL(6,2) DEFAULT 0,
  
  -- Limiti
  max_balance DECIMAL(6,2),
  expiry_date DATE,
  
  -- Ultimo aggiornamento
  last_transaction_date DATE,
  last_transaction_id UUID REFERENCES hours_ledger(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, category, year)
);

-- =====================================================
-- 4. TRASFERTE E VIAGGI PER EVENTI
-- =====================================================

-- Tabella per trasferte e viaggi
CREATE TABLE IF NOT EXISTS business_trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_name VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  purpose TEXT,
  
  -- Date e orari
  departure_date DATE NOT NULL,
  departure_time TIME,
  return_date DATE NOT NULL,
  return_time TIME,
  
  -- Calcoli ore
  travel_hours DECIMAL(4,2) DEFAULT 0, -- ore viaggio conteggiate
  event_hours DECIMAL(4,2) DEFAULT 0, -- ore evento/lavoro effettivo
  waiting_hours DECIMAL(4,2) DEFAULT 0, -- ore attese/logistica
  total_hours DECIMAL(4,2) GENERATED ALWAYS AS (
    travel_hours + event_hours + waiting_hours
  ) STORED,
  
  -- Policy applicate
  travel_policy VARCHAR(50) DEFAULT 'full_travel', -- 'full_travel', 'excess_travel', 'none'
  overtime_policy VARCHAR(50) DEFAULT 'overtime_bank', -- 'overtime_bank', 'paid', 'compensatory'
  
  -- Ore aggiuntive generate
  overtime_generated DECIMAL(4,2) DEFAULT 0,
  
  -- Stato
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Spese (separate dal tempo)
  expenses_total DECIMAL(8,2) DEFAULT 0,
  expenses_approved DECIMAL(8,2) DEFAULT 0,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. AGGIORNAMENTI ALLE TABELLE ESISTENTI
-- =====================================================

-- Aggiorna users per supportare i nuovi campi contrattuali
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_contract_type_id UUID REFERENCES contract_types(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Aggiorna leave_requests per supportare il sistema a ore
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS hours_requested DECIMAL(4,2) DEFAULT 0;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS hours_approved DECIMAL(4,2) DEFAULT 0;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS work_pattern_snapshot JSONB; -- snapshot del pattern al momento della richiesta

-- =====================================================
-- 6. INDICI PER PERFORMANCE
-- =====================================================

-- Indici per hours_ledger
CREATE INDEX IF NOT EXISTS idx_hours_ledger_user_date ON hours_ledger(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_hours_ledger_user_category ON hours_ledger(user_id, category);
CREATE INDEX IF NOT EXISTS idx_hours_ledger_type ON hours_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_hours_ledger_reference ON hours_ledger(reference_type, reference_id);

-- Indici per work_patterns
CREATE INDEX IF NOT EXISTS idx_work_patterns_user ON work_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_work_patterns_effective ON work_patterns(effective_from, effective_to);

-- Indici per current_balances
CREATE INDEX IF NOT EXISTS idx_current_balances_user_year ON current_balances(user_id, year);
CREATE INDEX IF NOT EXISTS idx_current_balances_category ON current_balances(category);

-- Indici per business_trips
CREATE INDEX IF NOT EXISTS idx_business_trips_user ON business_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_business_trips_dates ON business_trips(departure_date, return_date);
CREATE INDEX IF NOT EXISTS idx_business_trips_status ON business_trips(status);

-- =====================================================
-- 7. FUNZIONI DI CALCOLO BASATE SU ORE
-- =====================================================

-- Funzione per ottenere il pattern di lavoro attivo per un utente in una data
CREATE OR REPLACE FUNCTION get_active_work_pattern(p_user_id UUID, p_date DATE)
RETURNS TABLE (
  pattern_id UUID,
  contract_type_id UUID,
  weekly_hours DECIMAL(5,2),
  monthly_hours DECIMAL(6,2),
  daily_hours JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wp.id,
    wp.contract_type_id,
    wp.weekly_hours,
    wp.monthly_hours,
    jsonb_build_object(
      'monday', wp.monday_hours,
      'tuesday', wp.tuesday_hours,
      'wednesday', wp.wednesday_hours,
      'thursday', wp.thursday_hours,
      'friday', wp.friday_hours,
      'saturday', wp.saturday_hours,
      'sunday', wp.sunday_hours
    ) as daily_hours
  FROM work_patterns wp
  WHERE wp.user_id = p_user_id
    AND wp.effective_from <= p_date
    AND (wp.effective_to IS NULL OR wp.effective_to >= p_date)
  ORDER BY wp.effective_from DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Funzione per calcolare ore ferie per un giorno specifico
CREATE OR REPLACE FUNCTION calculate_vacation_hours_for_day(
  p_user_id UUID, 
  p_date DATE
)
RETURNS DECIMAL(4,2) AS $$
DECLARE
  day_of_week INTEGER;
  daily_hours DECIMAL(4,2);
BEGIN
  -- Ottieni il giorno della settimana (0=domenica, 1=lunedì, etc.)
  day_of_week := EXTRACT(DOW FROM p_date);
  
  -- Ottieni le ore per quel giorno dal pattern attivo
  SELECT CASE day_of_week
    WHEN 1 THEN monday_hours
    WHEN 2 THEN tuesday_hours
    WHEN 3 THEN wednesday_hours
    WHEN 4 THEN thursday_hours
    WHEN 5 THEN friday_hours
    WHEN 6 THEN saturday_hours
    WHEN 0 THEN sunday_hours
    ELSE 0
  END INTO daily_hours
  FROM work_patterns wp
  WHERE wp.user_id = p_user_id
    AND wp.effective_from <= p_date
    AND (wp.effective_to IS NULL OR wp.effective_to >= p_date)
  ORDER BY wp.effective_from DESC
  LIMIT 1;
  
  RETURN COALESCE(daily_hours, 0);
END;
$$ LANGUAGE plpgsql;

-- Funzione per maturazione mensile ferie/permessi
CREATE OR REPLACE FUNCTION accrue_monthly_hours(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER,
  p_category VARCHAR(50)
)
RETURNS VOID AS $$
DECLARE
  pattern_record RECORD;
  accrual_hours DECIMAL(6,2);
  current_balance DECIMAL(6,2);
BEGIN
  -- Ottieni il pattern attivo per il primo giorno del mese
  SELECT * INTO pattern_record
  FROM get_active_work_pattern(p_user_id, DATE(p_year || '-' || p_month || '-01'));
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nessun pattern di lavoro trovato per l''utente %', p_user_id;
  END IF;
  
  -- Calcola le ore di maturazione mensile
  CASE p_category
    WHEN 'vacation' THEN
      -- Ferie: proporzionali alle ore mensili del pattern
      accrual_hours := (pattern_record.monthly_hours / 12.0) * (208.0 / 173.33); -- 208 ore annue / 173.33 ore mensili FT
    WHEN 'permission' THEN
      -- Permessi ROL: proporzionali alle ore mensili
      accrual_hours := (pattern_record.monthly_hours / 12.0) * (104.0 / 173.33); -- 104 ore annue / 173.33 ore mensili FT
    ELSE
      accrual_hours := 0;
  END CASE;
  
  -- Ottieni il saldo corrente
  SELECT COALESCE(current_balance, 0) INTO current_balance
  FROM current_balances
  WHERE user_id = p_user_id AND category = p_category AND year = p_year;
  
  -- Inserisci movimento nel ledger
  INSERT INTO hours_ledger (
    user_id, transaction_date, transaction_type, category,
    hours_amount, description, period_year, period_month,
    running_balance
  ) VALUES (
    p_user_id, 
    DATE(p_year || '-' || p_month || '-01'),
    'accrual',
    p_category,
    accrual_hours,
    'Maturazione mensile ' || p_category || ' - ' || p_month || '/' || p_year,
    p_year,
    p_month,
    current_balance + accrual_hours
  );
  
  -- Aggiorna saldo corrente
  INSERT INTO current_balances (user_id, category, year, total_accrued, current_balance, last_transaction_date)
  VALUES (p_user_id, p_category, p_year, accrual_hours, current_balance + accrual_hours, DATE(p_year || '-' || p_month || '-01'))
  ON CONFLICT (user_id, category, year)
  DO UPDATE SET
    total_accrued = current_balances.total_accrued + accrual_hours,
    current_balance = current_balances.current_balance + accrual_hours,
    last_transaction_date = DATE(p_year || '-' || p_month || '-01'),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Funzione per utilizzare ore (ferie/permessi)
CREATE OR REPLACE FUNCTION use_hours(
  p_user_id UUID,
  p_date DATE,
  p_hours DECIMAL(4,2),
  p_category VARCHAR(50),
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance DECIMAL(6,2);
  new_balance DECIMAL(6,2);
BEGIN
  -- Verifica saldo disponibile
  SELECT COALESCE(current_balance, 0) INTO current_balance
  FROM current_balances
  WHERE user_id = p_user_id AND category = p_category AND year = EXTRACT(YEAR FROM p_date);
  
  IF current_balance < p_hours THEN
    RETURN FALSE; -- Saldo insufficiente
  END IF;
  
  new_balance := current_balance - p_hours;
  
  -- Inserisci movimento nel ledger
  INSERT INTO hours_ledger (
    user_id, transaction_date, transaction_type, category,
    hours_amount, description, reference_id, reference_type,
    running_balance
  ) VALUES (
    p_user_id, p_date, 'usage', p_category,
    -p_hours, p_description, p_reference_id, p_reference_type,
    new_balance
  );
  
  -- Aggiorna saldo corrente
  UPDATE current_balances
  SET 
    total_used = total_used + p_hours,
    current_balance = new_balance,
    last_transaction_date = p_date,
    updated_at = NOW()
  WHERE user_id = p_user_id AND category = p_category AND year = EXTRACT(YEAR FROM p_date);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Funzione per aggiungere ore al monte ore (straordinari)
CREATE OR REPLACE FUNCTION add_overtime_hours(
  p_user_id UUID,
  p_date DATE,
  p_hours DECIMAL(4,2),
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  current_balance DECIMAL(6,2);
BEGIN
  -- Ottieni saldo corrente monte ore
  SELECT COALESCE(current_balance, 0) INTO current_balance
  FROM current_balances
  WHERE user_id = p_user_id AND category = 'overtime_bank' AND year = EXTRACT(YEAR FROM p_date);
  
  -- Inserisci movimento nel ledger
  INSERT INTO hours_ledger (
    user_id, transaction_date, transaction_type, category,
    hours_amount, description, reference_id, reference_type,
    running_balance
  ) VALUES (
    p_user_id, p_date, 'accrual', 'overtime_bank',
    p_hours, p_description, p_reference_id, 'overtime',
    current_balance + p_hours
  );
  
  -- Aggiorna saldo corrente
  INSERT INTO current_balances (user_id, category, year, total_accrued, current_balance, last_transaction_date)
  VALUES (p_user_id, 'overtime_bank', EXTRACT(YEAR FROM p_date), p_hours, current_balance + p_hours, p_date)
  ON CONFLICT (user_id, category, year)
  DO UPDATE SET
    total_accrued = current_balances.total_accrued + p_hours,
    current_balance = current_balances.current_balance + p_hours,
    last_transaction_date = p_date,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. TRIGGER PER AGGIORNAMENTO AUTOMATICO
-- =====================================================

-- Trigger per aggiornare updated_at
CREATE TRIGGER update_contract_types_updated_at BEFORE UPDATE ON contract_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_patterns_updated_at BEFORE UPDATE ON work_patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_current_balances_updated_at BEFORE UPDATE ON current_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_business_trips_updated_at BEFORE UPDATE ON business_trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. DATI INIZIALI PER TIPI DI CONTRATTO
-- =====================================================

INSERT INTO contract_types (name, description, annual_vacation_hours, annual_permission_hours, max_carryover_hours) VALUES
('full_time', 'Tempo pieno indeterminato', 208, 104, 104),
('part_time_horizontal', 'Part-time orizzontale', 104, 52, 52),
('part_time_vertical', 'Part-time verticale', 104, 52, 52),
('apprenticeship', 'Apprendistato', 208, 104, 104),
('cococo', 'Collaborazione coordinata e continuativa', 0, 0, 0),
('internship', 'Tirocinio', 0, 0, 0)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 10. ROW LEVEL SECURITY
-- =====================================================

-- Abilita RLS
ALTER TABLE contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE hours_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_trips ENABLE ROW LEVEL SECURITY;

-- Policy per contract_types (tutti possono leggere, solo admin può modificare)
CREATE POLICY "Everyone can view contract types" ON contract_types FOR SELECT USING (true);
CREATE POLICY "Admin can manage contract types" ON contract_types FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per work_patterns (user vede solo i suoi, admin vede tutto)
CREATE POLICY "Users can manage own work patterns" ON work_patterns FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all work patterns" ON work_patterns FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per hours_ledger (user vede solo i suoi, admin vede tutto)
CREATE POLICY "Users can view own hours ledger" ON hours_ledger FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all hours ledger" ON hours_ledger FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per current_balances (user vede solo i suoi, admin vede tutto)
CREATE POLICY "Users can view own balances" ON current_balances FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all balances" ON current_balances FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per business_trips (user vede solo le sue, admin vede tutto)
CREATE POLICY "Users can manage own business trips" ON business_trips FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all business trips" ON business_trips FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);
