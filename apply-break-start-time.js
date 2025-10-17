// Script per applicare il campo break_start_time al database
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL o SUPABASE_SERVICE_KEY mancanti nel file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyBreakStartTime() {
  try {
    console.log('🔧 Applicazione campo break_start_time...\n');

    // 1. Aggiungi la colonna
    console.log('1️⃣ Aggiunta colonna break_start_time...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE work_schedules 
        ADD COLUMN IF NOT EXISTS break_start_time TIME DEFAULT '13:00';
      `
    });

    if (alterError) {
      console.log('⚠️ Colonna potrebbe già esistere:', alterError.message);
    } else {
      console.log('✅ Colonna break_start_time aggiunta');
    }

    // 2. Aggiorna i record esistenti
    console.log('\n2️⃣ Aggiornamento record esistenti con default 13:00...');
    const { data: updated, error: updateError } = await supabase
      .from('work_schedules')
      .update({ break_start_time: '13:00' })
      .is('break_start_time', null)
      .eq('is_working_day', true)
      .select();

    if (updateError) {
      console.error('❌ Errore aggiornamento:', updateError);
    } else {
      console.log(`✅ ${updated?.length || 0} record aggiornati con break_start_time = 13:00`);
    }

    // 3. Verifica i risultati
    console.log('\n3️⃣ Verifica orari di lavoro...');
    const { data: schedules, error: selectError } = await supabase
      .from('work_schedules')
      .select(`
        *,
        users!inner(first_name, last_name)
      `)
      .eq('is_working_day', true)
      .order('users(last_name), day_of_week');

    if (selectError) {
      console.error('❌ Errore recupero:', selectError);
    } else {
      console.log('\n📋 Orari di lavoro aggiornati:\n');
      
      const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
      
      schedules.forEach(s => {
        console.log(
          `${s.users.first_name} ${s.users.last_name} - ${days[s.day_of_week]}: ` +
          `${s.start_time}-${s.end_time}, pausa ${s.break_start_time}-${
            s.break_start_time ? 
              calculateBreakEnd(s.break_start_time, s.break_duration) : 
              'N/A'
          } (${s.break_duration}min)`
        );
      });
    }

    console.log('\n✅ Applicazione completata!');

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

function calculateBreakEnd(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

applyBreakStartTime();

