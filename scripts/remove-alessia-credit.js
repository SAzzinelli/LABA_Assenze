/**
 * Rimuove le 3h 57min (3.95h) da Alessia Pasqui.
 * Dopo questo script potrai aggiungere 8h manualmente dall'interfaccia.
 *
 * Cosa fa:
 * 1. Aggiorna l'attendance di oggi: balance_hours = actual - expected (rimuove il credito 8h)
 * 2. Elimina i movimenti manual_credit in hours_ledger per oggi
 *
 * Uso: node scripts/remove-alessia-credit.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Imposta SUPABASE_URL e SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const HOURS_TO_REMOVE = 3.95; // 3h 57min

async function main() {
  const today = new Date().toISOString().split('T')[0];

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🔧 Rimozione ${HOURS_TO_REMOVE}h da Alessia per ${today}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Trova Alessia
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .ilike('first_name', '%alessia%');

  if (userError || !users?.length) {
    console.error('❌ Nessun utente Alessia trovato');
    process.exit(1);
  }

  const alessia = users[0];
  const userId = alessia.id;
  console.log(`👤 Utente: ${alessia.first_name} ${alessia.last_name} (id: ${userId})\n`);

  // 2. Attendance di oggi
  const { data: att, error: attError } = await supabase
    .from('attendance')
    .select('id, date, balance_hours, actual_hours, expected_hours, notes')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (attError && attError.code !== 'PGRST116') {
    console.error('❌ Errore lettura attendance:', attError.message);
    process.exit(1);
  }

  if (att) {
    const oldBalance = parseFloat(att.balance_hours || 0);
    const actual = parseFloat(att.actual_hours || 0);
    const expected = parseFloat(att.expected_hours || 0);
    const newBalance = Math.round((actual - expected) * 100) / 100;

    console.log(`📅 Attendance ${today}:`);
    console.log(`   Prima: balance=${oldBalance}h (actual=${actual}, expected=${expected})`);
    console.log(`   Dopo:  balance=${newBalance}h (solo actual - expected)\n`);

    const { error: updateError } = await supabase
      .from('attendance')
      .update({
        balance_hours: newBalance,
        notes: 'Rimosso credito manuale precedente - aggiungere 8h da interfaccia'
      })
      .eq('id', att.id);

    if (updateError) {
      console.error('❌ Errore update attendance:', updateError.message);
      process.exit(1);
    }
    console.log('   ✅ Attendance aggiornata');
  } else {
    console.log('   ⚠️ Nessuna presenza per oggi, nessun update attendance\n');
  }

  // 3. Elimina manual_credit in hours_ledger per oggi
  const { error: delError } = await supabase
    .from('hours_ledger')
    .delete()
    .eq('user_id', userId)
    .eq('transaction_date', today)
    .eq('reference_type', 'manual_credit');

  if (delError) {
    console.error('❌ Errore eliminazione ledger:', delError.message);
    process.exit(1);
  }
  console.log('   ✅ Eliminati movimenti manual_credit per oggi\n');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Fatto. Ora puoi aggiungere 8h manualmente da Banca Ore.');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
