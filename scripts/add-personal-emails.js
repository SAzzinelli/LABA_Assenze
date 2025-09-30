const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function addPersonalEmails() {
  console.log('📧 Aggiungendo email personali dei dipendenti...');
  
  try {
    // Mappa dipendenti con email personali
    const personalEmails = {
      'simone.azzinelli@labafirenze.com': 'simone.azzinelli@gmail.com', // Esempio
      'marco.rossi@labafirenze.com': 'marco.rossi@gmail.com', // Esempio
      'silvia.verdi@labafirenze.com': 'silvia.verdi@gmail.com', // Esempio
      // Aggiungi qui le email reali dei dipendenti
    };

    for (const [workEmail, personalEmail] of Object.entries(personalEmails)) {
      console.log(`📧 Aggiornando ${workEmail} → ${personalEmail}`);
      
      const { data, error } = await supabase
        .from('users')
        .update({
          personal_email: personalEmail // Nuovo campo per email personale
        })
        .eq('email', workEmail)
        .select();

      if (error) {
        console.error(`❌ Errore aggiornamento ${workEmail}:`, error.message);
      } else {
        console.log(`✅ Aggiornato: ${workEmail} → ${personalEmail}`);
      }
    }

    console.log('🎉 Email personali aggiunte con successo!');
    
  } catch (error) {
    console.error('❌ Errore generale:', error.message);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  addPersonalEmails();
}

module.exports = { addPersonalEmails };
