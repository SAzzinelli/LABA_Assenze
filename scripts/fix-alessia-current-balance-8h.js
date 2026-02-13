/**
 * Corregge current_balances di Alessia a 8h (saldo reale da ledger).
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const ALESSIA_ID = '3289f556-a964-49d9-af7c-718cb82f3533';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: cb } = await supabase
    .from('current_balances')
    .select('current_balance, total_accrued')
    .eq('user_id', ALESSIA_ID)
    .eq('category', 'overtime')
    .eq('year', 2026)
    .single();

  const oldBalance = cb?.current_balance ?? 0;

  const { error } = await supabase
    .from('current_balances')
    .upsert({
      user_id: ALESSIA_ID,
      category: 'overtime',
      year: 2026,
      current_balance: 8,
      total_accrued: 8,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,category,year' });

  if (error) {
    console.error('Errore:', error.message);
  } else {
    console.log(`✅ Alessia current_balances: ${oldBalance}h → 8h`);
  }
}

main().catch(console.error);
