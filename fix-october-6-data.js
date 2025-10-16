const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOctober6Data() {
  try {
    console.log('🔍 Controllo dati del 6 ottobre...');

    // Prima vediamo cosa c'è nel database per il 6 ottobre
    const { data: october6Data, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', '2025-10-06');

    if (fetchError) {
      console.error('❌ Errore nel recupero dei dati:', fetchError);
      return;
    }

    if (october6Data.length === 0) {
      console.log('✅ Nessun record trovato per il 6 ottobre.');
      return;
    }

    console.log('📋 Dati attuali per il 6 ottobre:');
    october6Data.forEach((record, index) => {
      console.log(`${index + 1}. User ID: ${record.user_id}`);
      console.log(`   Data: ${record.date}`);
      console.log(`   Ore Attese: ${record.expected_hours}h`);
      console.log(`   Ore Effettive: ${record.actual_hours}h`);
      console.log(`   Ore Mancanti: ${record.balance_hours}h`);
      console.log(`   Status: ${record.status || 'N/A'}`);
      console.log('---');
    });

    // Recuperiamo i work schedules per capire le ore attese corrette
    const { data: workSchedules, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', october6Data[0].user_id);

    if (scheduleError) {
      console.error('❌ Errore nel recupero degli orari:', scheduleError);
      return;
    }

    console.log('📅 Work schedules trovati:');
    workSchedules.forEach(schedule => {
      console.log(`   Giorno: ${schedule.day_of_week} (${getDayName(schedule.day_of_week)})`);
      console.log(`   Orario: ${schedule.start_time} - ${schedule.end_time}`);
      console.log(`   Pausa: ${schedule.break_duration}min`);
      console.log(`   Giorno lavorativo: ${schedule.is_working_day ? 'Sì' : 'No'}`);
      console.log('---');
    });

    // Il 6 ottobre era un domenica (day_of_week = 0)
    const sundaySchedule = workSchedules.find(s => s.day_of_week === 0);
    
    if (sundaySchedule && sundaySchedule.is_working_day) {
      console.log('⚠️  Il 6 ottobre era una domenica ma è configurata come giorno lavorativo!');
      console.log('   Questo potrebbe essere il problema.');
    } else if (sundaySchedule && !sundaySchedule.is_working_day) {
      console.log('✅ Il 6 ottobre era una domenica e NON è configurata come giorno lavorativo.');
      console.log('   I dati dovrebbero essere: 0h attese, 0h effettive, 0h mancanti.');
    } else {
      console.log('❌ Nessun orario configurato per la domenica.');
    }

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('🔧 Vuoi correggere i dati del 6 ottobre? (sì/no): ', async (answer) => {
      if (answer.toLowerCase() === 'sì' || answer.toLowerCase() === 'si') {
        console.log('🔧 Correzione in corso...');
        
        // Correggiamo i dati per il 6 ottobre
        const correctedData = {
          actual_hours: 0,
          expected_hours: 0,
          balance_hours: 0,
          status: 'non_working_day'
        };

        const { error: updateError } = await supabase
          .from('attendance')
          .update(correctedData)
          .eq('date', '2025-10-06');

        if (updateError) {
          console.error('❌ Errore durante la correzione:', updateError);
        } else {
          console.log('✅ Dati del 6 ottobre corretti con successo!');
          console.log('   Ore Attese: 0h');
          console.log('   Ore Effettive: 0h');
          console.log('   Ore Mancanti: 0h');
          console.log('   Status: non_working_day');
        }
      } else {
        console.log('🚫 Correzione annullata.');
      }
      readline.close();
    });

  } catch (error) {
    console.error('💥 Errore inaspettato:', error);
  }
}

function getDayName(dayOfWeek) {
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  return days[dayOfWeek];
}

fixOctober6Data();
