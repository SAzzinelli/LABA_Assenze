const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOctober6() {
  try {
    console.log('🔍 Controllo dati del 6 ottobre 2025...');

    const { data: october6Data, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', '2025-10-06');

    if (fetchError) {
      console.error('❌ Errore:', fetchError);
      return;
    }

    if (october6Data.length === 0) {
      console.log('✅ Nessun record trovato.');
      return;
    }

    console.log('📋 Dati ATTUALI del 6 ottobre:');
    october6Data.forEach(record => {
      console.log(`   Ore Attese: ${record.expected_hours}h`);
      console.log(`   Ore Effettive: ${record.actual_hours}h ❌ (SBAGLIATO)`);
      console.log(`   Ore Mancanti: ${record.balance_hours}h ❌ (SBAGLIATO)`);
    });

    console.log('\n🔧 CORREZIONE:');
    console.log('   Ore Attese: 8h ✅');
    console.log('   Ore Effettive: 8h ✅ (giornata completa)');
    console.log('   Ore Mancanti: 0h ✅ (nessun deficit)');
    console.log('   Status: completed');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('\n⚠️  Vuoi correggere i dati del 6 ottobre? (sì/no): ', async (answer) => {
      if (answer.toLowerCase() === 'sì' || answer.toLowerCase() === 'si') {
        console.log('🔧 Correzione in corso...');
        
        const correctedData = {
          actual_hours: 8,
          expected_hours: 8,
          balance_hours: 0,
          notes: 'Corretto manualmente - giornata lavorativa completa'
        };

        const { error: updateError } = await supabase
          .from('attendance')
          .update(correctedData)
          .eq('date', '2025-10-06');

        if (updateError) {
          console.error('❌ Errore durante la correzione:', updateError);
        } else {
          console.log('✅ Dati del 6 ottobre corretti con successo!');
          console.log('   Ore Effettive: 8h ✅');
          console.log('   Ore Mancanti: 0h ✅');
          console.log('\n🎉 Problema risolto! Aggiorna la pagina Presenze per vedere i dati corretti.');
        }
      } else {
        console.log('🚫 Correzione annullata.');
      }
      readline.close();
    });

  } catch (error) {
    console.error('💥 Errore:', error);
  }
}

fixOctober6();
