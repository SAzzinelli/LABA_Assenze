/**
 * Script per verificare e rimuovere permessi duplicati
 * Verifica permessi con stesso user_id, start_date, end_date, type e permission_type
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

if (!supabaseKey) {
  console.error('❌ Variabile SUPABASE_KEY non trovata');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  console.log('🔍 Verifica permessi duplicati...\n');

  try {
    // Recupera tutti i permessi (type = 'permission')
    const { data: permissions, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('type', 'permission')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Errore nel recupero permessi:', error);
      return;
    }

    console.log(`📊 Trovati ${permissions.length} permessi totali\n`);

    // Raggruppa per user_id, start_date, end_date, permission_type
    const grouped = {};
    const duplicates = [];

    permissions.forEach(perm => {
      const key = `${perm.user_id}_${perm.start_date}_${perm.end_date}_${perm.permission_type || 'null'}_${perm.entry_time || 'null'}_${perm.exit_time || 'null'}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(perm);
    });

    // Trova duplicati (più di 1 permesso con stessa chiave)
    Object.keys(grouped).forEach(key => {
      if (grouped[key].length > 1) {
        duplicates.push({
          key,
          count: grouped[key].length,
          permissions: grouped[key]
        });
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ Nessun duplicato trovato!\n');
      return;
    }

    console.log(`⚠️  Trovati ${duplicates.length} gruppi di duplicati:\n`);

    duplicates.forEach((dup, idx) => {
      const [userId, startDate, endDate, permissionType, entryTime, exitTime] = dup.key.split('_');
      
      console.log(`\n📋 Gruppo ${idx + 1}:`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Data: ${startDate}`);
      console.log(`   Tipo: ${permissionType || 'N/A'}`);
      console.log(`   Entry Time: ${entryTime !== 'null' ? entryTime : 'N/A'}`);
      console.log(`   Exit Time: ${exitTime !== 'null' ? exitTime : 'N/A'}`);
      console.log(`   Numero duplicati: ${dup.count}`);
      
      // Mostra dettagli di ogni permesso
      dup.permissions.forEach((perm, permIdx) => {
        const user = perm.users || {};
        console.log(`\n   Permesso ${permIdx + 1}:`);
        console.log(`      ID: ${perm.id}`);
        console.log(`      Utente: ${user.first_name || 'N/A'} ${user.last_name || 'N/A'}`);
        console.log(`      Status: ${perm.status}`);
        console.log(`      Creato: ${perm.created_at}`);
        console.log(`      Ore: ${perm.hours || 'N/A'}`);
      });
    });

    // Chiedi conferma per eliminare i duplicati (mantieni il più recente)
    console.log('\n\n🗑️  Vuoi eliminare i duplicati? (mantiene il più recente)');
    console.log('   Esegui con --delete per eliminare automaticamente\n');

    if (process.argv.includes('--delete')) {
      console.log('🗑️  Eliminazione duplicati in corso...\n');
      
      for (const dup of duplicates) {
        // Ordina per created_at (più recente prima)
        const sorted = dup.permissions.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        
        // Mantieni il primo (più recente), elimina gli altri
        const toDelete = sorted.slice(1);
        
        for (const perm of toDelete) {
          const { error: deleteError } = await supabase
            .from('leave_requests')
            .delete()
            .eq('id', perm.id);
          
          if (deleteError) {
            console.error(`   ❌ Errore eliminazione permesso ${perm.id}:`, deleteError);
          } else {
            console.log(`   ✅ Eliminato permesso ${perm.id} (duplicato)`);
          }
        }
      }
      
      console.log('\n✅ Eliminazione completata!\n');
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

// Verifica permessi specifici per Simone (user_id da trovare)
async function checkSimonePermissions() {
  console.log('\n🔍 Verifica permessi di Simone per il 2 dicembre...\n');

  try {
    // Trova user_id di Simone
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .or('first_name.ilike.%simone%,last_name.ilike.%simone%,email.ilike.%simone%');

    if (userError) {
      console.error('❌ Errore nel recupero utenti:', userError);
      return;
    }

    if (users.length === 0) {
      console.log('⚠️  Nessun utente trovato con "simone" nel nome o email');
      return;
    }

    console.log('👤 Utenti trovati:');
    users.forEach(user => {
      console.log(`   - ${user.first_name} ${user.last_name} (${user.email}) - ID: ${user.id}`);
    });

    // Cerca permessi per il 2 dicembre 2025
    const targetDate = '2025-12-02';
    
    for (const user of users) {
      console.log(`\n📋 Permessi per ${user.first_name} ${user.last_name} (ID: ${user.id}):`);
      
      const { data: perms, error: permError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'permission')
        .or(`start_date.eq.${targetDate},end_date.eq.${targetDate}`)
        .order('created_at', { ascending: false });

      if (permError) {
        console.error('   ❌ Errore:', permError);
        continue;
      }

      if (perms.length === 0) {
        console.log('   ⚠️  Nessun permesso trovato per il 2 dicembre 2025');
      } else {
        console.log(`   ✅ Trovati ${perms.length} permesso/i:`);
        perms.forEach((perm, idx) => {
          console.log(`\n   Permesso ${idx + 1}:`);
          console.log(`      ID: ${perm.id}`);
          console.log(`      Data inizio: ${perm.start_date}`);
          console.log(`      Data fine: ${perm.end_date}`);
          console.log(`      Tipo: ${perm.permission_type || 'N/A'}`);
          console.log(`      Status: ${perm.status}`);
          console.log(`      Ore: ${perm.hours || 'N/A'}`);
          console.log(`      Entry Time: ${perm.entry_time || 'N/A'}`);
          console.log(`      Exit Time: ${perm.exit_time || 'N/A'}`);
          console.log(`      Creato: ${perm.created_at}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

// Esegui
(async () => {
  await checkDuplicates();
  await checkSimonePermissions();
})();

