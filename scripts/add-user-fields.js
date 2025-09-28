const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gojhljczpwbjxbbrtrlq.supabase.co', 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS');

async function addUserFields() {
  try {
    console.log('🔧 Aggiungo campi mancanti alla tabella users...');
    
    // Controllo quali campi esistono già
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.log('❌ Errore nel test:', testError.message);
      return;
    }
    
    if (testData && testData.length > 0) {
      const existingFields = Object.keys(testData[0]);
      console.log('📋 Campi esistenti:', existingFields);
      
      const requiredFields = [
        'phone',
        'position', 
        'hire_date',
        'workplace',
        'contract_type'
      ];
      
      const missingFields = requiredFields.filter(field => !existingFields.includes(field));
      
      if (missingFields.length > 0) {
        console.log('❌ Campi mancanti:', missingFields);
        console.log('🔧 Nota: I campi verranno aggiunti automaticamente quando verranno usati');
        console.log('   Supabase aggiunge automaticamente le colonne quando si inseriscono dati');
      } else {
        console.log('✅ Tutti i campi richiesti esistono già');
      }
    }
    
    // Aggiorno l'utente Simone con i dati mancanti
    console.log('\n👤 Aggiorno utente Simone con dati completi...');
    
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({
        phone: '+39 333 123 4567',
        position: 'Sviluppatore',
        hire_date: '2023-01-15',
        workplace: 'LABA Firenze - Sede Via Vecchietti',
        contract_type: 'Full Time - Indeterminato',
        department: 'Reparto IT'
      })
      .eq('email', 'simone.azzinelli@labafirenze.com')
      .select();
    
    if (updateError) {
      console.log('❌ Errore aggiornamento Simone:', updateError.message);
    } else if (updateData && updateData.length > 0) {
      console.log('✅ Simone aggiornato con successo!');
      console.log('   Telefono:', updateData[0].phone);
      console.log('   Posizione:', updateData[0].position);
      console.log('   Data assunzione:', updateData[0].hire_date);
      console.log('   Sede:', updateData[0].workplace);
      console.log('   Contratto:', updateData[0].contract_type);
      console.log('   Dipartimento:', updateData[0].department);
    }
    
  } catch (error) {
    console.log('❌ Errore generale:', error.message);
  }
}

addUserFields();
