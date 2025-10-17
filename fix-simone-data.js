const { createClient } = require('@supabase/supabase-js');

// Usa le variabili d'ambiente di Railway
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variabili Supabase non trovate');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSimoneData() {
  console.log('🔍 Controllo e correzione dati Simone...');
  
  try {
    // Trova Simone
    const { data: simone, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('first_name', 'Simone')
      .eq('last_name', 'Azzinelli')
      .single();
      
    if (userError) {
      console.error('❌ Errore nel trovare Simone:', userError);
      return;
    }
    
    console.log('👤 Simone trovato:', simone);
    
    // Controlla tutte le presenze di Simone
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', simone.id)
      .order('date', { ascending: false });
      
    if (attError) {
      console.error('❌ Errore nel recuperare presenze:', attError);
      return;
    }
    
    console.log('📊 Presenze Simone trovate:', attendance.length);
    
    // Mostra i dati attuali
    attendance.forEach(record => {
      console.log(`📅 ${record.date}: ${record.actual_hours}h/${record.expected_hours}h, Balance: ${record.balance_hours}h`);
    });
    
    // Calcola saldo totale attuale
    const totalBalance = attendance.reduce((sum, record) => sum + (record.balance_hours || 0), 0);
    console.log('💰 Saldo totale attuale Simone:', totalBalance, 'h');
    
    if (totalBalance !== 0) {
      console.log('🔧 Correggo i dati di Simone...');
      
      // Per ogni record, correggo il balance_hours a 0
      for (const record of attendance) {
        const correctedBalance = 0;
        const correctedActualHours = record.expected_hours; // Assume che abbia lavorato le ore complete
        
        console.log(`🔧 Correggo ${record.date}: ${record.balance_hours}h → ${correctedBalance}h`);
        
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            balance_hours: correctedBalance,
            actual_hours: correctedActualHours
          })
          .eq('id', record.id);
          
        if (updateError) {
          console.error(`❌ Errore nell'aggiornare ${record.date}:`, updateError);
        } else {
          console.log(`✅ Corretto ${record.date}`);
        }
      }
      
      console.log('🎉 Correzione completata! Simone ora ha saldo 0h');
    } else {
      console.log('✅ Simone ha già saldo 0h, nessuna correzione necessaria');
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

fixSimoneData();
