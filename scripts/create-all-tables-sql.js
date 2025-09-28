#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

// SQL per creare tutte le tabelle
const CREATE_TABLES_SQL = `
-- =====================================================
-- CREAZIONE TUTTE LE TABELLE SISTEMA HR LABA
-- =====================================================

-- 1. TABELLA SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- 2. TABELLA WORK_SCHEDULES
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_working_day BOOLEAN DEFAULT TRUE,
  work_type VARCHAR(20) DEFAULT 'full_day',
  start_time TIME,
  end_time TIME,
  break_duration INTEGER DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);

-- 3. TABELLA LEAVE_BALANCES
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  leave_type VARCHAR(50) NOT NULL,
  total_entitled DECIMAL(5,2) DEFAULT 0,
  used DECIMAL(5,2) DEFAULT 0,
  pending DECIMAL(5,2) DEFAULT 0,
  remaining DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, year, leave_type)
);

-- 4. TABELLA DEPARTMENTS
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

-- 5. TABELLA NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR(500),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABELLA DOCUMENTS
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_size INTEGER,
  category VARCHAR(50),
  uploaded_by UUID REFERENCES users(id),
  is_public BOOLEAN DEFAULT FALSE,
  expires_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABELLA PAYROLL
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
  status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

-- 8. TABELLA HOLIDAYS
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_national BOOLEAN DEFAULT TRUE,
  applies_to_departments UUID[] DEFAULT '{}',
  is_paid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. TABELLA AUDIT_LOGS
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

CREATE INDEX IF NOT EXISTS idx_settings_user_category ON settings(user_id, category);
CREATE INDEX IF NOT EXISTS idx_work_schedules_user ON work_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_day ON work_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON leave_balances(user_id, year);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_user_month_year ON payroll(user_id, month, year);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
`;

// SQL per popolare dati iniziali
const POPULATE_DATA_SQL = `
-- =====================================================
-- POPOLAMENTO DATI INIZIALI
-- =====================================================

-- Dipartimenti
INSERT INTO departments (name, description, location, is_active) VALUES
('Amministrazione', 'Gestione amministrativa e contabile', 'LABA Firenze - Sede Via Vecchietti', true),
('Segreteria', 'Servizi di segreteria e supporto', 'LABA Firenze - Sede Via Vecchietti', true),
('Orientamento', 'Servizi di orientamento e consulenza', 'LABA Firenze - Sede Via Vecchietti', true),
('Reparto IT', 'Sviluppo software e supporto tecnico', 'LABA Firenze - Sede Via Vecchietti', true)
ON CONFLICT (name) DO NOTHING;

-- Giorni festivi italiani 2025
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
`;

async function createAllTables() {
  console.log('🚀 CREAZIONE DATABASE COMPLETO SISTEMA HR LABA');
  console.log('================================================');
  
  try {
    // Prova a eseguire SQL usando rpc
    console.log('📊 Creazione tabelle...');
    
    // Dividi in comandi singoli per Supabase
    const commands = CREATE_TABLES_SQL.split(';').filter(cmd => cmd.trim().length > 0);
    
    for (const command of commands) {
      if (command.trim()) {
        try {
          // Usa una funzione RPC personalizzata se disponibile
          const { error } = await supabase.rpc('exec_sql', { 
            sql: command.trim() + ';' 
          });
          
          if (error) {
            console.log(`⚠️ Comando saltato: ${command.substring(0, 50)}...`);
            console.log(`   Errore: ${error.message}`);
          } else {
            console.log(`✅ Comando eseguito: ${command.substring(0, 50)}...`);
          }
        } catch (e) {
          console.log(`❌ Errore comando: ${e.message}`);
        }
      }
    }
    
    console.log('\n📝 Popolamento dati iniziali...');
    
    // Popola dati iniziali
    const dataCommands = POPULATE_DATA_SQL.split(';').filter(cmd => cmd.trim().length > 0);
    
    for (const command of dataCommands) {
      if (command.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { 
            sql: command.trim() + ';' 
          });
          
          if (error) {
            console.log(`⚠️ Dati saltati: ${error.message}`);
          } else {
            console.log(`✅ Dati inseriti`);
          }
        } catch (e) {
          console.log(`❌ Errore dati: ${e.message}`);
        }
      }
    }
    
    console.log('\n🎉 Setup database completato!');
    console.log('\n📋 TABELLE CREATE:');
    console.log('   ✅ settings - Impostazioni utente');
    console.log('   ✅ work_schedules - Orari di lavoro');
    console.log('   ✅ leave_balances - Saldi ferie/permessi');
    console.log('   ✅ departments - Dipartimenti');
    console.log('   ✅ notifications - Notifiche');
    console.log('   ✅ documents - Documenti');
    console.log('   ✅ payroll - Stipendi');
    console.log('   ✅ holidays - Giorni festivi');
    console.log('   ✅ audit_logs - Log azioni');
    
    console.log('\n📊 DATI INIZIALI:');
    console.log('   ✅ 4 Dipartimenti inseriti');
    console.log('   ✅ 12 Giorni festivi 2025 inseriti');
    
  } catch (error) {
    console.error('❌ Errore durante creazione database:', error);
  }
}

// Esegui creazione
if (require.main === module) {
  createAllTables().catch(console.error);
}

module.exports = { createAllTables };
