const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateTodayAttendance() {
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay(); // 0=domenica, 1=lunedì, etc.
  
  console.log(`📅 Generazione presenze per ${today} (giorno: ${dayOfWeek})...`);

  try {
    // Ottieni tutti i dipendenti attivi con i loro orari di lavoro per oggi
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        email,
        work_schedules!inner(
          day_of_week,
          is_working_day,
          start_time,
          end_time,
          break_duration
        )
      `)
      .eq('is_active', true)
      .eq('role', 'employee')
      .eq('work_schedules.day_of_week', dayOfWeek)
      .eq('work_schedules.is_working_day', true);

    if (employeesError) {
      console.error('❌ Errore nel recupero dipendenti:', employeesError);
      return;
    }

    if (!employees || employees.length === 0) {
      console.log('👥 Nessun dipendente con orario di lavoro per oggi');
      return;
    }

    console.log(`👥 Trovati ${employees.length} dipendenti con orario per oggi`);

    // Per ogni dipendente, genera la presenza automatica
    for (const employee of employees) {
      const schedule = employee.work_schedules[0];
      console.log(`   👤 ${employee.first_name} ${employee.last_name}: ${schedule.start_time}-${schedule.end_time}`);

      // Verifica se esiste già una presenza per oggi
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', employee.id)
        .eq('date', today)
        .single();

      if (existingAttendance) {
        console.log(`   ⏭️ Presenza già esistente per ${employee.first_name} ${employee.last_name}`);
        continue;
      }

      // Crea la presenza automatica
      const { data: newAttendance, error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          user_id: employee.id,
          date: today,
          notes: `Presenza automatica per orario ${schedule.start_time}-${schedule.end_time}`
        })
        .select()
        .single();

      if (attendanceError) {
        console.error(`❌ Errore creazione presenza per ${employee.first_name}:`, attendanceError);
        continue;
      }

      console.log(`   ✅ Presenza creata per ${employee.first_name} ${employee.last_name}`);
    }

    console.log('✅ Presenze automatiche generate con successo');
  } catch (error) {
    console.error('❌ Errore nella generazione presenze automatiche:', error);
  }
}

generateTodayAttendance();
