const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupPendingRequests() {
  try {
    console.log('🧹 Avvio pulizia richieste in attesa...');
    
    // Trova tutte le richieste pending
    const { data: pendingRequests, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending');
    
    if (fetchError) {
      console.error('❌ Errore nel recupero delle richieste:', fetchError);
      return;
    }
    
    console.log(`📋 Trovate ${pendingRequests.length} richieste in attesa`);
    
    if (pendingRequests.length === 0) {
      console.log('✅ Nessuna richiesta in attesa da pulire');
      return;
    }
    
    // Mostra le richieste trovate
    pendingRequests.forEach((request, index) => {
      console.log(`${index + 1}. ID: ${request.id} - Tipo: ${request.type} - Data: ${request.start_date} - Dipendente: ${request.user_id}`);
    });
    
    // Conferma prima di eliminare
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('⚠️  Sei sicuro di voler eliminare tutte queste richieste? (sì/no): ', resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'sì' && answer.toLowerCase() !== 'si' && answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('❌ Operazione annullata');
      return;
    }
    
    // Elimina le richieste pending
    const { data: deletedRequests, error: deleteError } = await supabase
      .from('leave_requests')
      .delete()
      .eq('status', 'pending')
      .select();
    
    if (deleteError) {
      console.error('❌ Errore nell\'eliminazione delle richieste:', deleteError);
      return;
    }
    
    console.log(`✅ Eliminate ${deletedRequests.length} richieste in attesa`);
    
    // Mostra le richieste eliminate
    deletedRequests.forEach((request, index) => {
      console.log(`   ${index + 1}. ID: ${request.id} - Tipo: ${request.type} - Data: ${request.start_date}`);
    });
    
    console.log('🎉 Pulizia completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante la pulizia:', error);
  }
}

// Esegui la pulizia
cleanupPendingRequests();
