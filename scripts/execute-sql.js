const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gojhljczpwbjxbbrtrlq.supabase.co', 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS');

async function executeSQL() {
  try {
    console.log('🔧 Aggiungo colonne alla tabella users...');
    
    // Aggiungi colonne una per una
    const columns = [
      { name: 'phone', type: 'TEXT' },
      { name: 'position', type: 'TEXT' },
      { name: 'department', type: 'TEXT' },
      { name: 'hire_date', type: 'DATE' },
      { name: 'workplace', type: 'TEXT' },
      { name: 'contract_type', type: 'TEXT' },
      { name: 'birth_date', type: 'DATE' }
    ];
    
    for (const column of columns) {
      try {
        console.log(`📝 Aggiungo colonna: ${column.name} (${column.type})`);
        
        // Prova ad aggiungere la colonna
        const { error } = await supabase.rpc('exec_sql', {
          sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};`
        });
        
        if (error) {
          console.log(`⚠️ Errore aggiunta colonna ${column.name}:`, error.message);
          // Se fallisce, prova a usare il metodo diretto
          console.log(`🔄 Tentativo metodo alternativo per ${column.name}...`);
        } else {
          console.log(`✅ Colonna ${column.name} aggiunta con successo`);
        }
      } catch (err) {
        console.log(`❌ Errore generale per colonna ${column.name}:`, err.message);
      }
    }
    
    // Ora aggiorna i dati di Simone
    console.log('\n👤 Aggiorno dati Simone...');
    
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        phone: '+39 333 123 4567',
        position: 'Sviluppatore Full Stack',
        department: 'Reparto IT',
        hire_date: '2023-01-15',
        workplace: 'LABA Firenze - Sede Via Vecchietti',
        contract_type: 'Full Time - Indeterminato',
        birth_date: '1994-05-15'
      })
      .eq('email', 'simone.azzinelli@labafirenze.com')
      .select();
    
    if (updateError) {
      console.log('❌ Errore aggiornamento Simone:', updateError.message);
      
      // Prova ad aggiornare solo i campi che esistono
      console.log('🔄 Tentativo aggiornamento parziale...');
      
      // Controlla quali campi esistono ora
      const { data: testUser, error: testError } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'simone.azzinelli@labafirenze.com')
        .single();
      
      if (testError) {
        console.log('❌ Errore test utente:', testError.message);
      } else {
        console.log('📋 Campi disponibili ora:', Object.keys(testUser));
      }
    } else {
      console.log('✅ Simone aggiornato con successo!');
      console.log('   Dati:', updatedUser[0]);
    }
    
  } catch (error) {
    console.log('❌ Errore generale:', error.message);
  }
}

executeSQL();
