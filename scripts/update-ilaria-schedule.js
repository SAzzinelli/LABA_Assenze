/**
 * Script per aggiornare gli orari di lavoro di Ilaria Spallarossa
 * 
 * Orari corretti:
 * - LUN: 9:30 - 13:30 (no pomeriggio, no pausa) = 4h
 * - MAR: 10:00 - 13:00 / 14:00 - 18:00 (pausa 60 minuti 13-14) = 7h
 * - MER: 10:00 - 13:00 / 14:00 - 18:00 (pausa 60 minuti 13-14) = 7h
 * - GIO: 9:30 - 13:30 (no pomeriggio, no pausa) = 4h
 * - VEN: 9:30 - 12:30 (no pomeriggio, no pausa) = 3h
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY devono essere configurati nel file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateIlariaSchedule() {
  try {
    console.log('🔄 Aggiornamento orari di lavoro per Ilaria Spallarossa...');
    
    // Trova l'ID di Ilaria
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', 'ilaria.spallarossa@labafirenze.com')
      .single();
    
    if (userError || !user) {
      console.error('❌ Error: Impossibile trovare Ilaria Spallarossa nel database');
      console.error('   Error:', userError);
      return;
    }
    
    console.log(`✅ Trovata: ${user.first_name} ${user.last_name} (${user.email}) - ID: ${user.id}`);
    
    // Elimina gli orari esistenti
    const { error: deleteError } = await supabase
      .from('work_schedules')
      .delete()
      .eq('user_id', user.id);
    
    if (deleteError) {
      console.error('❌ Error eliminando orari esistenti:', deleteError);
      return;
    }
    
    console.log('✅ Orari esistenti eliminati');
    
    // Prepara i nuovi orari
    const newSchedules = [
      // LUNEDÌ (1): 9:30 - 13:30, no pausa = 4h
      {
        user_id: user.id,
        day_of_week: 1,
        is_working_day: true,
        work_type: 'morning',
        start_time: '09:30',
        end_time: '13:30',
        break_duration: 0,
        break_start_time: null
      },
      // MARTEDÌ (2): 10:00 - 13:00 / 14:00 - 18:00, pausa 60 minuti 13-14 = 7h
      {
        user_id: user.id,
        day_of_week: 2,
        is_working_day: true,
        work_type: 'full_day',
        start_time: '10:00',
        end_time: '18:00',
        break_duration: 60,
        break_start_time: '13:00'
      },
      // MERCOLEDÌ (3): 10:00 - 13:00 / 14:00 - 18:00, pausa 60 minuti 13-14 = 7h
      {
        user_id: user.id,
        day_of_week: 3,
        is_working_day: true,
        work_type: 'full_day',
        start_time: '10:00',
        end_time: '18:00',
        break_duration: 60,
        break_start_time: '13:00'
      },
      // GIOVEDÌ (4): 9:30 - 13:30, no pausa = 4h
      {
        user_id: user.id,
        day_of_week: 4,
        is_working_day: true,
        work_type: 'morning',
        start_time: '09:30',
        end_time: '13:30',
        break_duration: 0,
        break_start_time: null
      },
      // VENERDÌ (5): 9:30 - 12:30, no pausa = 3h
      {
        user_id: user.id,
        day_of_week: 5,
        is_working_day: true,
        work_type: 'morning',
        start_time: '09:30',
        end_time: '12:30',
        break_duration: 0,
        break_start_time: null
      },
      // SABATO (6): non lavorativo
      {
        user_id: user.id,
        day_of_week: 6,
        is_working_day: false,
        work_type: 'full_day',
        start_time: null,
        end_time: null,
        break_duration: 0,
        break_start_time: null
      },
      // DOMENICA (0): non lavorativo
      {
        user_id: user.id,
        day_of_week: 0,
        is_working_day: false,
        work_type: 'full_day',
        start_time: null,
        end_time: null,
        break_duration: 0,
        break_start_time: null
      }
    ];
    
    // Inserisci i nuovi orari
    const { data: insertedSchedules, error: insertError } = await supabase
      .from('work_schedules')
      .insert(newSchedules)
      .select();
    
    if (insertError) {
      console.error('❌ Error inserendo nuovi orari:', insertError);
      return;
    }
    
    console.log('✅ Orari aggiornati con successo!');
    console.log('\n📋 Riepilogo orari inseriti:');
    
    const dayNames = {
      0: 'Domenica',
      1: 'Lunedì',
      2: 'Martedì',
      3: 'Mercoledì',
      4: 'Giovedì',
      5: 'Venerdì',
      6: 'Sabato'
    };
    
    insertedSchedules.forEach(schedule => {
      if (schedule.is_working_day) {
        const dayName = dayNames[schedule.day_of_week];
        const hours = schedule.work_type === 'full_day' 
          ? `${schedule.start_time} - ${schedule.break_start_time} / ${schedule.break_start_time.split(':').map((v, i) => i === 0 ? String(parseInt(v) + 1).padStart(2, '0') : v).join(':')} - ${schedule.end_time} (pausa ${schedule.break_duration} min)`
          : `${schedule.start_time} - ${schedule.end_time} (no pausa)`;
        console.log(`   ${dayName}: ${hours}`);
      } else {
        console.log(`   ${dayNames[schedule.day_of_week]}: Non lavorativo`);
      }
    });
    
    console.log('\n✅ Aggiornamento completato!');
    
  } catch (error) {
    console.error('❌ Error durante l\'aggiornamento:', error);
  }
}

// Esegui lo script
updateIlariaSchedule()
  .then(() => {
    console.log('\n✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script fallito:', error);
    process.exit(1);
  });
