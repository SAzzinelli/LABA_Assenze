-- =====================================================
-- DATABASE SISTEMA HR PRESENZE LABA - SENZA TIMBRATURA
-- =====================================================
-- Sistema basato su presenza automatica + assenze giustificate

-- 1. TABELLA USERS (già esiste, aggiungiamo campi per orari)
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_number VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS workplace VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary DECIMAL(10,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(8,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_hours INTEGER DEFAULT 40;
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. TABELLA WORK_SCHEDULES (orari di lavoro personalizzati)
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=domenica, 1=lunedì, etc.
  is_working_day BOOLEAN DEFAULT TRUE,
  work_type VARCHAR(20) DEFAULT 'full_day', -- 'morning', 'afternoon', 'full_day'
  start_time TIME,
  end_time TIME,
  break_duration INTEGER DEFAULT 60, -- minuti
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);

-- 3. TABELLA ATTENDANCE (modificata per nuovo sistema monte ore)
-- Rimuoviamo clock_in e clock_out, aggiungiamo campi per sistema monte ore
ALTER TABLE attendance DROP COLUMN IF EXISTS clock_in;
ALTER TABLE attendance DROP COLUMN IF EXISTS clock_out;
ALTER TABLE attendance DROP COLUMN IF EXISTS break_start;
ALTER TABLE attendance DROP COLUMN IF EXISTS break_end;

-- Aggiungiamo nuovi campi per sistema monte ore
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS expected_hours DECIMAL(4,2) DEFAULT 8.0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(4,2) DEFAULT 8.0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS balance_hours DECIMAL(4,2) DEFAULT 0.0; -- Ore in più/meno rispetto all'orario standard
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_absent BOOLEAN DEFAULT FALSE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS absence_reason VARCHAR(100); -- 'sick', 'vacation', 'permission', 'holiday'
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES leave_requests(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT FALSE; -- Se le ore sono concordate come straordinario
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_early_departure BOOLEAN DEFAULT FALSE; -- Se esce prima dell'orario
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_late_arrival BOOLEAN DEFAULT FALSE; -- Se arriva dopo l'orario

-- 4. TABELLA LEAVE_REQUESTS (già esiste, aggiungiamo campi)
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS destination VARCHAR(255);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS medical_certificate BOOLEAN DEFAULT FALSE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS hours_requested INTEGER DEFAULT 0;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT TRUE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS attachments TEXT[];

-- 5. TABELLA HOURS_BALANCE (monte ore cumulativo)
CREATE TABLE IF NOT EXISTS hours_balance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  total_balance DECIMAL(6,2) DEFAULT 0.0, -- Saldo totale ore (può essere positivo o negativo)
  overtime_hours DECIMAL(5,2) DEFAULT 0.0, -- Ore straordinario concordate
  deficit_hours DECIMAL(5,2) DEFAULT 0.0, -- Ore di deficit (ritardi/anticipi)
  working_days INTEGER DEFAULT 0, -- Giorni lavorativi nel mese
  absent_days INTEGER DEFAULT 0, -- Giorni di assenza
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

-- 6. TABELLA LEAVE_BALANCES (saldo ferie/permessi)
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  leave_type VARCHAR(50) NOT NULL, -- 'vacation', 'sick', 'permission', 'maternity', 'paternity'
  total_entitled DECIMAL(5,2) DEFAULT 0, -- giorni/ore totali spettanti
  used DECIMAL(5,2) DEFAULT 0, -- giorni/ore utilizzati
  pending DECIMAL(5,2) DEFAULT 0, -- giorni/ore in attesa approvazione
  remaining DECIMAL(5,2) DEFAULT 0, -- giorni/ore rimanenti
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, leave_type)
);

-- 6. TABELLA DEPARTMENTS (dipartimenti)
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES users(id),
  budget DECIMAL(12,2),
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABELLA NOTIFICATIONS (notifiche)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'success', 'approval'
  category VARCHAR(50) DEFAULT 'general', -- 'attendance', 'leave', 'payroll', 'general'
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR(500),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABELLA HOLIDAYS (giorni festivi)
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_national BOOLEAN DEFAULT TRUE,
  applies_to_departments UUID[] DEFAULT '{}', -- array di department IDs
  is_paid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDICI PER PERFORMANCE
-- =====================================================

-- Indici per attendance
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_attendance_is_absent ON attendance(is_absent);

-- Indici per leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by ON leave_requests(approved_by);

-- Indici per work_schedules
CREATE INDEX IF NOT EXISTS idx_work_schedules_user ON work_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_day ON work_schedules(day_of_week);

