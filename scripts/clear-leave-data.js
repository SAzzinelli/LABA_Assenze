const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use the same project credentials used elsewhere in this repo
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearLeaveData() {
  console.log('🧹 Avvio pulizia completa di ferie/permessi/malattie...');

  // 1) Delete all leave requests (permessi, ferie, malattia) for every user
  console.log('\n📋 Eliminazione tabella leave_requests...');
  const { error: delLeaveErr } = await supabase
    .from('leave_requests')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (delLeaveErr) {
    console.error('❌ Errore eliminazione leave_requests:', delLeaveErr.message || delLeaveErr);
  } else {
    console.log('✅ Tutte le richieste (permessi/ferie/malattie) sono state eliminate.');
  }

  // 2) Delete related hour ledger entries for vacation and permission categories (if the hours system is enabled)
  console.log('\n⏱️ Eliminazione movimenti ore (vacation/permission) da hours_ledger (se esiste)...');
  try {
    const { error: delLedgerErr } = await supabase
      .from('hours_ledger')
      .delete()
      .in('category', ['vacation', 'permission']);
    if (delLedgerErr) {
      console.warn('⚠️ Impossibile eliminare da hours_ledger (può non esistere):', delLedgerErr.message || delLedgerErr);
    } else {
      console.log('✅ Movimenti ore per ferie/permessi eliminati da hours_ledger.');
    }
  } catch (e) {
    console.warn('⚠️ Tabella hours_ledger non presente o non accessibile, procedo oltre.');
  }

  // 3) Optionally clear pending counts in current_balances (not required, skipped intentionally)
  console.log('\n🎯 Pulizia completata.');
}

clearLeaveData().catch((e) => {
  console.error('❌ Errore inatteso durante la pulizia:', e);
  process.exit(1);
});


