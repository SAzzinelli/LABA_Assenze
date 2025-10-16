const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOctoberData() {
  try {
    console.log('🔍 Controllo tutti i dati di ottobre 2025...');

    // Controlliamo tutti i record di ottobre 2025
    const { data: octoberData, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', '2025-10-01')
      .lte('date', '2025-10-31')
      .order('date', { ascending: true });

    if (fetchError) {
      console.error('❌ Errore nel recupero dei dati:', fetchError);
      return;
    }

    if (octoberData.length === 0) {
      console.log('✅ Nessun record trovato per ottobre 2025.');
      return;
    }

    console.log(`📋 Trovati ${octoberData.length} record per ottobre 2025:`);
    octoberData.forEach((record, index) => {
      const date = new Date(record.date);
      const dayName = date.toLocaleDateString('it-IT', { weekday: 'long' });
      console.log(`${index + 1}. Data: ${record.date} (${dayName})`);
      console.log(`   User ID: ${record.user_id}`);
      console.log(`   Ore Attese: ${record.expected_hours}h`);
      console.log(`   Ore Effettive: ${record.actual_hours}h`);
      console.log(`   Ore Mancanti: ${record.balance_hours}h`);
      console.log(`   Status: ${record.status || 'N/A'}`);
      console.log('---');
    });

    // Controlliamo anche se ci sono record per il 7 ottobre (oggi)
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n🔍 Controllo record per oggi (${today})...`);
    
    const { data: todayData, error: todayError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today);

    if (todayError) {
      console.error('❌ Errore nel recupero dei dati di oggi:', todayError);
      return;
    }

    if (todayData.length === 0) {
      console.log('✅ Nessun record trovato per oggi nel database.');
      console.log('   Questo conferma che oggi usa il calcolo real-time.');
    } else {
      console.log('📋 Record trovato per oggi:');
      todayData.forEach((record, index) => {
        console.log(`${index + 1}. User ID: ${record.user_id}`);
        console.log(`   Ore Attese: ${record.expected_hours}h`);
        console.log(`   Ore Effettive: ${record.actual_hours}h`);
        console.log(`   Ore Mancanti: ${record.balance_hours}h`);
        console.log(`   Status: ${record.status || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('💥 Errore inaspettato:', error);
  }
}

checkOctoberData();
