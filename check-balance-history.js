const { createClient } = require('@supabase/supabase-js');

// Usa le credenziali direttamente (solo per questo check)
const supabase = createClient(
  'https://tdvckcvfgdwuonqeqhux.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmNrY3ZmZ2R3dW9ucWVxaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzgzNjk4OCwiZXhwIjoyMDQ5NDEyOTg4fQ.JNAsgcPa87lG0nZsrH_VCIP2OW1VD7D9h5IqqRjVOeE'
);

(async () => {
  console.log('🔍 Controllo saldo storico per Simone e Adriano...\n');
  
  const users = [
    { name: 'Simone Azzinelli', id: 'd67e66f4-433d-43cb-a1fe-8ee2c0564d3a' },
    { name: 'Adriano Toccafondi', id: '7f1179d7-6eef-4844-a70d-fefdb891c44c' }
  ];
  
  for (const user of users) {
    console.log(`\n📊 === ${user.name} ===`);
    
    // Record prima di ottobre
    const { data: beforeOct, error: beforeError } = await supabase
      .from('attendance')
      .select('date, balance_hours, actual_hours, expected_hours')
      .eq('user_id', user.id)
      .lt('date', '2025-10-01')
      .order('date', { ascending: false });
      
    if (beforeError) {
      console.error('❌ Errore:', beforeError);
      continue;
    }
    
    console.log(`\n🗓️  Record PRIMA di Ottobre 2025: ${beforeOct.length}`);
    if (beforeOct.length > 0) {
      console.log('\nUltimi 5 record:');
      beforeOct.slice(0, 5).forEach(r => {
        console.log(`  ${r.date} - Balance: ${r.balance_hours}h (${r.actual_hours}h / ${r.expected_hours}h)`);
      });
      
      const totalBefore = beforeOct.reduce((sum, r) => sum + (r.balance_hours || 0), 0);
      console.log(`\n💰 Saldo TOTALE prima di ottobre: ${totalBefore}h`);
    }
    
    // Record di ottobre
    const { data: october, error: octError } = await supabase
      .from('attendance')
      .select('date, balance_hours, actual_hours, expected_hours')
      .eq('user_id', user.id)
      .gte('date', '2025-10-01')
      .lt('date', '2025-11-01')
      .order('date', { ascending: true });
      
    if (!octError && october) {
      console.log(`\n🗓️  Record di Ottobre 2025: ${october.length}`);
      const totalOct = october.reduce((sum, r) => sum + (r.balance_hours || 0), 0);
      console.log(`💰 Saldo TOTALE di ottobre: ${totalOct}h`);
    }
    
    // Saldo totale complessivo
    const { data: allRecords, error: allError } = await supabase
      .from('attendance')
      .select('balance_hours')
      .eq('user_id', user.id);
      
    if (!allError && allRecords) {
      const totalAll = allRecords.reduce((sum, r) => sum + (r.balance_hours || 0), 0);
      console.log(`\n🏦 BANCA ORE TOTALE: ${totalAll}h`);
    }
    
    console.log('\n' + '='.repeat(50));
  }
})();

