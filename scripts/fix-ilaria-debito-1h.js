/**
 * Corregge il debito di Ilaria Spallarossa: da 4h a 3h.
 * Aggiunge +1h in ledger (correzione per 1h calcolata in + per sbaglio in passato).
 *
 * Uso: node scripts/fix-ilaria-debito-1h.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const ILARIA_ID = '4d3535c6-76bd-4027-9b03-39bc7a2b6177';
const TODAY = new Date().toISOString().slice(0, 10);
const CORRECTION_HOURS = 1;
const REASON = 'Correzione: 1h calcolata in eccesso per sbaglio in passato';

function capLedgerValue(v) {
  const n = parseFloat(v) || 0;
  return Math.min(9999.99, Math.max(-9999.99, n));
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const year = new Date().getFullYear();

  const { data: cb } = await supabase
    .from('current_balances')
    .select('current_balance, total_accrued')
    .eq('user_id', ILARIA_ID)
    .eq('category', 'overtime')
    .eq('year', year)
    .single();

  const currentBalance = cb?.current_balance ?? 0;
  const newBalance = capLedgerValue(currentBalance + CORRECTION_HOURS);

  const { error: ledgerErr } = await supabase.from('hours_ledger').insert({
    user_id: ILARIA_ID,
    transaction_date: TODAY,
    transaction_type: 'accrual',
    category: 'overtime',
    hours: CORRECTION_HOURS,
    hours_amount: CORRECTION_HOURS,
    description: REASON,
    notes: REASON,
    reason: REASON,
    reference_type: 'manual_credit',
    period_year: year,
    period_month: new Date().getMonth() + 1,
    running_balance: newBalance
  });

  if (ledgerErr) {
    console.error('❌ Errore hours_ledger:', ledgerErr.message);
    return;
  }

  const totalAccrued = (cb?.total_accrued ?? 0) + CORRECTION_HOURS;
  const { error: cbErr } = await supabase
    .from('current_balances')
    .upsert({
      user_id: ILARIA_ID,
      category: 'overtime',
      year,
      current_balance: newBalance,
      total_accrued: capLedgerValue(totalAccrued),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,category,year' });

  if (cbErr) {
    console.error('❌ Errore current_balances:', cbErr.message);
  } else {
    console.log(`✅ Ilaria Spallarossa: debito ${currentBalance}h → ${newBalance}h (+${CORRECTION_HOURS}h correzione)`);
  }
}

main().catch(console.error);
