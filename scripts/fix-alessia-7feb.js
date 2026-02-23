/**
 * Fix Alessia: 7 febbraio - imposta 5 ore lavorate (correzione)
 * Esegui: node scripts/fix-alessia-7feb.js
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAlessia7Feb() {
  console.log('🛠️ Aggiornamento Alessia - 7 febbraio: actual_hours → 5h');

  // Trova Alessia (cercando first_name)
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .ilike('first_name', 'Alessia');

  if (userError) {
    console.error('❌ Errore recupero utenti:', userError);
    return;
  }
  if (!users || users.length === 0) {
    console.error('❌ Nessun utente "Alessia" trovato');
    return;
  }

  const user = users[0];
  console.log(`👤 Trovata: ${user.first_name} ${user.last_name} (${user.id})`);

  // Cerca record 7 feb 2026 (o 2025 se non esiste)
  const datesToTry = ['2026-02-07', '2025-02-07'];
  for (const dateStr of datesToTry) {
    const { data: record, error: attError } = await supabase
      .from('attendance')
      .select('id, date, actual_hours, expected_hours, balance_hours')
      .eq('user_id', user.id)
      .eq('date', dateStr)
      .single();

    if (attError || !record) continue;

    console.log(`📅 Record ${dateStr}: actual=${record.actual_hours}h, expected=${record.expected_hours}h`);

    const newActual = 5;
    const newBalance = newActual - (record.expected_hours || 5);

    const { error: updateError } = await supabase
      .from('attendance')
      .update({
        actual_hours: newActual,
        balance_hours: Math.round(newBalance * 100) / 100,
        notes: record.notes ? `${record.notes} [Corretto: 5h lavorate]` : 'Corretto manualmente: 5h lavorate'
      })
      .eq('id', record.id);

    if (updateError) {
      console.error('❌ Errore aggiornamento:', updateError);
      return;
    }

    console.log(`✅ Aggiornato: ${record.actual_hours}h → 5h per il ${dateStr}`);
    return;
  }

  console.error('❌ Nessun record di presenza trovato per Alessia il 7 febbraio 2025 o 2026');
}

fixAlessia7Feb().catch(console.error);
