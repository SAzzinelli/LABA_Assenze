const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Leggi le credenziali dalle variabili d'ambiente o dagli argomenti della riga di comando
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Se non trovate, prova a leggerle dagli argomenti della riga di comando
if (!supabaseUrl || !supabaseKey) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      supabaseUrl = args[i + 1];
    }
    if (args[i] === '--key' && args[i + 1]) {
      supabaseKey = args[i + 1];
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variabili SUPABASE_URL e SUPABASE_SERVICE_KEY non trovate');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPermissionDiscrepancies() {
  console.log('🔧 Correzione discrepanze tra permessi approvati e record di presenza...\n');

  try {
    // 1. Recupera tutti i permessi approvati
    const { data: approvedPermissions, error: permError } = await supabase
      .from('leave_requests')
      .select(`
        id,
        user_id,
        start_date,
        end_date,
        hours,
        permission_type,
        entry_time,
        exit_time,
        status,
        users!leave_requests_user_id_fkey(first_name, last_name, email)
      `)
      .eq('type', 'permission')
      .eq('status', 'approved')
      .order('start_date', { ascending: true });

    if (permError) {
      console.error('❌ Errore nel recupero permessi:', permError);
      return;
    }

    console.log(`📋 Trovati ${approvedPermissions.length} permessi approvati totali\n`);

    const corrections = [];
    const today = new Date().toISOString().split('T')[0];

    for (const perm of approvedPermissions) {
      // Genera tutte le date del permesso
      const startDate = new Date(perm.start_date);
      const endDate = new Date(perm.end_date);
      const dates = [];
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      for (const date of dates) {
        // Skip date future
        if (date > today) continue;

        // Recupera il record di attendance per questa data
        const { data: attendance, error: attError } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', perm.user_id)
          .eq('date', date)
          .single();

        const userName = perm.users ? `${perm.users.first_name} ${perm.users.last_name}` : `User ${perm.user_id}`;
        const isFullDay = perm.permission_type === 'full_day' || perm.permission_type === 'giornata_intera' || perm.permission_type === 'tutta_giornata';
        const permissionHours = parseFloat(perm.hours || 0);

        if (attError && attError.code === 'PGRST116') {
          // Nessun record di attendance - creane uno nuovo
          console.log(`⚠️  Nessun record per ${userName} il ${date} - creazione nuovo record`);
          
          // Recupera l'orario di lavoro per calcolare expected_hours
          const dayOfWeek = new Date(date).getDay();
          const { data: schedule } = await supabase
            .from('work_schedules')
            .select('start_time, end_time, break_duration')
            .eq('user_id', perm.user_id)
            .eq('day_of_week', dayOfWeek)
            .eq('is_working_day', true)
            .single();

          let expectedHours = 8; // Default
          if (schedule && schedule.start_time && schedule.end_time) {
            const [startHour, startMin] = schedule.start_time.split(':').map(Number);
            const [endHour, endMin] = schedule.end_time.split(':').map(Number);
            const breakDuration = schedule.break_duration !== null && schedule.break_duration !== undefined ? schedule.break_duration : 60;
            
            const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
            const workMinutes = totalMinutes - breakDuration;
            expectedHours = workMinutes / 60;
          }

          const actualHours = isFullDay ? 0 : Math.max(0, expectedHours - permissionHours);
          const balanceHours = actualHours - expectedHours;

          const { error: createError } = await supabase
            .from('attendance')
            .insert({
              user_id: perm.user_id,
              date: date,
              actual_hours: Math.round(actualHours * 10) / 10,
              expected_hours: Math.round(expectedHours * 10) / 10,
              balance_hours: Math.round(balanceHours * 10) / 10,
              notes: `[Permesso approvato: ${isFullDay ? 'giornata intera' : permissionHours + 'h'}]`
            });

          if (createError) {
            console.error(`❌ Errore creazione record per ${userName} il ${date}:`, createError);
          } else {
            console.log(`✅ Creato record per ${userName} il ${date}: actual=${actualHours}h, expected=${expectedHours}h, balance=${balanceHours}h`);
            corrections.push({
              user: userName,
              date: date,
              action: 'CREATED',
              actualHours: actualHours,
              expectedHours: expectedHours,
              balanceHours: balanceHours
            });
          }
        } else if (attendance) {
          const currentActualHours = parseFloat(attendance.actual_hours || 0);
          const currentExpectedHours = parseFloat(attendance.expected_hours || 0);
          const currentBalanceHours = parseFloat(attendance.balance_hours || 0);

          let newActualHours = currentActualHours;
          let newExpectedHours = currentExpectedHours;
          let newBalanceHours = currentBalanceHours;
          let needsUpdate = false;

          if (isFullDay) {
            // Permesso giornata intera: actual_hours dovrebbe essere 0
            if (currentActualHours > 0.5) {
              newActualHours = 0;
              newBalanceHours = newActualHours - currentExpectedHours;
              needsUpdate = true;
              console.log(`🔧 ${userName} ${date}: Permesso giornata intera - correggo actual_hours da ${currentActualHours}h a 0h`);
            }
          } else {
            // Permesso orario: actual_hours dovrebbe essere ridotto rispetto a expected_hours
            // Se actual_hours >= expected_hours, significa che non è stato applicato il permesso
            if (currentActualHours >= currentExpectedHours - 0.1) {
              // Calcola le ore effettive considerando il permesso
              newActualHours = Math.max(0, currentExpectedHours - permissionHours);
              newBalanceHours = newActualHours - currentExpectedHours;
              needsUpdate = true;
              console.log(`🔧 ${userName} ${date}: Permesso orario ${permissionHours}h - correggo actual_hours da ${currentActualHours}h a ${newActualHours}h`);
            } else if (Math.abs(currentBalanceHours - (currentActualHours - currentExpectedHours)) > 0.1) {
              // Balance non corretto
              newBalanceHours = currentActualHours - currentExpectedHours;
              needsUpdate = true;
              console.log(`🔧 ${userName} ${date}: Correggo balance_hours da ${currentBalanceHours}h a ${newBalanceHours}h`);
            }
          }

          if (needsUpdate) {
            const { error: updateError } = await supabase
              .from('attendance')
              .update({
                actual_hours: Math.round(newActualHours * 10) / 10,
                expected_hours: Math.round(newExpectedHours * 10) / 10,
                balance_hours: Math.round(newBalanceHours * 10) / 10,
                notes: attendance.notes ? `${attendance.notes} [Corretto per permesso approvato]` : `[Corretto per permesso approvato]`
              })
              .eq('user_id', perm.user_id)
              .eq('date', date);

            if (updateError) {
              console.error(`❌ Errore aggiornamento record per ${userName} il ${date}:`, updateError);
            } else {
              console.log(`✅ Aggiornato record per ${userName} il ${date}: actual=${newActualHours}h, expected=${newExpectedHours}h, balance=${newBalanceHours}h`);
              corrections.push({
                user: userName,
                date: date,
                action: 'UPDATED',
                oldActualHours: currentActualHours,
                newActualHours: newActualHours,
                oldBalanceHours: currentBalanceHours,
                newBalanceHours: newBalanceHours
              });
            }
          }
        }
      }
    }

    console.log('\n\n📊 RIEPILOGO CORREZIONI:\n');
    console.log(`Totale correzioni: ${corrections.length}`);
    
    const created = corrections.filter(c => c.action === 'CREATED').length;
    const updated = corrections.filter(c => c.action === 'UPDATED').length;
    
    console.log(`- Record creati: ${created}`);
    console.log(`- Record aggiornati: ${updated}`);

    if (corrections.length > 0) {
      console.log('\n📋 DETTAGLIO CORREZIONI:\n');
      corrections.forEach((c, idx) => {
        console.log(`${idx + 1}. ${c.user} - ${c.date}`);
        if (c.action === 'CREATED') {
          console.log(`   ✅ Creato: actual=${c.actualHours}h, expected=${c.expectedHours}h, balance=${c.balanceHours}h`);
        } else {
          console.log(`   🔧 Aggiornato: actual ${c.oldActualHours}h → ${c.newActualHours}h, balance ${c.oldBalanceHours}h → ${c.newBalanceHours}h`);
        }
      });
    }

    console.log('\n✅ Correzione completata!');

  } catch (error) {
    console.error('❌ Errore durante la correzione:', error);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  fixPermissionDiscrepancies();
}

module.exports = { fixPermissionDiscrepancies };
