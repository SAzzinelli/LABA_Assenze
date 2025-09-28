-- Database Schema per Sistema HR Presenze LABA
-- PostgreSQL/Supabase

-- Tabella users (già esistente)
-- CREATE TABLE users (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   email VARCHAR(255) UNIQUE NOT NULL,
--   password VARCHAR(255) NOT NULL,
--   role VARCHAR(50) NOT NULL DEFAULT 'employee',
--   first_name VARCHAR(100) NOT NULL,
--   last_name VARCHAR(100) NOT NULL,
--   birth_date DATE,
--   phone VARCHAR(20),
--   department VARCHAR(100),
--   has_104 BOOLEAN DEFAULT FALSE,
--   is_active BOOLEAN DEFAULT TRUE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Tabella attendance (presenze)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  hours_worked DECIMAL(4,2),
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, absent
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Tabella leave_requests (richieste permessi)
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- ferie, malattia, permesso, maternità
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella documents (documenti)
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500),
  file_type VARCHAR(50),
  file_size INTEGER,
  category VARCHAR(50), -- contratto, busta_paga, certificato, altro
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella notifications (notifiche)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- info, warning, error, success
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Tabella departments (dipartimenti)
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella shifts (turni)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INTEGER DEFAULT 0, -- minuti
  is_overtime BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts(user_id, date);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Applica trigger a tutte le tabelle
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserisci dipartimenti di base
INSERT INTO departments (name, description) VALUES
('Amministrazione', 'Gestione amministrativa e contabile'),
('Segreteria', 'Servizi di segreteria e supporto'),
('Orientamento', 'Servizi di orientamento e consulenza'),
('Reparto IT', 'Sviluppo software e supporto tecnico')
ON CONFLICT (name) DO NOTHING;

-- Policy RLS (Row Level Security) per Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Policy per users (admin può vedere tutti, user solo se stesso)
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Admin can view all users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per attendance (user vede solo le sue presenze, admin vede tutto)
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all attendance" ON attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per leave_requests (user vede solo le sue richieste, admin vede tutto)
CREATE POLICY "Users can manage own requests" ON leave_requests FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all requests" ON leave_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per documents (user vede solo i suoi documenti, admin vede tutto)
CREATE POLICY "Users can manage own documents" ON documents FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all documents" ON documents FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per notifications (user vede solo le sue notifiche)
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id::text = auth.uid()::text);

-- Policy per departments (tutti possono leggere, solo admin può modificare)
CREATE POLICY "Everyone can view departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Admin can manage departments" ON departments FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Policy per shifts (user vede solo i suoi turni, admin vede tutto)
CREATE POLICY "Users can manage own shifts" ON shifts FOR ALL USING (user_id::text = auth.uid()::text);
CREATE POLICY "Admin can manage all shifts" ON shifts FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);
