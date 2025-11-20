/**
 * Script per correggere tutti i record di attendance con permesso 104
 * Imposta balance_hours = 0 per tutti i giorni con permesso 104 approvato
 * 
 * Uso: node scripts/fix-104-attendance.js [userId]
 * Se userId non specificato, corregge tutti gli utenti
 */

const { createClient } = require('@supabase/supabase-js');
const { calculateExpectedHoursForSchedule } = require('../server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY o SUPABASE_ANON_KEY non configurato');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix104Attendance(userId = null) {
  try {
    console.log('🔧 Correzione attendance records con permesso 104...');
    if (userId) {
      console.log(`   Target: ${userId}`);
    } else {
      console.log('   Target: tutti gli utenti');
    }

    // Recupera tutti i permessi 104 approvati
    let perm104Query = supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date')
      .eq('type', 'permission_104')
      .eq('status', 'approved');

    if (userId) {
      perm104Query = perm104Query.eq('user_id', userId);
    }

    const { data: perm104All, error: perm104Error } = await perm104Query;

    if (perm104Error) {
      console.error('❌ Error fetching permission 104 requests:', perm104Error);
      return;
    }

    if (!perm104All || perm104All.length === 0) {
      console.log('✅ Nessun permesso 104 approvato trovato');
      return;
    }

    console.log(`📋 Trovati ${perm104All.length} permessi 104 approvati`);

    let fixedCount = 0;
    const errors = [];

    // Per ogni permesso 104, aggiorna i record di attendance
    for (const perm of perm104All) {
      const start = new Date(perm.start_date);
      const end = new Date(perm.end_date);
      const dates = [];
      
      // Genera array di date
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      console.log(`   Permesso 104: ${perm.start_date} - ${perm.end_date} (${dates.length} giorni)`);

      // Per ogni data, aggiorna il record di attendance
      for (const dateStr of dates) {
        const dayOfWeek = new Date(dateStr).getDay();
        const { data: schedule } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('user_id', perm.user_id)
          .eq('day_of_week', dayOfWeek)
          .eq('is_working_day', true)
          .single();

        if (schedule) {
          // Calcola le ore attese complete dalla giornata lavorativa
          const expectedHours = calculateExpectedHoursForSchedule({
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            break_duration: schedule.break_duration || 60
          });

          // Aggiorna il record di attendance con balance_hours = 0
          const { error: updateError } = await supabase
            .from('attendance')
            .upsert({
              user_id: perm.user_id,
              date: dateStr,
              actual_hours: expectedHours, // Con permesso 104, ore effettive = ore attese
              expected_hours: expectedHours, // Ore complete della giornata
              balance_hours: 0, // NON influisce sulla banca ore
              notes: `Corretto: permesso 104 - non influenza la banca ore`,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,date'
            });

          if (updateError) {
            console.error(`   ❌ Error fixing attendance for ${perm.user_id} on ${dateStr}:`, updateError.message);
            errors.push({ user_id: perm.user_id, date: dateStr, error: updateError.message });
          } else {
            fixedCount++;
            console.log(`   ✅ Fixed ${dateStr} - balance_hours = 0, expected_hours = ${expectedHours.toFixed(2)}h`);
          }
        }
      }
    }

    console.log('\n✅ Correzione completata!');
    console.log(`   Record corretti: ${fixedCount}`);
    if (errors.length > 0) {
      console.log(`   Errori: ${errors.length}`);
      errors.forEach(err => console.log(`      - ${err.user_id} ${err.date}: ${err.error}`));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Esegui lo script
const userId = process.argv[2] || null;
fix104Attendance(userId)
  .then(() => {
    console.log('\n🎉 Script completato!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

