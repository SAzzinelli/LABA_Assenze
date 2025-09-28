const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gojhljczpwbjxbbrtrlq.supabase.co', 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS');

async function updateSimoneData() {
  try {
    console.log('👤 Aggiorno dati completi per Simone...');
    
    // Prima controllo i dati attuali
    const { data: currentUser, error: currentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'simone.azzinelli@labafirenze.com')
      .single();
    
    if (currentError) {
      console.log('❌ Errore nel recupero dati Simone:', currentError.message);
      return;
    }
    
    console.log('📋 Dati attuali Simone:');
    console.log('   Nome:', currentUser.first_name, currentUser.last_name);
    console.log('   Email:', currentUser.email);
    console.log('   Telefono:', currentUser.phone || 'MANCANTE');
    console.log('   Posizione:', currentUser.position || 'MANCANTE');
    console.log('   Dipartimento:', currentUser.department || 'MANCANTE');
    console.log('   Data assunzione:', currentUser.hire_date || 'MANCANTE');
    console.log('   Sede:', currentUser.workplace || 'MANCANTE');
    console.log('   Contratto:', currentUser.contract_type || 'MANCANTE');
    
    // Aggiorno con dati completi
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        phone: '+39 333 123 4567',
        position: 'Sviluppatore Full Stack',
        department: 'Reparto IT',
        hire_date: '2023-01-15',
        workplace: 'LABA Firenze - Sede Via Vecchietti',
        contract_type: 'Full Time - Indeterminato',
        birth_date: '1994-05-15',
        has_104: false
      })
      .eq('email', 'simone.azzinelli@labafirenze.com')
      .select();
    
    if (updateError) {
      console.log('❌ Errore aggiornamento Simone:', updateError.message);
      
      // Se i campi non esistono, provo ad aggiungerli uno per uno
      console.log('🔧 Tentativo di aggiungere campi mancanti...');
      
      const updates = {};
      if (!currentUser.phone) updates.phone = '+39 333 123 4567';
      if (!currentUser.position) updates.position = 'Sviluppatore Full Stack';
      if (!currentUser.department) updates.department = 'Reparto IT';
      if (!currentUser.hire_date) updates.hire_date = '2023-01-15';
      if (!currentUser.workplace) updates.workplace = 'LABA Firenze - Sede Via Vecchietti';
      if (!currentUser.contract_type) updates.contract_type = 'Full Time - Indeterminato';
      if (!currentUser.birth_date) updates.birth_date = '1994-05-15';
      if (currentUser.has_104 === null) updates.has_104 = false;
      
      if (Object.keys(updates).length > 0) {
        const { data: partialUpdate, error: partialError } = await supabase
          .from('users')
          .update(updates)
          .eq('email', 'simone.azzinelli@labafirenze.com')
          .select();
        
        if (partialError) {
          console.log('❌ Errore aggiornamento parziale:', partialError.message);
        } else {
          console.log('✅ Aggiornamento parziale riuscito:', partialUpdate[0]);
        }
      }
    } else {
      console.log('✅ Simone aggiornato con successo!');
      console.log('   Nuovi dati:', updatedUser[0]);
    }
    
  } catch (error) {
    console.log('❌ Errore generale:', error.message);
  }
}

updateSimoneData();
