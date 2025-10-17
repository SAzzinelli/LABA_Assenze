const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tdvckcvfgdwuonqeqhux.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmNrY3ZmZ2R3dW9ucWVxaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzgzNjk4OCwiZXhwIjoyMDQ5NDEyOTg4fQ.JNAsgcPa87lG0nZsrH_VCIP2OW1VD7D9h5IqqRjVOeE'
);

(async () => {
  console.log('🔍 Controllo TUTTI i balance_hours per Simone...\n');
  
  const userId = 'd67e66f4-433d-43cb-a1fe-8ee2c0564d3a';
  
  const { data, error } = await supabase
    .from('attendance')
    .select('date, balance_hours, actual_hours, expected_hours')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Totale record: ${data.length}\n`);
  
  let total = 0;
  let negativi = 0;
  
  console.log('📋 TUTTI I RECORD:\n');
  data.forEach(r => {
    const symbol = r.balance_hours < 0 ? '🔴' : r.balance_hours > 0 ? '🟢' : '⚪';
    console.log(`${symbol} ${r.date} | Balance: ${r.balance_hours}h | Actual: ${r.actual_hours}h / Expected: ${r.expected_hours}h`);
    total += r.balance_hours || 0;
    if (r.balance_hours < 0) negativi++;
  });
  
  console.log(`\n💰 Saldo TOTALE: ${total}h`);
  console.log(`🔴 Record con balance negativo: ${negativi}`);
})();

