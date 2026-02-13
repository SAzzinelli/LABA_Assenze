/**
 * Reset ore aggiunte manualmente per Alessia a 0.
 * 1. Per ogni record attendance con "Ricarica"/"credito" in note: ricalcola balance_hours = solo ore lavoro
 * 2. Aggiorna current_balances overtime 2026 con il valore corretto (fix 9999.99)
 *
 * Uso: node scripts/reset-alessia-manual-credits.js
 * Richiede: SUPABASE_URL, SUPABASE_SERVICE_KEY in .env
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
const ALESSIA_ID = '3289f556-a964-49d9-af7c-718cb82f3533'; // da check precedente
const CURRENT_YEAR = new Date().getFullYear();

function capLedgerValue(v) {
  const n = parseFloat(v) || 0;
  return Math.min(9999.99, Math.max(-9999.99, n));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 Reset ore manuali Alessia → 0h + fix current_balances');
  console.log('═══════════════════════════════════════════════════════════\n');

  const userId = ALESSIA_ID;

  // 1. Trova tutti i record attendance con Ricarica/credito
  const { data: attendanceAll, error: attErr } = await supabase
    .from('attendance')
    .select('id, date, balance_hours, actual_hours, expected_hours, notes')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (attErr) {
    console.error('❌ Errore attendance:', attErr.message);
    process.exit(1);
  }

  const withManual = (attendanceAll || []).filter(
    (r) =>
      (r.notes || '').toLowerCase().includes('ricarica') ||
      (r.notes || '').toLowerCase().includes('credito')
  );

  console.log(`📅 Record con Ricarica/credito da correggere: ${withManual.length}`);

  for (const rec of withManual) {
    // Verifica permesso approvato per quella data
    const { data: perms } = await supabase
      .from('leave_requests')
      .select('hours')
      .eq('user_id', userId)
      .eq('type', 'permission')
      .eq('status', 'approved')
      .lte('start_date', rec.date)
      .gte('end_date', rec.date);

    let newBalance;
    if (perms && perms.length > 0) {
      const permHours = perms.reduce((s, p) => s + parseFloat(p.hours || 0), 0);
      newBalance = -permHours;
    } else {
      const actual = parseFloat(rec.actual_hours || 0);
      const expected = parseFloat(rec.expected_hours || 0);
      newBalance = actual - expected;
    }
    newBalance = Math.round(newBalance * 100) / 100;

    const oldBalance = parseFloat(rec.balance_hours || 0);
    if (Math.abs(newBalance - oldBalance) < 0.01) {
      console.log(`   ${rec.date}: già corretto (${oldBalance}h)`);
      continue;
    }

    const { error: updErr } = await supabase
      .from('attendance')
      .update({ balance_hours: newBalance })
      .eq('id', rec.id);

    if (updErr) {
      console.error(`   ❌ ${rec.date}: errore update`, updErr.message);
    } else {
      console.log(`   ✅ ${rec.date}: ${oldBalance}h → ${newBalance}h (ore lavoro)`);
    }
  }

  // 2. Ricalcola saldo totale da attendance (tutto fino a oggi) + ledger
  const today = new Date().toISOString().slice(0, 10);
  const { data: attendance } = await supabase
    .from('attendance')
    .select('balance_hours, date, notes')
    .eq('user_id', userId)
    .lte('date', today);

  let totalBalance = 0;
  if (attendance && attendance.length > 0) {
    for (const r of attendance) {
      const bal = parseFloat(r.balance_hours || 0);
      const notes = r.notes || '';
      const isRecovery = notes.includes('Recupero ore') || notes.includes('recupero ore');
      const isCredit = notes.includes('credito') || notes.includes('Credito') || notes.includes('Ricarica') || notes.includes('ricarica');
      const todayRec = r.date === today;
      const hasApprovedPerm = notes.includes('Permesso approvato') || notes.includes('Permesso creato');
      if (todayRec && bal <= 0 && !isRecovery && !isCredit && !hasApprovedPerm) {
        continue; // escludi debito oggi senza permesso
      }
      totalBalance += bal;
    }
  }

  // Ledger manual_credit (se ci fosse)
  const { data: ledgerCredits } = await supabase
    .from('hours_ledger')
    .select('transaction_date, hours, hours_amount')
    .eq('user_id', userId)
    .eq('reference_type', 'manual_credit')
    .eq('transaction_type', 'accrual');

  let manualTopUp = 0;
  if (ledgerCredits && ledgerCredits.length > 0) {
    for (const row of ledgerCredits) {
      const hrs = parseFloat(row.hours || row.hours_amount || 0);
      const attRec = attendance?.find((a) => a.date === row.transaction_date);
      let alreadyCounted = 0;
      if (attRec && ((attRec.notes || '').toLowerCase().includes('ricarica') || (attRec.notes || '').toLowerCase().includes('recupero ore'))) {
        const b = parseFloat(attRec.balance_hours || 0);
        alreadyCounted = b > 0 ? Math.min(b, hrs) : 0;
      }
      if (hrs > alreadyCounted) manualTopUp += hrs - alreadyCounted;
    }
  }
  totalBalance += manualTopUp;

  // todayPermissionHours se non in attendance
  const todayRecord = attendance?.find((r) => r.date === today);
  const hasApprovedToday = todayRecord?.notes && (todayRecord.notes.includes('Permesso approvato') || todayRecord.notes.includes('Permesso creato'));
  let todayPerm = 0;
  if (!hasApprovedToday || !todayRecord) {
    const { data: todayPerms } = await supabase
      .from('leave_requests')
      .select('hours')
      .eq('user_id', userId)
      .eq('type', 'permission')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today);
    if (todayPerms && todayPerms.length > 0) {
      todayPerm = todayPerms.reduce((s, p) => s + parseFloat(p.hours || 0), 0);
    }
  }
  totalBalance -= todayPerm;

  const roundedBalance = Math.round(totalBalance * 100) / 100;
  const capped = capLedgerValue(roundedBalance);

  console.log(`\n💰 Saldo calcolato (attendance + ledger): ${roundedBalance.toFixed(2)}h`);

  // 3. Aggiorna current_balances
  const { data: existing } = await supabase
    .from('current_balances')
    .select('id, current_balance, total_accrued')
    .eq('user_id', userId)
    .eq('category', 'overtime')
    .eq('year', CURRENT_YEAR)
    .single();

  const upsertData = {
    user_id: userId,
    category: 'overtime',
    year: CURRENT_YEAR,
    current_balance: capped,
    total_accrued: existing?.total_accrued ?? capped,
    updated_at: new Date().toISOString()
  };

  const { error: upsertErr } = await supabase.from('current_balances').upsert(upsertData, {
    onConflict: 'user_id,category,year',
    ignoreDuplicates: false
  });

  if (upsertErr) {
    console.error('❌ Errore update current_balances:', upsertErr.message);
  } else {
    console.log(`✅ current_balances (overtime ${CURRENT_YEAR}): ${existing?.current_balance ?? 'N/A'}h → ${capped}h`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Fine. Ore manuali azzerate, current_balances corretto.');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