-- Indici per hours_balance
CREATE INDEX IF NOT EXISTS idx_hours_balance_user_year_month ON hours_balance(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_hours_balance_year_month ON hours_balance(year, month);

-- Indici per leave_balances
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON leave_balances(user_id, year);

-- Indici per notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- =====================================================
-- TRIGGER PER AGGIORNAMENTO updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Applica trigger a tutte le tabelle con updated_at
CREATE TRIGGER update_work_schedules_updated_at BEFORE UPDATE ON work_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNZIONI UTILITY
-- =====================================================

-- Funzione per calcolare ore lavorate basate su orario di lavoro
CREATE OR REPLACE FUNCTION calculate_expected_hours(
  p_user_id UUID,
  p_date DATE
)
RETURNS DECIMAL(4,2) AS $$
DECLARE
  day_of_week INTEGER;
  work_schedule RECORD;
  is_holiday_day BOOLEAN;
BEGIN
  -- Ottieni giorno della settimana (0=domenica, 1=lunedì, etc.)
  day_of_week := EXTRACT(DOW FROM p_date);
  
  -- Verifica se è un giorno festivo
  SELECT EXISTS (
    SELECT 1 FROM holidays 
    WHERE date = p_date 
    AND (is_national = true OR applies_to_departments = '{}'::UUID[])
  ) INTO is_holiday_day;
  
  -- Se è festivo, restituisci 0 ore
  IF is_holiday_day THEN
    RETURN 0;
  END IF;
  
  -- Cerca orario di lavoro per questo giorno della settimana
  SELECT * INTO work_schedule
  FROM work_schedules 
  WHERE user_id = p_user_id 
  AND day_of_week = EXTRACT(DOW FROM p_date);
  
  -- Se non c'è orario specifico, usa orario standard (8 ore)
  IF NOT FOUND OR NOT work_schedule.is_working_day THEN
    RETURN 0;
  END IF;
  
  -- Calcola ore lavorate sottraendo la pausa pranzo
  RETURN GREATEST(0, 
    EXTRACT(EPOCH FROM (work_schedule.end_time - work_schedule.start_time)) / 3600 - 
    (work_schedule.break_duration / 60.0)
  );
END;
$$ LANGUAGE plpgsql;

-- Funzione per calcolare il saldo ore giornaliero
CREATE OR REPLACE FUNCTION calculate_daily_balance(
  p_user_id UUID,
  p_date DATE,
  p_actual_hours DECIMAL(4,2)
)
RETURNS DECIMAL(4,2) AS $$
DECLARE
  expected_hours DECIMAL(4,2);
BEGIN
  -- Calcola ore attese per questo giorno
  expected_hours := calculate_expected_hours(p_user_id, p_date);
  
  -- Se non è un giorno lavorativo, il saldo è 0
  IF expected_hours = 0 THEN
    RETURN 0;
  END IF;
  
  -- Calcola la differenza (ore effettive - ore attese)
  -- Positivo = straordinario, Negativo = deficit
  RETURN p_actual_hours - expected_hours;
END;
$$ LANGUAGE plpgsql;

-- Funzione per aggiornare il monte ore mensile
CREATE OR REPLACE FUNCTION update_monthly_hours_balance(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS VOID AS $$
DECLARE
  total_balance DECIMAL(6,2) := 0;
  overtime_hours DECIMAL(5,2) := 0;
  deficit_hours DECIMAL(5,2) := 0;
  working_days INTEGER := 0;
  absent_days INTEGER := 0;
BEGIN
  -- Calcola statistiche dal mese
  SELECT 
    COALESCE(SUM(balance_hours), 0),
    COALESCE(SUM(CASE WHEN balance_hours > 0 THEN balance_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN balance_hours < 0 THEN ABS(balance_hours) ELSE 0 END), 0),
    COUNT(CASE WHEN NOT is_absent AND expected_hours > 0 THEN 1 END),
    COUNT(CASE WHEN is_absent THEN 1 END)
  INTO total_balance, overtime_hours, deficit_hours, working_days, absent_days
  FROM attendance 
  WHERE user_id = p_user_id 
  AND EXTRACT(YEAR FROM date) = p_year 
  AND EXTRACT(MONTH FROM date) = p_month;
  
  -- Inserisci o aggiorna il record mensile
  INSERT INTO hours_balance (
    user_id, year, month, total_balance, 
    overtime_hours, deficit_hours, working_days, absent_days
  )
  VALUES (
    p_user_id, p_year, p_month, total_balance,
    overtime_hours, deficit_hours, working_days, absent_days
  )
  ON CONFLICT (user_id, year, month)
  DO UPDATE SET
    total_balance = EXCLUDED.total_balance,
    overtime_hours = EXCLUDED.overtime_hours,
    deficit_hours = EXCLUDED.deficit_hours,
    working_days = EXCLUDED.working_days,
    absent_days = EXCLUDED.absent_days,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Funzione per verificare se un giorno è festivo
CREATE OR REPLACE FUNCTION is_holiday(check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM holidays 
    WHERE date = check_date 
    AND (is_national = true OR applies_to_departments = '{}'::UUID[])
  );
END;
$$ LANGUAGE plpgsql;

-- Funzione per aggiornare saldi ferie
CREATE OR REPLACE FUNCTION update_leave_balance(
  p_user_id UUID,
  p_year INTEGER,
  p_leave_type VARCHAR(50),
  p_days_used DECIMAL(5,2)
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO leave_balances (user_id, year, leave_type, used, remaining)
  VALUES (p_user_id, p_year, p_leave_type, p_days_used, total_entitled - p_days_used)
  ON CONFLICT (user_id, year, leave_type)
  DO UPDATE SET
    used = leave_balances.used + p_days_used,
    remaining = GREATEST(0, leave_balances.remaining - p_days_used),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Funzione per generare presenze automatiche per un periodo
CREATE OR REPLACE FUNCTION generate_automatic_attendance(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS VOID AS $$
DECLARE
  current_date DATE;
  expected_hours DECIMAL(4,2);
  is_holiday_day BOOLEAN;
BEGIN
  current_date := p_start_date;
  
  WHILE current_date <= p_end_date LOOP
    -- Verifica se è un giorno festivo
    SELECT is_holiday(current_date) INTO is_holiday_day;
    
    -- Calcola ore attese per questo giorno
    expected_hours := calculate_expected_hours(p_user_id, current_date);
    
    -- Inserisci o aggiorna record di presenza
    INSERT INTO attendance (
      user_id, 
      date, 
      expected_hours, 
      actual_hours, 
      balance_hours, -- Di default 0 (presenza normale)
      is_absent, 
      status
    )
    VALUES (
      p_user_id, 
      current_date, 
      expected_hours, 
      expected_hours, -- Di default, le ore effettive = ore attese
      0.0, -- Saldo ore = 0 (presenza normale)
      FALSE, -- Non assente di default
      CASE 
        WHEN is_holiday_day THEN 'holiday'
        WHEN expected_hours = 0 THEN 'non_working_day'
        ELSE 'present'
      END
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      expected_hours = EXCLUDED.expected_hours,
      actual_hours = CASE 
        WHEN attendance.is_absent THEN attendance.actual_hours -- Mantieni ore effettive se assente
        ELSE EXCLUDED.actual_hours -- Altrimenti aggiorna con ore attese
      END,
      balance_hours = CASE 
        WHEN attendance.is_absent THEN attendance.balance_hours -- Mantieni saldo se assente
        ELSE 0.0 -- Altrimenti reset a 0 (presenza normale)
      END,
      status = EXCLUDED.status;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DATI INIZIALI
-- =====================================================

-- Inserisci dipartimenti di base
INSERT INTO departments (name, description) VALUES
('Amministrazione', 'Gestione amministrativa e contabile'),
('Segreteria', 'Servizi di segreteria e supporto'),
('Orientamento', 'Servizi di orientamento e consulenza'),
('Reparto IT', 'Sviluppo software e supporto tecnico'),
('System Owner', 'Gestione sistema HR')
ON CONFLICT (name) DO NOTHING;

-- Inserisci giorni festivi italiani 2025
INSERT INTO holidays (name, date, is_recurring, is_national, is_paid) VALUES
('Capodanno', '2025-01-01', false, true, true),
('Epifania', '2025-01-06', false, true, true),
('Pasqua', '2025-04-20', false, true, true),
('Lunedì dell''Angelo', '2025-04-21', false, true, true),
('Festa della Liberazione', '2025-04-25', false, true, true),
('Festa del Lavoro', '2025-05-01', false, true, true),
('Festa della Repubblica', '2025-06-02', false, true, true),
('Ferragosto', '2025-08-15', false, true, true),
('Tutti i Santi', '2025-11-01', false, true, true),
('Immacolata Concezione', '2025-12-08', false, true, true),
('Natale', '2025-12-25', false, true, true),
('Santo Stefano', '2025-12-26', false, true, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hours_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- Policy per work_schedules (user vede solo le sue, admin vede tutto)
CREATE POLICY "Users can manage own work schedules" ON work_schedules FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all work schedules" ON work_schedules FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per hours_balance (user vede solo il suo, admin vede tutto)
CREATE POLICY "Users can view own hours balance" ON hours_balance FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all hours balance" ON hours_balance FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per leave_balances (user vede solo le sue, admin vede tutto)
CREATE POLICY "Users can view own leave balances" ON leave_balances FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all leave balances" ON leave_balances FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per departments (tutti possono leggere, solo admin può modificare)
CREATE POLICY "Everyone can view departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Admin can manage departments" ON departments FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per notifications (user vede solo le sue)
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all notifications" ON notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per holidays (tutti possono leggere, solo admin può modificare)
CREATE POLICY "Everyone can view holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "Admin can manage holidays" ON holidays FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);
