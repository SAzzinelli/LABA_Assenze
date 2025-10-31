/**
 * Script per correggere i balance_hours storici nel database
 * Ricalcola actual_hours, expected_hours e balance_hours per tutti i record di attendance
 * usando la logica corretta della pausa pranzo
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

function calculateExpectedHoursForSchedule(schedule) {
  if (!schedule || !schedule.start_time || !schedule.end_time) return 0;
  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  const breakDuration = schedule.break_duration || 60; // minutes
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const workMinutes = totalMinutes - breakDuration;
  return workMinutes / 60;
}

async function fixHistoricalBalance() {
  try {
    console.log('🔧 Inizio correzione balance storici...');
    
    // Ottieni tutti gli utenti
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name');
    
    if (usersError) {
      console.error('❌ Errore nel recupero utenti:', usersError);
      return;
    }
    
    console.log(`📊 Trovati ${users.length} utenti`);
    
    let totalFixed = 0;
    let totalErrors = 0;
    
    for (const user of users) {
      console.log(`\n👤 Elaborazione ${user.first_name} ${user.last_name} (${user.id})...`);
      
      // Ottieni tutti i record di attendance per questo utente
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('id, date, actual_hours, expected_hours, balance_hours, user_id')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      
      if (attError) {
        console.error(`❌ Errore nel recupero attendance per ${user.first_name}:`, attError);
        totalErrors++;
        continue;
      }
      
      if (!attendance || attendance.length === 0) {
        console.log(`  ⏭️ Nessun record di attendance trovato`);
        continue;
      }
      
      // Ottieni i work schedules per questo utente
      const { data: schedules, error: schedError } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('user_id', user.id);
      
      if (schedError) {
        console.error(`❌ Errore nel recupero schedules per ${user.first_name}:`, schedError);
        totalErrors++;
        continue;
      }
      
      let userFixed = 0;
      
      for (const record of attendance) {
        const recordDate = new Date(record.date);
        const dayOfWeek = recordDate.getDay();
        
        // Trova lo schedule per questo giorno
        const schedule = schedules?.find(s => s.day_of_week === dayOfWeek && s.is_working_day);
        
        if (!schedule) {
          // Giorno non lavorativo, salta o imposta a 0
          if (record.actual_hours !== 0 || record.expected_hours !== 0) {
            const { error: updateError } = await supabase
              .from('attendance')
              .update({
                actual_hours: 0,
                expected_hours: 0,
                balance_hours: 0
              })
              .eq('id', record.id);
            
            if (!updateError) {
              userFixed++;
              console.log(`  ✅ ${record.date}: corretto (non lavorativo)`);
            }
          }
          continue;
        }
        
        // Ricalcola expected_hours usando la logica corretta
        const expectedHours = calculateExpectedHoursForSchedule({
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          break_duration: schedule.break_duration
        });
        
        // Per i giorni passati, verifica se actual_hours include la pausa pranzo
        // Se actual_hours è ~9h invece di ~8h per un giorno 9:00-18:00, significa che include la pausa
        let actualHours = record.actual_hours || 0;
        
        // Se actual_hours è maggiore di expected_hours + 1h, probabilmente include la pausa pranzo
        // Correggilo sottraendo 1h (o break_duration)
        if (actualHours > expectedHours + 0.9 && actualHours <= expectedHours + 1.5) {
          console.log(`  ⚠️ ${record.date}: actual_hours=${actualHours}h sembra includere pausa pranzo, correggo...`);
          actualHours = actualHours - (schedule.break_duration || 60) / 60;
          actualHours = Math.max(0, actualHours); // Non può essere negativo
        }
        
        // Se actual_hours è 0 ma dovrebbe essere un giorno lavorativo, imposta alle ore attese
        // (presumendo che sia stato lavorato l'intero giorno)
        if (actualHours === 0 && expectedHours > 0) {
          actualHours = expectedHours;
        }
        
        // Ricalcola balance_hours
        const balanceHours = actualHours - expectedHours;
        
        // Aggiorna sempre per assicurarsi che expected_hours sia corretto
        const expectedChanged = Math.abs((record.expected_hours || 0) - expectedHours) > 0.01;
        const actualChanged = Math.abs((record.actual_hours || 0) - actualHours) > 0.01;
        const balanceChanged = Math.abs((record.balance_hours || 0) - balanceHours) > 0.01;
        
        if (expectedChanged || actualChanged || balanceChanged) {
          const { error: updateError } = await supabase
            .from('attendance')
            .update({
              expected_hours: Math.round(expectedHours * 10) / 10,
              actual_hours: Math.round(actualHours * 10) / 10,
              balance_hours: Math.round(balanceHours * 10) / 10
            })
            .eq('id', record.id);
          
          if (updateError) {
            console.error(`  ❌ Errore aggiornamento ${record.date}:`, updateError);
            totalErrors++;
          } else {
            userFixed++;
            console.log(`  ✅ ${record.date}: expected=${expectedHours.toFixed(1)}h, actual=${actualHours.toFixed(1)}h, balance=${balanceHours.toFixed(1)}h`);
          }
        }
      }
      
      console.log(`  📊 Corretti ${userFixed} record per ${user.first_name} ${user.last_name}`);
      totalFixed += userFixed;
    }
    
    console.log(`\n✅ Correzione completata!`);
    console.log(`📊 Totale record corretti: ${totalFixed}`);
    console.log(`❌ Totale errori: ${totalErrors}`);
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

// Esegui lo script
fixHistoricalBalance()
  .then(() => {
    console.log('\n🏁 Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore fatale:', error);
    process.exit(1);
  });

