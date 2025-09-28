const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gojhljczpwbjxbbrtrlq.supabase.co', 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS');

async function testUserFields() {
  try {
    console.log('🔍 Test campi tabella users...');
    
    // Prova a inserire un utente di test con tutti i campi
    const testUser = {
      email: 'test.fields@labafirenze.com',
      password: 'hashedpassword',
      role: 'employee',
      first_name: 'Test',
      last_name: 'Fields',
      is_active: true,
      has_104: false,
      // Campi che potrebbero non esistere
      phone: '+39 333 999 8888',
      position: 'Sviluppatore Test',
      department: 'Reparto IT',
      hire_date: '2024-01-01',
      workplace: 'LABA Firenze - Sede Via Vecchietti',
      contract_type: 'Full Time - Indeterminato',
      birth_date: '1990-01-01'
    };
    
    console.log('📝 Tentativo inserimento con tutti i campi...');
    
    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert([testUser])
      .select();
    
    if (insertError) {
      console.log('❌ Errore inserimento:', insertError.message);
      console.log('🔧 Campo problematico identificato:', insertError.message.match(/Could not find the '(\w+)' column/)?.[1] || 'sconosciuto');
      
      // Prova a inserire solo i campi base
      console.log('\n🔄 Tentativo con campi base solo...');
      const basicUser = {
        email: 'test.basic@labafirenze.com',
        password: 'hashedpassword',
        role: 'employee',
        first_name: 'Test',
        last_name: 'Basic',
        is_active: true,
        has_104: false
      };
      
      const { data: basicInserted, error: basicError } = await supabase
        .from('users')
        .insert([basicUser])
        .select();
      
      if (basicError) {
        console.log('❌ Errore anche con campi base:', basicError.message);
      } else {
        console.log('✅ Campi base funzionano');
        console.log('📋 Campi base inseriti:', Object.keys(basicInserted[0]));
        
        // Pulisci il test
        await supabase.from('users').delete().eq('email', 'test.basic@labafirenze.com');
      }
      
    } else {
      console.log('✅ Tutti i campi funzionano!');
      console.log('📋 Utente inserito:', insertedUser[0]);
      
      // Pulisci il test
      await supabase.from('users').delete().eq('email', 'test.fields@labafirenze.com');
    }
    
    // Controlla la struttura attuale
    console.log('\n📋 Struttura attuale tabella users:');
    const { data: sampleUser, error: sampleError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleError) {
      console.log('❌ Errore nel recupero struttura:', sampleError.message);
    } else {
      console.log('✅ Campi disponibili:', Object.keys(sampleUser));
    }
    
  } catch (error) {
    console.log('❌ Errore generale:', error.message);
  }
}

testUserFields();
