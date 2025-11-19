// Script per correggere gli orari di pausa pranzo di Silvia Consorti
// Da 12:30-13:30 a 13:30-14:30

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqGhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSilviaLunchBreak() {
  try {
    console.log('🔍 Cercando Silvia Consorti...');
    
    // Trova Silvia Consorti
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .ilike('first_name', 'Silvia')
      .ilike('last_name', 'Consorti');
    
    if (userError) {
      console.error('❌ Errore nel recupero utente:', userError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.log('❌ Silvia Consorti non trovata nel database');
      return;
    }
    
    const silvia = users[0];
    console.log(`✅ Trovata: ${silvia.first_name} ${silvia.last_name} (ID: ${silvia.id})`);
    
    // Recupera i work_schedules di Silvia
    const { data: schedules, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('id, day_of_week, break_start_time, break_duration')
      .eq('user_id', silvia.id)
      .eq('is_working_day', true);
    
    if (scheduleError) {
      console.error('❌ Errore nel recupero schedules:', scheduleError);
      return;
    }
    
    console.log(`📋 Trovati ${schedules.length} orari di lavoro`);
    console.log('Orari attuali:');
    schedules.forEach(s => {
      console.log(`  Giorno ${s.day_of_week}: pausa ${s.break_start_time || 'non impostata'} (durata: ${s.break_duration}min)`);
    });
    
    // Aggiorna tutti i giorni lavorativi con break_start_time = '13:30'
    const { data: updated, error: updateError } = await supabase
      .from('work_schedules')
      .update({ break_start_time: '13:30' })
      .eq('user_id', silvia.id)
      .eq('is_working_day', true)
      .select();
    
    if (updateError) {
      console.error('❌ Errore nell\'aggiornamento:', updateError);
      return;
    }
    
    console.log(`✅ Aggiornati ${updated.length} orari di lavoro`);
    console.log('Nuovi orari:');
    updated.forEach(s => {
      const breakEnd = s.break_start_time ? (() => {
        const [hour, min] = s.break_start_time.split(':').map(Number);
        const endMin = min + (s.break_duration || 60);
        const endHour = hour + Math.floor(endMin / 60);
        const endMinFinal = endMin % 60;
        return `${String(endHour).padStart(2, '0')}:${String(endMinFinal).padStart(2, '0')}`;
      })() : 'non calcolabile';
      console.log(`  Giorno ${s.day_of_week}: pausa ${s.break_start_time} - ${breakEnd} (durata: ${s.break_duration}min)`);
    });
    
    console.log('✅ Correzione completata!');
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

fixSilviaLunchBreak();


