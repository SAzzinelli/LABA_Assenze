const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function addPersonalEmailField() {
  console.log('🔧 Aggiungendo campo personal_email alla tabella users...');
  
  try {
    // Prova ad aggiungere la colonna personal_email
    const { data, error } = await supabase.rpc('add_personal_email_column');
    
    if (error) {
      console.log('⚠️  Campo personal_email potrebbe già esistere o errore:', error.message);
      
      // Verifica se la colonna esiste già
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'users')
        .eq('column_name', 'personal_email');
      
      if (columnsError) {
        console.log('❌ Errore nel verificare le colonne:', columnsError.message);
        return;
      }
      
      if (columns && columns.length > 0) {
        console.log('✅ Campo personal_email già esistente!');
      } else {
        console.log('❌ Campo personal_email non trovato. Potrebbe essere necessario aggiungerlo manualmente.');
        console.log('💡 SQL da eseguire: ALTER TABLE users ADD COLUMN personal_email TEXT;');
      }
    } else {
      console.log('✅ Campo personal_email aggiunto con successo!');
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error.message);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  addPersonalEmailField();
}

module.exports = { addPersonalEmailField };
