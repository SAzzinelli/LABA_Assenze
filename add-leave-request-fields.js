const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variabili d\'ambiente Supabase mancanti');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addLeaveRequestFields() {
  try {
    console.log('🔧 Aggiungendo campi mancanti alla tabella leave_requests...');

    // Aggiungi i campi mancanti
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE leave_requests 
        ADD COLUMN IF NOT EXISTS permission_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS hours DECIMAL(4,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS exit_time TIME,
        ADD COLUMN IF NOT EXISTS entry_time TIME;
      `
    });

    if (error) {
      console.error('❌ Errore nell\'aggiunta dei campi:', error);
      return;
    }

    console.log('✅ Campi aggiunti con successo alla tabella leave_requests:');
    console.log('   - permission_type VARCHAR(50)');
    console.log('   - hours DECIMAL(4,2) DEFAULT 0');
    console.log('   - exit_time TIME');
    console.log('   - entry_time TIME');

  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

addLeaveRequestFields();
