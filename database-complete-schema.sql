-- =====================================================
-- DATABASE COMPLETO SISTEMA HR PRESENZE LABA
-- =====================================================

-- 1. TABELLA USERS (già esiste, ma aggiungiamo campi)
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

-- 2. TABELLA SETTINGS (impostazioni per utente)
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'company', 'notifications', 'privacy', 'security', 'system'
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- 3. TABELLA WORK_SCHEDULES (orari di lavoro personalizzati)
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

-- 4. TABELLA ATTENDANCE (già esiste, ma aggiungiamo campi)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS break_start TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS break_end TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(4,2) DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. TABELLA LEAVE_REQUESTS (già esiste, ma aggiungiamo campi)
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

-- 7. TABELLA SHIFTS (turni e orari speciali)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INTEGER DEFAULT 60, -- minuti
  is_overtime BOOLEAN DEFAULT FALSE,
  is_holiday BOOLEAN DEFAULT FALSE,
  is_weekend BOOLEAN DEFAULT FALSE,
  shift_type VARCHAR(50) DEFAULT 'regular', -- 'regular', 'overtime', 'holiday', 'emergency'
  location VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 8. TABELLA DEPARTMENTS (dipartimenti)
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

-- 9. TABELLA NOTIFICATIONS (notifiche)
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

-- 10. TABELLA DOCUMENTS (documenti)
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_size INTEGER,
  category VARCHAR(50), -- 'contract', 'payroll', 'certificate', 'medical', 'other'
  uploaded_by UUID REFERENCES users(id),
  is_public BOOLEAN DEFAULT FALSE,
  expires_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. TABELLA PAYROLL (stipendi)
CREATE TABLE IF NOT EXISTS payroll (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  base_salary DECIMAL(10,2) NOT NULL,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  overtime_pay DECIMAL(10,2) DEFAULT 0,
  bonus DECIMAL(10,2) DEFAULT 0,
  deductions DECIMAL(10,2) DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'paid'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

-- 12. TABELLA HOLIDAYS (giorni festivi)
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

-- 13. TABELLA AUDIT_LOGS (log delle azioni)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDICI PER PERFORMANCE
-- =====================================================

-- Indici per attendance
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in ON attendance(clock_in) WHERE clock_in IS NOT NULL;

-- Indici per leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by ON leave_requests(approved_by);

-- Indici per work_schedules
CREATE INDEX IF NOT EXISTS idx_work_schedules_user ON work_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_day ON work_schedules(day_of_week);

-- Indici per leave_balances
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON leave_balances(user_id, year);

-- Indici per shifts
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);

-- Indici per notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Indici per documents
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

-- Indici per payroll
CREATE INDEX IF NOT EXISTS idx_payroll_user_month_year ON payroll(user_id, month, year);

-- Indici per audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

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
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_schedules_updated_at BEFORE UPDATE ON work_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy per settings (user vede solo le sue, admin vede tutto)
CREATE POLICY "Users can manage own settings" ON settings FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all settings" ON settings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per work_schedules (user vede solo le sue, admin vede tutto)
CREATE POLICY "Users can manage own work schedules" ON work_schedules FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all work schedules" ON work_schedules FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per leave_balances (user vede solo le sue, admin vede tutto)
CREATE POLICY "Users can view own leave balances" ON leave_balances FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all leave balances" ON leave_balances FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per shifts (user vede solo i suoi, admin vede tutto)
CREATE POLICY "Users can manage own shifts" ON shifts FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all shifts" ON shifts FOR ALL USING (
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

-- Policy per documents (user vede solo i suoi, admin vede tutto)
CREATE POLICY "Users can manage own documents" ON documents FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all documents" ON documents FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per payroll (user vede solo il suo, admin vede tutto)
CREATE POLICY "Users can view own payroll" ON payroll FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all payroll" ON payroll FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per holidays (tutti possono leggere, solo admin può modificare)
CREATE POLICY "Everyone can view holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "Admin can manage holidays" ON holidays FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per audit_logs (solo admin può vedere)
CREATE POLICY "Admin can view audit logs" ON audit_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- =====================================================
-- DATI INIZIALI
-- =====================================================

-- Inserisci dipartimenti di base
INSERT INTO departments (name, description) VALUES
('Amministrazione', 'Gestione amministrativa e contabile'),
('Segreteria', 'Servizi di segreteria e supporto'),
('Orientamento', 'Servizi di orientamento e consulenza'),
('Reparto IT', 'Sviluppo software e supporto tecnico')
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
-- FUNZIONI UTILITY
-- =====================================================

-- Funzione per calcolare ore lavorate
CREATE OR REPLACE FUNCTION calculate_worked_hours(clock_in TIME, clock_out TIME, break_duration INTEGER DEFAULT 60)
RETURNS DECIMAL(4,2) AS $$
BEGIN
  IF clock_in IS NULL OR clock_out IS NULL THEN
    RETURN 0;
  END IF;
  
  RETURN GREATEST(0, EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 - (break_duration / 60.0));
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
