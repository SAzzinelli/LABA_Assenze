require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3QqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAlessiaWorkSchedule() {
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
    
    // Orario corretto di Alessia:
    // LUN-VEN: 09:00-13:00, pausa 13:00-14:00, poi 14:00-17:00 (totale 7h, pausa 1h)
    // SAB: 09:00-14:00 (5h, senza pausa pranzo)
    // DOM: Non lavorativo
    
    const schedules = [
      {
        day_of_week: 1, // Lunedì
        is_working_day: true,
        work_type: 'full_day',
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 60,
        break_start_time: '13:00',
        notes: 'Lunedì: 09:00-13:00, pausa 13:00-14:00, 14:00-17:00'
      },
      {
        day_of_week: 2, // Martedì
        is_working_day: true,
        work_type: 'full_day',
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 60,
        break_start_time: '13:00',
        notes: 'Martedì: 09:00-13:00, pausa 13:00-14:00, 14:00-17:00'
      },
      {
        day_of_week: 3, // Mercoledì
        is_working_day: true,
        work_type: 'full_day',
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 60,
        break_start_time: '13:00',
        notes: 'Mercoledì: 09:00-13:00, pausa 13:00-14:00, 14:00-17:00'
      },
      {
        day_of_week: 4, // Giovedì
        is_working_day: true,
        work_type: 'full_day',
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 60,
        break_start_time: '13:00',
        notes: 'Giovedì: 09:00-13:00, pausa 13:00-14:00, 14:00-17:00'
      },
      {
        day_of_week: 5, // Venerdì
        is_working_day: true,
        work_type: 'full_day',
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 60,
        break_start_time: '13:00',
        notes: 'Venerdì: 09:00-13:00, pausa 13:00-14:00, 14:00-17:00'
      },
      {
        day_of_week: 6, // Sabato
        is_working_day: true,
        work_type: 'morning',
        start_time: '09:00',
        end_time: '14:00',
        break_duration: 0,
        break_start_time: null,
        notes: 'Sabato: solo mattina 09:00-14:00 (senza pausa pranzo)'
      },
      {
        day_of_week: 0, // Domenica
        is_working_day: false,
        work_type: 'none',
        start_time: null,
        end_time: null,
        break_duration: 0,
        break_start_time: null,
        notes: 'Domenica: non lavorativo'
      }
    ];
    
    console.log('\n📝 Aggiornando orari di lavoro di Alessia...');
    
    for (const schedule of schedules) {
      // Cerca se esiste già un orario per questo giorno
      const { data: existing, error: fetchError } = await supabase
        .from('work_schedules')
        .select('id')
        .eq('user_id', alessia.id)
        .eq('day_of_week', schedule.day_of_week)
        .single();
      
      const scheduleData = {
        user_id: alessia.id,
        ...schedule,
        updated_at: new Date().toISOString()
      };
      
      if (existing) {
        // Aggiorna lo schedule esistente
        const { data: updated, error: updateError } = await supabase
          .from('work_schedules')
          .update(scheduleData)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (updateError) {
          console.error(`❌ Errore nell'aggiornamento ${schedule.day_of_week}:`, updateError);
        } else {
          const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
          console.log(`✅ ${dayNames[schedule.day_of_week]}: ${updated.start_time || 'N/A'} - ${updated.end_time || 'N/A'} (pausa: ${updated.break_duration}min)`);
        }
      } else {
        // Crea nuovo schedule
        scheduleData.created_at = new Date().toISOString();
        const { data: created, error: createError } = await supabase
          .from('work_schedules')
          .insert(scheduleData)
          .select()
          .single();
        
        if (createError) {
          console.error(`❌ Errore nella creazione ${schedule.day_of_week}:`, createError);
        } else {
          const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
          console.log(`✅ ${dayNames[schedule.day_of_week]}: ${created.start_time || 'N/A'} - ${created.end_time || 'N/A'} (pausa: ${created.break_duration}min)`);
        }
      }
    }
    
    // Verifica finale: mostra tutti gli orari
    console.log('\n📋 Orari di lavoro finali di Alessia Pasqui:');
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
          const totalHours = schedule.start_time && schedule.end_time ? 
            Math.abs(new Date(`2000-01-01T${schedule.end_time}`) - new Date(`2000-01-01T${schedule.start_time}`)) / (1000 * 60 * 60) - (schedule.break_duration || 0) / 60 : 0;
          console.log(`   ${dayName}: ${schedule.start_time} - ${schedule.end_time} (${totalHours.toFixed(1)}h, pausa: ${schedule.break_duration}min)`);
        } else {
          console.log(`   ${dayName}: Non lavorativo`);
        }
      });
      
      // Calcola ore settimanali (solo lun-ven)
      const weekdays = allSchedules.filter(s => s.day_of_week >= 1 && s.day_of_week <= 5 && s.is_working_day);
      const weeklyHours = weekdays.reduce((total, s) => {
        if (s.start_time && s.end_time) {
          const dayHours = Math.abs(new Date(`2000-01-01T${s.end_time}`) - new Date(`2000-01-01T${s.start_time}`)) / (1000 * 60 * 60) - (s.break_duration || 0) / 60;
          return total + dayHours;
        }
        return total;
      }, 0);
      
      console.log(`\n📊 Ore settimanali (Lun-Ven): ${weeklyHours.toFixed(1)}h`);
    }
    
    console.log('\n✅ Correzione completata con successo!');
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

// Esegui lo script
fixAlessiaWorkSchedule()
  .then(() => {
    console.log('\n✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore nello script:', error);
    process.exit(1);
  });

