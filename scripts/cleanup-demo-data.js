const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDemoData() {
  try {
    console.log('🧹 INIZIO PULIZIA COMPLETA DATI DEMO...');
    
    // 1. Elimina tutti gli utenti demo (tranne admin)
    console.log('\n👥 Eliminazione utenti demo...');
    const { data: demoUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .neq('email', 'admin@laba.com');
    
    if (usersError) {
      console.log('❌ Errore nel recuperare utenti:', usersError.message);
    } else if (demoUsers && demoUsers.length > 0) {
      console.log(`🗑️ Trovati ${demoUsers.length} utenti demo da eliminare:`);
      demoUsers.forEach(user => {
        console.log(`   - ${user.first_name} ${user.last_name} (${user.email})`);
      });
      
      // Elimina tutti gli utenti demo
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .neq('email', 'admin@laba.com');
      
      if (deleteError) {
        console.log('❌ Errore nell\'eliminare utenti demo:', deleteError.message);
      } else {
        console.log('✅ Tutti gli utenti demo eliminati con successo!');
      }
    } else {
      console.log('✅ Nessun utente demo trovato');
    }
    
    // 2. Elimina tutti i dati di presenza
    console.log('\n⏰ Eliminazione dati presenze...');
    const { error: attendanceError } = await supabase
      .from('attendance')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (attendanceError) {
      console.log('❌ Errore nell\'eliminare presenze:', attendanceError.message);
    } else {
      console.log('✅ Tutti i dati presenze eliminati!');
    }
    
    // 3. Elimina tutte le richieste permessi
    console.log('\n📋 Eliminazione richieste permessi...');
    const { error: leaveError } = await supabase
      .from('leave_requests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (leaveError) {
      console.log('❌ Errore nell\'eliminare richieste permessi:', leaveError.message);
    } else {
      console.log('✅ Tutte le richieste permessi eliminate!');
    }
    
    // 4. Elimina tutti i saldi ferie/permessi
    console.log('\n💰 Eliminazione saldi ferie/permessi...');
    const { error: balanceError } = await supabase
      .from('leave_balances')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (balanceError) {
      console.log('❌ Errore nell\'eliminare saldi:', balanceError.message);
    } else {
      console.log('✅ Tutti i saldi ferie/permessi eliminati!');
    }
    
    // 5. Elimina tutti gli orari di lavoro
    console.log('\n🕐 Eliminazione orari di lavoro...');
    const { error: scheduleError } = await supabase
      .from('work_schedules')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (scheduleError) {
      console.log('❌ Errore nell\'eliminare orari:', scheduleError.message);
    } else {
      console.log('✅ Tutti gli orari di lavoro eliminati!');
    }
    
    // 6. Elimina tutte le notifiche
    console.log('\n🔔 Eliminazione notifiche...');
    const { error: notificationError } = await supabase
      .from('notifications')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (notificationError) {
      console.log('❌ Errore nell\'eliminare notifiche:', notificationError.message);
    } else {
      console.log('✅ Tutte le notifiche eliminate!');
    }
    
    console.log('\n🎉 PULIZIA COMPLETATA!');
    console.log('✅ Solo l\'admin rimane nel sistema');
    console.log('✅ Tutti i dati placeholder sono stati eliminati');
    console.log('✅ Il sistema è pronto per l\'uso pulito');
    
  } catch (error) {
    console.log('❌ Errore generale durante la pulizia:', error.message);
  }
}

cleanupDemoData();
