require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAlessiaSaturdaySchedule() {
  try {
    console.log('🔍 Cercando Alessia Pasqui...');
    
    // Trova l'utente Alessia Pasqui
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .ilike('email', '%alessia.pasqui%');
    
    if (userError) {
      console.error('❌ Errore nel cercare l\'utente:', userError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.error('❌ Utente Alessia Pasqui non trovato');
      return;
    }
    
    const alessia = users[0];
    console.log(`✅ Trovata: ${alessia.first_name} ${alessia.last_name} (ID: ${alessia.id})`);
    
    // Trova il work_schedule per il sabato (day_of_week = 6)
    console.log('🔍 Cercando orario sabato esistente...');
    const { data: existingSchedule, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', alessia.id)
      .eq('day_of_week', 6) // Sabato
      .single();
    
    if (scheduleError && scheduleError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Errore nel cercare lo schedule:', scheduleError);
      return;
    }
    
    // Dati corretti per il sabato: solo mattina fino alle 14:00, senza pausa pranzo
    const saturdaySchedule = {
      user_id: alessia.id,
      day_of_week: 6, // Sabato
      is_working_day: true,
      work_type: 'morning',
      start_time: '09:00',
      end_time: '14:00',
      break_duration: 0, // Nessuna pausa pranzo
      notes: 'Sabato: solo mattina fino alle 14:00 (senza pausa pranzo)',
      updated_at: new Date().toISOString()
    };
    
    if (existingSchedule) {
      // Aggiorna lo schedule esistente
      console.log('📝 Aggiornando orario sabato esistente...');
      const { data: updated, error: updateError } = await supabase
        .from('work_schedules')
        .update(saturdaySchedule)
        .eq('id', existingSchedule.id)
        .select();
      
      if (updateError) {
        console.error('❌ Errore nell\'aggiornamento:', updateError);
        return;
      }
      
      console.log('✅ Orario sabato aggiornato con successo!');
      console.log('   Dettagli:', {
        day: 'Sabato (6)',
        is_working_day: updated[0].is_working_day,
        work_type: updated[0].work_type,
        start_time: updated[0].start_time,
        end_time: updated[0].end_time,
        break_duration: updated[0].break_duration,
        notes: updated[0].notes
      });
    } else {
      // Crea nuovo schedule
      console.log('➕ Creando nuovo orario sabato...');
      const { data: created, error: createError } = await supabase
        .from('work_schedules')
        .insert(saturdaySchedule)
        .select();
      
      if (createError) {
        console.error('❌ Errore nella creazione:', createError);
        return;
      }
      
      console.log('✅ Orario sabato creato con successo!');
      console.log('   Dettagli:', {
        day: 'Sabato (6)',
        is_working_day: created[0].is_working_day,
        work_type: created[0].work_type,
        start_time: created[0].start_time,
        end_time: created[0].end_time,
        break_duration: created[0].break_duration,
        notes: created[0].notes
      });
    }
    
    // Verifica finale: mostra tutti gli orari di Alessia
    console.log('\n📋 Orari di lavoro di Alessia Pasqui:');
    const { data: allSchedules, error: allError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', alessia.id)
      .order('day_of_week');
    
    if (!allError && allSchedules) {
      const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
      allSchedules.forEach(schedule => {
        const dayName = dayNames[schedule.day_of_week];
        if (schedule.is_working_day) {
          console.log(`   ${dayName}: ${schedule.start_time} - ${schedule.end_time} (${schedule.work_type}, pausa: ${schedule.break_duration}min)`);
        } else {
          console.log(`   ${dayName}: Non lavorativo`);
        }
      });
    }
    
    console.log('\n✅ Correzione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

// Esegui lo script
fixAlessiaSaturdaySchedule()
  .then(() => {
    console.log('\n✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore nello script:', error);
    process.exit(1);
  });

