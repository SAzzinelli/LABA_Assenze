/**
 * Script per ricalcolare expected_hours e balance_hours per tutte le presenze
 * dal 7 gennaio 2026 in poi, basandosi sugli orari corretti dei dipendenti.
 * 
 * Uso: node scripts/fix-attendance-from-jan-7.js [SUPABASE_URL] [SUPABASE_SERVICE_KEY]
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
  console.error('     node scripts/fix-attendance-from-jan-7.js <SUPABASE_URL> <SUPABASE_SERVICE_KEY>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Funzione per calcolare expected_hours da uno schedule (stessa logica del server)
function calculateExpectedHoursForSchedule(schedule) {
  if (!schedule || !schedule.start_time || !schedule.end_time) return 0;
  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  const breakDuration = schedule.break_duration !== null && schedule.break_duration !== undefined ? schedule.break_duration : 0;
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const workMinutes = Math.max(totalMinutes - breakDuration, 0);
  return workMinutes / 60;
}

async function fixAttendanceFromJan7() {
  try {
    console.log('🚀 Inizio correzione presenze dal 7 gennaio 2026...\n');

    const startDate = '2026-01-07';
    
    // Recupera tutte le presenze dal 7 gennaio in poi
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance')
      .select('id, user_id, date, expected_hours, actual_hours, balance_hours')
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (attendanceError) {
      console.error('❌ Errore nel recupero presenze:', attendanceError);
      process.exit(1);
    }

    if (!attendanceRecords || attendanceRecords.length === 0) {
      console.log('⚠️ Nessuna presenza trovata dal 7 gennaio in poi');
      process.exit(0);
    }

    console.log(`📋 Trovate ${attendanceRecords.length} presenze dal 7 gennaio in poi\n`);

    // Recupera tutti i dipendenti con i loro orari
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'employee')
      .eq('is_active', true);

    if (employeesError) {
      console.error('❌ Errore nel recupero dipendenti:', employeesError);
      process.exit(1);
    }

    // Crea una mappa user_id -> orari
    const schedulesMap = {};
    for (const employee of employees) {
      const { data: schedules, error: scheduleError } = await supabase
        .from('work_schedules')
        .select('day_of_week, start_time, end_time, break_duration, is_working_day')
        .eq('user_id', employee.id);

      if (!scheduleError && schedules) {
        schedulesMap[employee.id] = {};
        schedules.forEach(s => {
          schedulesMap[employee.id][s.day_of_week] = s;
        });
      }
    }

    let fixedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Per ogni presenza, ricalcola expected_hours e balance_hours
    for (const record of attendanceRecords) {
      const date = new Date(record.date);
      const dayOfWeek = date.getDay(); // 0 = Domenica, 6 = Sabato
      
      // Trova il dipendente
      const employee = employees.find(e => e.id === record.user_id);
      if (!employee) {
        console.log(`⚠️ Dipendente non trovato per record ${record.id}`);
        skippedCount++;
        continue;
      }

      // Trova l'orario per questo giorno della settimana
      const schedule = schedulesMap[record.user_id]?.[dayOfWeek];
      
      if (!schedule || !schedule.is_working_day) {
        // Giorno non lavorativo - expected_hours dovrebbe essere 0
        const newExpectedHours = 0;
        const newBalanceHours = (record.actual_hours || 0) - newExpectedHours;
        
        if (Math.abs((record.expected_hours || 0) - newExpectedHours) > 0.01 || 
            Math.abs((record.balance_hours || 0) - newBalanceHours) > 0.01) {
          const { error: updateError } = await supabase
            .from('attendance')
            .update({
              expected_hours: newExpectedHours,
              balance_hours: newBalanceHours
            })
            .eq('id', record.id);

          if (updateError) {
            console.error(`❌ Errore aggiornamento record ${record.id}:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ ${employee.first_name} ${employee.last_name} ${record.date} (${['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][dayOfWeek]}): Giorno non lavorativo - expected: ${newExpectedHours}h, balance: ${newBalanceHours.toFixed(1)}h`);
            fixedCount++;
          }
        } else {
          skippedCount++;
        }
        continue;
      }

      // Calcola expected_hours basandosi sull'orario corretto
      const newExpectedHours = calculateExpectedHoursForSchedule(schedule);
      const newBalanceHours = (record.actual_hours || 0) - newExpectedHours;

      // Aggiorna solo se c'è una differenza significativa
      const expectedDiff = Math.abs((record.expected_hours || 0) - newExpectedHours);
      const balanceDiff = Math.abs((record.balance_hours || 0) - newBalanceHours);

      if (expectedDiff > 0.01 || balanceDiff > 0.01) {
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            expected_hours: Math.round(newExpectedHours * 10) / 10,
            balance_hours: Math.round(newBalanceHours * 10) / 10
          })
          .eq('id', record.id);

        if (updateError) {
          console.error(`❌ Errore aggiornamento record ${record.id}:`, updateError);
          errorCount++;
        } else {
          const dayName = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][dayOfWeek];
          console.log(`✅ ${employee.first_name} ${employee.last_name} ${record.date} (${dayName}): expected ${(record.expected_hours || 0).toFixed(1)}h → ${newExpectedHours.toFixed(1)}h, balance ${(record.balance_hours || 0).toFixed(1)}h → ${newBalanceHours.toFixed(1)}h`);
          fixedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`\n📊 Riepilogo:`);
    console.log(`   ✅ Corretti: ${fixedCount}`);
    console.log(`   ⏭️  Saltati (già corretti): ${skippedCount}`);
    console.log(`   ❌ Errori: ${errorCount}`);
    console.log(`\n✅ Correzione presenze completata!`);

  } catch (error) {
    console.error('❌ Errore generale:', error);
    process.exit(1);
  }
}

// Esegui lo script
fixAttendanceFromJan7();
