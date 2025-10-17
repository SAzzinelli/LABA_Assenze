const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tdvckcvfgdwuonqeqhux.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmNrY3ZmZ2R3dW9ucWVxaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzgzNjk4OCwiZXhwIjoyMDQ5NDEyOTg4fQ.JNAsgcPa87lG0nZsrH_VCIP2OW1VD7D9h5IqqRjVOeE'
);

(async () => {
  console.log('🔄 Azzeramento banca ore in corso...\n');
  
  // Step 1: Mostra saldo attuale
  console.log('📊 Saldo PRIMA dell\'azzeramento:');
  const { data: before } = await supabase
    .from('attendance')
    .select('user_id, balance_hours')
    .lt('date', '2025-10-01');
  
  if (before && before.length > 0) {
    const totals = {};
    before.forEach(r => {
      totals[r.user_id] = (totals[r.user_id] || 0) + (r.balance_hours || 0);
    });
    
    console.log(`   Record totali prima di ottobre: ${before.length}`);
    Object.entries(totals).forEach(([userId, total]) => {
      console.log(`   User ${userId}: ${total}h`);
    });
  } else {
    console.log('   ✅ Nessun record trovato prima di ottobre!');
    console.log('   I -2.5h potrebbero essere un bug di visualizzazione.');
    process.exit(0);
  }
  
  // Step 2: Azzera
  console.log('\n🔧 Azzeramento in corso...');
  const { error } = await supabase
    .from('attendance')
    .update({ balance_hours: 0 })
    .lt('date', '2025-10-01');
  
  if (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
  
  console.log('✅ Azzeramento completato!\n');
  
  // Step 3: Verifica
  console.log('📊 Saldo DOPO l\'azzeramento:');
  const { data: after } = await supabase
    .from('attendance')
    .select('balance_hours');
  
  if (after) {
    const totalAfter = after.reduce((sum, r) => sum + (r.balance_hours || 0), 0);
    console.log(`   Saldo totale sistema: ${totalAfter}h`);
  }
  
  console.log('\n✅ Operazione completata con successo!');
  console.log('💡 Ricarica la pagina web per vedere i nuovi valori.');
})();

