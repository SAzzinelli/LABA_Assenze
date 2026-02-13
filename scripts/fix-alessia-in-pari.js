/**
 * Imposta Alessia in pari (saldo 0).
 * - Record 2026-02-07: balance_hours = 0
 * - current_balances overtime 2026: 0
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const ALESSIA_ID = '3289f556-a964-49d9-af7c-718cb82f3533';
const TODAY = '2026-02-07';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: rec } = await supabase
    .from('attendance')
    .select('id, date, balance_hours')
    .eq('user_id', ALESSIA_ID)
    .eq('date', TODAY)
    .single();

  if (!rec) {
    console.log('Nessun record attendance per', TODAY);
    return;
  }

  const { error: e1 } = await supabase
    .from('attendance')
    .update({ balance_hours: 0 })
    .eq('id', rec.id);

  if (e1) {
    console.error('Errore attendance:', e1.message);
    return;
  }
  console.log(`✅ ${TODAY}: balance_hours ${rec.balance_hours} → 0`);

  const { data: cb } = await supabase.from('current_balances').select('total_accrued').eq('user_id', ALESSIA_ID).eq('category', 'overtime').eq('year', 2026).single();
  const { error: e2 } = await supabase
    .from('current_balances')
    .upsert({
      user_id: ALESSIA_ID,
      category: 'overtime',
      year: 2026,
      current_balance: 0,
      total_accrued: cb?.total_accrued ?? 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,category,year' });

  if (e2) console.error('Errore current_balances:', e2.message);
  else console.log('✅ current_balances overtime 2026 → 0');
}

main().catch(console.error);
