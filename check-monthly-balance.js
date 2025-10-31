require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBalance() {
  // Trova Simone
  const { data: users } = await supabase.from('users').select('id, first_name').ilike('first_name', 'simone');
  if (!users || users.length === 0) return;
  
  const userId = users[0].id;
  
  // Ottieni tutti i record di ottobre 2025
  const { data: attendance } = await supabase
    .from('attendance')
    .select('date, actual_hours, expected_hours, balance_hours')
    .eq('user_id', userId)
    .gte('date', '2025-10-01')
    .lte('date', '2025-10-31')
    .order('date');
  
  console.log('📊 Record ottobre 2025:');
  let totalActual = 0;
  let totalExpected = 0;
  
  attendance?.forEach(record => {
    totalActual += record.actual_hours || 0;
    totalExpected += record.expected_hours || 0;
    console.log(`${record.date}: actual=${(record.actual_hours || 0).toFixed(2)}h, expected=${(record.expected_hours || 0).toFixed(2)}h, balance=${(record.balance_hours || 0).toFixed(2)}h`);
  });
  
  const totalBalance = totalActual - totalExpected;
  console.log(`\n💰 TOTALE MENSILE:`);
  console.log(`  Actual: ${totalActual.toFixed(2)}h`);
  console.log(`  Expected: ${totalExpected.toFixed(2)}h`);
  console.log(`  Balance: ${totalBalance.toFixed(2)}h`);
}

checkBalance();
