const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupFakeEmails() {
  console.log('🧹 Pulizia email farlocche dal database...');
  
  try {
    // Prima vediamo tutti gli utenti attuali
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .eq('is_active', true);

    if (fetchError) {
      console.error('❌ Errore nel recupero utenti:', fetchError.message);
      return;
    }

    console.log('📋 Utenti attuali nel database:');
    allUsers.forEach(user => {
      console.log(`   - ${user.first_name} ${user.last_name}: ${user.email} (${user.role})`);
    });

    // Lista email REALI (solo quelle che esistono davvero)
    const realEmails = [
      'hr@labafirenze.com',           // Admin
      'simone.azzinelli@labafirenze.com'  // Simone (unico dipendente reale)
    ];

    // Identifica email farlocche da rimuovere
    const fakeUsers = allUsers.filter(user => !realEmails.includes(user.email));
    
    if (fakeUsers.length === 0) {
      console.log('✅ Nessuna email farlocca trovata!');
      return;
    }

    console.log('\n🗑️  Email farlocche da rimuovere:');
    fakeUsers.forEach(user => {
      console.log(`   - ${user.first_name} ${user.last_name}: ${user.email}`);
    });

    // Rimuovi utenti farlocchi
    for (const fakeUser of fakeUsers) {
      console.log(`\n🗑️  Rimuovendo ${fakeUser.first_name} ${fakeUser.last_name}...`);
      
      // Prima rimuovi dati correlati
      await supabase.from('attendance').delete().eq('user_id', fakeUser.id);
      await supabase.from('leave_requests').delete().eq('user_id', fakeUser.id);
      await supabase.from('notifications').delete().eq('user_id', fakeUser.id);
      await supabase.from('work_patterns').delete().eq('user_id', fakeUser.id);
      await supabase.from('work_schedules').delete().eq('user_id', fakeUser.id);
      
      // Poi rimuovi l'utente
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', fakeUser.id);

      if (deleteError) {
        console.error(`❌ Errore rimozione ${fakeUser.first_name}:`, deleteError.message);
      } else {
        console.log(`✅ Rimosso: ${fakeUser.first_name} ${fakeUser.last_name}`);
      }
    }

    console.log('\n🎉 Pulizia completata!');
    console.log('\n📧 Email REALI rimaste:');
    realEmails.forEach(email => {
      console.log(`   - ${email}`);
    });

  } catch (error) {
    console.error('❌ Errore generale:', error.message);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  cleanupFakeEmails();
}

module.exports = { cleanupFakeEmails };
