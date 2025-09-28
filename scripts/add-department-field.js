const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addDepartmentField() {
  try {
    console.log('🔧 Aggiungo campo department alla tabella users...');
    
    // Prima controllo se il campo esiste già
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('department')
      .limit(1);
    
    if (testError && testError.message.includes('column "department" does not exist')) {
      console.log('❌ Campo department non esiste, procedo con l\'aggiunta...');
      
      // Non posso usare ALTER TABLE direttamente, quindi uso un approccio diverso
      // Aggiorno gli utenti esistenti con un valore di default
      console.log('📝 Aggiorno utenti esistenti con dipartimento di default...');
      
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('id, role')
        .eq('role', 'employee');
      
      if (fetchError) {
        console.log('❌ Errore nel recuperare utenti:', fetchError.message);
        return;
      }
      
      if (users && users.length > 0) {
        console.log(`👥 Trovati ${users.length} dipendenti da aggiornare`);
        
        // Aggiorno ogni utente con un dipartimento di default
        const departments = ['Amministrazione', 'Segreteria', 'Orientamento', 'Reparto IT'];
        
        for (let i = 0; i < users.length; i++) {
          const user = users[i];
          const dept = departments[i % departments.length];
          
          const { error: updateError } = await supabase
            .from('users')
            .update({ department: dept })
            .eq('id', user.id);
          
          if (updateError) {
            console.log(`❌ Errore aggiornamento utente ${user.id}:`, updateError.message);
          } else {
            console.log(`✅ Utente ${user.id} aggiornato con dipartimento ${dept}`);
          }
        }
        
        console.log('🎉 Aggiornamento completato!');
      } else {
        console.log('👥 Nessun dipendente trovato');
      }
    } else if (testError) {
      console.log('❌ Errore nel test:', testError.message);
    } else {
      console.log('✅ Campo department già esiste');
    }
    
  } catch (error) {
    console.log('❌ Errore generale:', error.message);
  }
}

addDepartmentField();
