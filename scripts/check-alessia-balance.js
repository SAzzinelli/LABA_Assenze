/**
 * Verifica ore Alessia – attendance, ledger, current_balances.
 * Calcola il saldo atteso (attendance + manual_credit) per confronto con API/UI.
 *
 * Uso: node scripts/check-alessia-balance.js
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
const today = new Date().toISOString().slice(0, 10);

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Verifica ore Alessia – attendance, ledger, current_balances');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: users } = await supabase.from('users').select('id, first_name, last_name').ilike('first_name', '%alessia%');
  if (!users?.length) {
    console.log('⚠️ Nessun utente trovato con nome Alessia.');
    return;
  }

  for (const u of users) {
    const userId = u.id;
    console.log(`👤 ${u.first_name} ${u.last_name} (id: ${userId})\n`);

    // Attendance: tutti i record fino a oggi (come API)
    const { data: attendance } = await supabase
      .from('attendance')
      .select('date, balance_hours, notes')
      .eq('user_id', userId)
      .lte('date', today)
      .order('date', { ascending: false });

    const totalAttendance = (attendance || []).reduce((s, r) => s + parseFloat(r.balance_hours || 0), 0);
    console.log('📅 ATTENDANCE (balance_hours, somma fino a oggi)');
    console.log(`   Totale: ${totalAttendance.toFixed(2)}h`);
    (attendance || []).slice(0, 8).forEach((r) => {
      console.log(`   - ${r.date}: ${r.balance_hours}h | ${(r.notes || '').slice(0, 50)}`);
    });
    if ((attendance || []).length > 8) console.log(`   ... e altri ${attendance.length - 8} record\n`);
    else console.log('');

    // Ledger: manual_credit (TUTTI)
    const { data: ledger } = await supabase
      .from('hours_ledger')
      .select('id, transaction_date, hours, hours_amount, description, created_at')
      .eq('user_id', userId)
      .eq('reference_type', 'manual_credit')
      .eq('transaction_type', 'accrual')
      .order('transaction_date', { ascending: false });

    const ledgerEntries = ledger || [];
    const totalLedger = ledgerEntries.reduce((s, l) => s + parseFloat(l.hours ?? l.hours_amount ?? 0), 0);

    console.log('📒 HOURS_LEDGER (manual_credit, accrual)');
    console.log(`   Movimenti: ${ledgerEntries.length}`);
    console.log(`   Somma ore: +${totalLedger.toFixed(2)}h`);
    ledgerEntries.forEach((l, i) => {
      const hrs = parseFloat(l.hours ?? l.hours_amount ?? 0);
      console.log(`   ${i + 1}. ${l.transaction_date} +${hrs}h | ${(l.description || '').slice(0, 60)}`);
    });
    console.log('');

    // Calcolo saldo atteso (logica API: attendance + manualCreditTopUp)
    let manualTopUp = 0;
    for (const row of ledgerEntries) {
      const ledgerHours = parseFloat(row.hours ?? row.hours_amount ?? 0);
      const attRec = attendance?.find((a) => a.date === row.transaction_date);
      let alreadyCounted = 0;
      if (attRec && ((attRec.notes || '').toLowerCase().includes('ricarica') || (attRec.notes || '').toLowerCase().includes('recupero ore'))) {
        const bal = parseFloat(attRec.balance_hours || 0);
        alreadyCounted = bal > 0 ? Math.min(bal, ledgerHours) : 0;
      }
      if (ledgerHours > alreadyCounted) manualTopUp += ledgerHours - alreadyCounted;
    }

    const saldoCalcolato = totalAttendance + manualTopUp;
    console.log('💰 SALDO CALCOLATO (come API total-balance)');
    console.log(`   Attendance: ${totalAttendance.toFixed(2)}h`);
    console.log(`   + manual_credit da ledger: +${manualTopUp.toFixed(2)}h`);
    console.log(`   = ${saldoCalcolato.toFixed(2)}h\n`);

    // Current_balances
    const { data: cb } = await supabase
      .from('current_balances')
      .select('year, current_balance, total_accrued, updated_at')
      .eq('user_id', userId)
      .eq('category', 'overtime')
      .eq('year', new Date().getFullYear())
      .single();

    console.log('💵 CURRENT_BALANCES (overtime)');
    if (cb) console.log(`   current_balance: ${cb.current_balance}h | total_accrued: ${cb.total_accrued}h`);
    else console.log('   (nessuna riga)');

    if (ledgerEntries.length > 1 && totalLedger === 16) {
      console.log('\n⚠️ TROVATI 2 movimenti da +8h = 16h totali. Probabile doppia aggiunta.');
    }

    console.log('\n═══════════════════════════════════════════════════════════');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
