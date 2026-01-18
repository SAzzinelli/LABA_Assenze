/**
 * Script per impostare gli orari di lavoro corretti per tutti i dipendenti
 * 
 * IMPORTANTE: Questo script NON deve essere eseguito automaticamente durante il deploy.
 * Gli orari devono essere impostati manualmente solo quando necessario.
 * 
 * Uso: node scripts/set-work-schedules.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

// Accetta credenziali da variabili d'ambiente o da argomenti della command line
const supabaseUrl = process.env.SUPABASE_URL || process.argv[2];
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.argv[3];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRORE: Le variabili SUPABASE_URL e SUPABASE_SERVICE_KEY devono essere impostate');
  console.error('   Opzione 1: Crea un file .env con:');
  console.error('     SUPABASE_URL=...');
  console.error('     SUPABASE_SERVICE_KEY=...');
  console.error('   Opzione 2: Passa le credenziali come argomenti:');
  console.error('     node scripts/set-work-schedules.js <SUPABASE_URL> <SUPABASE_SERVICE_KEY>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configurazione orari per dipendente
const schedules = {
  // ORARI DEFAULT: Tutti 9-18 Lun-Ven con pausa 13-14
  default: [
    { day_of_week: 1, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Lunedì
    { day_of_week: 2, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Martedì
    { day_of_week: 3, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Mercoledì
    { day_of_week: 4, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Giovedì
    { day_of_week: 5, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Venerdì
    { day_of_week: 6, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null }, // Sabato
    { day_of_week: 0, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null }  // Domenica
  ],

  // GLORIA: Entra alle 10, pausa 14-15, esce alle 19
  'gloria.wan@labafirenze.com': [
    { day_of_week: 1, is_working_day: true, work_type: 'full_day', start_time: '10:00', end_time: '19:00', break_duration: 60, break_start_time: '14:00' },
    { day_of_week: 2, is_working_day: true, work_type: 'full_day', start_time: '10:00', end_time: '19:00', break_duration: 60, break_start_time: '14:00' },
    { day_of_week: 3, is_working_day: true, work_type: 'full_day', start_time: '10:00', end_time: '19:00', break_duration: 60, break_start_time: '14:00' },
    { day_of_week: 4, is_working_day: true, work_type: 'full_day', start_time: '10:00', end_time: '19:00', break_duration: 60, break_start_time: '14:00' },
    { day_of_week: 5, is_working_day: true, work_type: 'full_day', start_time: '10:00', end_time: '19:00', break_duration: 60, break_start_time: '14:00' },
    { day_of_week: 6, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null },
    { day_of_week: 0, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null }
  ],

  // ALESSIA: Lun-Ven 9-17 con pausa 13-14, Sabato 9-13 senza pausa
  'alessia.pasqui@labafirenze.com': [
    { day_of_week: 1, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '17:00', break_duration: 60, break_start_time: '13:00' },
    { day_of_week: 2, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '17:00', break_duration: 60, break_start_time: '13:00' },
    { day_of_week: 3, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '17:00', break_duration: 60, break_start_time: '13:00' },
    { day_of_week: 4, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '17:00', break_duration: 60, break_start_time: '13:00' },
    { day_of_week: 5, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '17:00', break_duration: 60, break_start_time: '13:00' },
    { day_of_week: 6, is_working_day: true, work_type: 'morning', start_time: '09:00', end_time: '13:00', break_duration: 0, break_start_time: null }, // Sabato senza pausa
    { day_of_week: 0, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null }
  ],

  // SILVIA NARDI-DEI: Lun e Gio 9-18 con pausa 13-14, Mar-Mer-Ven 9-13 senza pausa
  'silvia.nardidei@labafirenze.com': [
    { day_of_week: 1, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Lunedì
    { day_of_week: 2, is_working_day: true, work_type: 'morning', start_time: '09:00', end_time: '13:00', break_duration: 0, break_start_time: null }, // Martedì
    { day_of_week: 3, is_working_day: true, work_type: 'morning', start_time: '09:00', end_time: '13:00', break_duration: 0, break_start_time: null }, // Mercoledì
    { day_of_week: 4, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Giovedì
    { day_of_week: 5, is_working_day: true, work_type: 'morning', start_time: '09:00', end_time: '13:00', break_duration: 0, break_start_time: null }, // Venerdì
    { day_of_week: 6, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null },
    { day_of_week: 0, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null }
  ],

  // ILARIA: Lunedì 9-13, Martedì 10-18, Mercoledì 10-18, Giovedì 9-13, Venerdì 9.30-12.30
  'ilaria.spallarossa@labafirenze.com': [
    { day_of_week: 1, is_working_day: true, work_type: 'morning', start_time: '09:00', end_time: '13:00', break_duration: 0, break_start_time: null }, // Lunedì
    { day_of_week: 2, is_working_day: true, work_type: 'full_day', start_time: '10:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Martedì
    { day_of_week: 3, is_working_day: true, work_type: 'full_day', start_time: '10:00', end_time: '18:00', break_duration: 60, break_start_time: '13:00' }, // Mercoledì
    { day_of_week: 4, is_working_day: true, work_type: 'morning', start_time: '09:00', end_time: '13:00', break_duration: 0, break_start_time: null }, // Giovedì
    { day_of_week: 5, is_working_day: true, work_type: 'morning', start_time: '09:30', end_time: '12:30', break_duration: 0, break_start_time: null }, // Venerdì
    { day_of_week: 6, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null },
    { day_of_week: 0, is_working_day: false, work_type: null, start_time: null, end_time: null, break_duration: 0, break_start_time: null }
  ]
};

async function setWorkSchedules() {
  try {
    console.log('🚀 Inizio impostazione orari di lavoro...\n');

    // Recupera tutti i dipendenti attivi
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('role', 'employee')
      .eq('is_active', true);

    if (employeesError) {
      console.error('❌ Errore nel recupero dipendenti:', employeesError);
      process.exit(1);
    }

    if (!employees || employees.length === 0) {
      console.log('⚠️ Nessun dipendente trovato');
      process.exit(0);
    }

    console.log(`📋 Trovati ${employees.length} dipendenti attivi\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const employee of employees) {
      const email = employee.email.toLowerCase();
      const employeeSchedule = schedules[email] || schedules.default;

      console.log(`👤 ${employee.first_name} ${employee.last_name} (${email})`);

      // Elimina gli orari esistenti per questo dipendente
      const { error: deleteError } = await supabase
        .from('work_schedules')
        .delete()
        .eq('user_id', employee.id);

      if (deleteError) {
        console.error(`   ❌ Errore eliminazione orari esistenti:`, deleteError);
        errorCount++;
        continue;
      }

      // Aggiungi user_id a ogni schedule
      const schedulesToInsert = employeeSchedule.map(schedule => ({
        ...schedule,
        user_id: employee.id
      }));

      // Inserisci i nuovi orari
      const { error: insertError } = await supabase
        .from('work_schedules')
        .insert(schedulesToInsert);

      if (insertError) {
        console.error(`   ❌ Errore inserimento orari:`, insertError);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Orari impostati correttamente`);
      successCount++;
    }

    console.log(`\n📊 Riepilogo:`);
    console.log(`   ✅ Successi: ${successCount}`);
    console.log(`   ❌ Errori: ${errorCount}`);
    console.log(`\n✅ Impostazione orari completata!`);

  } catch (error) {
    console.error('❌ Errore generale:', error);
    process.exit(1);
  }
}

// Esegui lo script
setWorkSchedules();
