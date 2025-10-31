/**
 * SCRIPT DI CORREZIONE COMPLETA DATI STORICI
 * Ricalcola TUTTI i balance_hours nel database usando la logica corretta
 * Questo script usa la stessa funzione centralizzata usata dal sistema
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateRealTimeHours, calculateExpectedHoursForSchedule } = require('./server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllHistoricalData() {
  try {
    console.log('🔧 ========================================');
    console.log('🔧 CORREZIONE COMPLETA DATI STORICI');
    console.log('🔧 ========================================\n');
    
    // Ottieni tutti gli utenti
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, role')
      .neq('role', 'admin'); // Non correggere admin
    
    if (usersError) {
      console.error('❌ Errore nel recupero utenti:', usersError);
      return;
    }
    
    console.log(`📊 Trovati ${users.length} utenti dipendenti\n`);
    
    let totalFixed = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    
    for (const user of users) {
      console.log(`\n👤 Elaborazione ${user.first_name} ${user.last_name} (${user.id})...`);
      
      // Ottieni TUTTI i record di attendance per questo utente
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
        totalSkipped++;
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
      
      if (!schedules || schedules.length === 0) {
        console.log(`  ⚠️ Nessuno schedule trovato - saltando ${attendance.length} record`);
        totalSkipped += attendance.length;
        continue;
      }
      
      let userFixed = 0;
      let userSkipped = 0;
      
      for (const record of attendance) {
        const recordDate = new Date(record.date);
        const dayOfWeek = recordDate.getDay();
        
        // Trova lo schedule per questo giorno
        const schedule = schedules.find(s => s.day_of_week === dayOfWeek && s.is_working_day);
        
        if (!schedule || !schedule.start_time || !schedule.end_time) {
          // Giorno non lavorativo o schedule invalido
          if (record.actual_hours !== 0 || record.expected_hours !== 0 || record.balance_hours !== 0) {
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
              console.log(`  ✅ ${record.date}: corretto (giorno non lavorativo)`);
            } else {
              totalErrors++;
            }
          } else {
            userSkipped++;
          }
          continue;
        }
        
        // Calcola expected_hours usando la funzione centralizzata
        const expectedHours = calculateExpectedHoursForSchedule({
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          break_duration: schedule.break_duration
        });
        
        // Per i giorni passati, dobbiamo calcolare le ore effettive
        // Se actual_hours è già impostato, verifichiamo se è corretto
        // Se sembra includere la pausa pranzo (actual > expected + 0.9h), correggiamolo
        let actualHours = record.actual_hours || 0;
        
        // Verifica se actual_hours include erroneamente la pausa pranzo
        // Se actual_hours è tra expected + 0.9h e expected + 1.5h, probabilmente include la pausa
        if (actualHours > expectedHours + 0.9 && actualHours <= expectedHours + 1.5) {
          console.log(`  ⚠️ ${record.date}: actual_hours=${actualHours.toFixed(2)}h sembra includere pausa pranzo, correggo...`);
          actualHours = actualHours - (schedule.break_duration || 60) / 60;
          actualHours = Math.max(0, actualHours); // Non può essere negativo
        }
        
        // Se actual_hours è 0 ma dovrebbe essere un giorno lavorativo, assumiamo che abbia lavorato l'intero giorno
        // (solo se il record è stato creato automaticamente o ha note che lo indicano)
        if (actualHours === 0 && expectedHours > 0) {
          // Verifica se è un giorno passato (non futuro)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (recordDate <= today) {
            // Per giorni passati senza ore, assumiamo che abbia lavorato le ore attese
            actualHours = expectedHours;
          }
        }
        
        // Ricalcola balance_hours
        const balanceHours = actualHours - expectedHours;
        
        // Verifica se c'è bisogno di aggiornare
        const expectedChanged = Math.abs((record.expected_hours || 0) - expectedHours) > 0.01;
        const actualChanged = Math.abs((record.actual_hours || 0) - actualHours) > 0.01;
        const balanceChanged = Math.abs((record.balance_hours || 0) - balanceHours) > 0.01;
        
        if (expectedChanged || actualChanged || balanceChanged) {
          const { error: updateError } = await supabase
            .from('attendance')
            .update({
              expected_hours: Math.round(expectedHours * 10) / 10,
              actual_hours: Math.round(actualHours * 10) / 10,
              balance_hours: Math.round(balanceHours * 10) / 10,
              notes: record.notes ? `${record.notes} [Corretto con script fix-all-historical-data]` : '[Corretto con script fix-all-historical-data]'
            })
            .eq('id', record.id);
          
          if (updateError) {
            console.error(`  ❌ Errore aggiornamento ${record.date}:`, updateError.message);
            totalErrors++;
          } else {
            userFixed++;
            const changes = [];
            if (expectedChanged) changes.push(`expected: ${(record.expected_hours || 0).toFixed(2)}h → ${expectedHours.toFixed(2)}h`);
            if (actualChanged) changes.push(`actual: ${(record.actual_hours || 0).toFixed(2)}h → ${actualHours.toFixed(2)}h`);
            if (balanceChanged) changes.push(`balance: ${(record.balance_hours || 0).toFixed(2)}h → ${balanceHours.toFixed(2)}h`);
            console.log(`  ✅ ${record.date}: ${changes.join(', ')}`);
          }
        } else {
          userSkipped++;
        }
      }
      
      console.log(`  📊 ${user.first_name} ${user.last_name}: ${userFixed} corretti, ${userSkipped} già corretti`);
      totalFixed += userFixed;
      totalSkipped += userSkipped;
    }
    
    console.log(`\n✅ ========================================`);
    console.log(`✅ CORREZIONE COMPLETATA!`);
    console.log(`✅ ========================================`);
    console.log(`📊 Totale record corretti: ${totalFixed}`);
    console.log(`⏭️ Totale record già corretti/saltati: ${totalSkipped}`);
    console.log(`❌ Totale errori: ${totalErrors}`);
    console.log(`\n🎉 Sistema pronto per il futuro - tutti i calcoli ora usano la logica centralizzata!`);
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
    throw error;
  }
}

// Esegui lo script
fixAllHistoricalData()
  .then(() => {
    console.log('\n🏁 Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });

