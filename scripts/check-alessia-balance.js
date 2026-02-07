/**
 * Verifica in DB se le ore aggiunte manualmente ad Alessia sono state inserite.
 * Controlla: users, attendance, hours_ledger, current_balances.
 *
 * Uso: dalla root del progetto (dove c'è .env)
 *   node scripts/check-alessia-balance.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supporta anche SUPABASE_KEY se usi quello nel .env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Imposta SUPABASE_URL e SUPABASE_SERVICE_KEY (o SUPABASE_KEY) in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Verifica ore Alessia – attendance, ledger, current_balances');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Trova Alessia (cerca per nome; adatta il filtro se il cognome è diverso)
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, is_active')
    .ilike('first_name', '%alessia%');

  if (userError) {
    console.error('❌ Errore lettura users:', userError.message);
    return;
  }
  if (!users || users.length === 0) {
    console.log('⚠️ Nessun utente trovato con nome "Alessia". Prova a cambiare il filtro nello script.');
    return;
  }

  for (const u of users) {
    const fullName = `${u.first_name} ${u.last_name}`;
    console.log(`\n👤 Utente: ${fullName} (id: ${u.id}, active: ${u.is_active})`);
    console.log('───────────────────────────────────────────────────────────────');

    const userId = u.id;
    const currentYear = new Date().getFullYear();

    // 2. Attendance: ultimi record e tutti quelli con balance_hours != 0 o note "Ricarica"/"credito"
    const { data: attendanceAll, error: attError } = await supabase
      .from('attendance')
      .select('id, date, balance_hours, actual_hours, expected_hours, notes')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(50);

    if (attError) {
      console.error('   ❌ Errore attendance:', attError.message);
    } else {
      const withCredit = (attendanceAll || []).filter(
        (r) =>
          (r.notes || '').toLowerCase().includes('ricarica') ||
          (r.notes || '').toLowerCase().includes('credito') ||
          parseFloat(r.balance_hours || 0) > 0
      );
      const totalBalanceFromAttendance = (attendanceAll || []).reduce(
        (s, r) => s + parseFloat(r.balance_hours || 0),
        0
      );
      console.log(`   📅 Attendance: ${attendanceAll?.length ?? 0} record (ultimi 50)`);
      console.log(`   📊 Somma balance_hours (sui 50): ${totalBalanceFromAttendance.toFixed(2)}h`);
      if (withCredit.length > 0) {
        console.log(`   💰 Record con credito/ricarica/balance>0: ${withCredit.length}`);
        withCredit.slice(0, 10).forEach((r) => {
          console.log(`      - ${r.date}: balance=${r.balance_hours}h | ${(r.notes || '').slice(0, 60)}...`);
        });
      } else {
        console.log('   ⚠️ Nessun record con Ricarica/credito o balance > 0 negli ultimi 50.');
      }
    }

    // 3. Hours_ledger: manual_credit per questo user
    const { data: ledgerManual, error: ledgerError } = await supabase
      .from('hours_ledger')
      .select('id, transaction_date, hours, reason, reference_type, created_at')
      .eq('user_id', userId)
      .eq('reference_type', 'manual_credit')
      .order('transaction_date', { ascending: false })
      .limit(20);

    if (ledgerError) {
      console.error('   ❌ Errore hours_ledger:', ledgerError.message);
    } else {
      console.log(`   📒 hours_ledger (manual_credit): ${ledgerManual?.length ?? 0} movimenti`);
      if (ledgerManual && ledgerManual.length > 0) {
        ledgerManual.forEach((l) => {
          console.log(`      - ${l.transaction_date}: +${l.hours}h | ${(l.reason || '').slice(0, 50)}`);
        });
      } else {
        console.log('   ⚠️ Nessun movimento manual_credit trovato.');
      }
    }

    // 4. Current_balances: overtime
    const { data: balance, error: balError } = await supabase
      .from('current_balances')
      .select('year, current_balance, total_accrued, updated_at')
      .eq('user_id', userId)
      .eq('category', 'overtime')
      .eq('year', currentYear)
      .single();

    if (balError && balError.code !== 'PGRST116') {
      console.error('   ❌ Errore current_balances:', balError.message);
    } else if (balance) {
      console.log(`   💵 current_balances (overtime, ${currentYear}): ${balance.current_balance ?? 0}h (total_accrued: ${balance.total_accrued ?? 0})`);
    } else {
      console.log(`   ⚠️ Nessuna riga current_balances per overtime anno ${currentYear}.`);
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('Fine verifica.');
  console.log('Se non ci sono manual_credit in hours_ledger e nessun record');
  console.log('attendance con "Ricarica", l\'inserimento non è andato a buon fine.');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
