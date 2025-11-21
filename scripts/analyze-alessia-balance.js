/**
 * Script per analizzare nel dettaglio il balance di Alessia
 * e identificare quali record devono essere corretti
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

if (!supabaseKey) {
  console.error('❌ Errore: SUPABASE_SERVICE_KEY deve essere configurato');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatHours(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '0h 0m';
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  const sign = hours < 0 ? '-' : '';
  return `${sign}${h}h ${m}m`;
}

async function analyzeAlessiaBalance() {
  try {
    const { data: user } = await supabase.from('users').select('id').ilike('first_name', 'Alessia').ilike('last_name', '%Pasqui%').single();
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Recupera attendance
    const { data: attendance } = await supabase.from('attendance').select('*').eq('user_id', user.id).order('date', { ascending: false });
    
    // Recupera permessi/ferie per tutti i giorni
    const { data: allLeaves } = await supabase.from('leave_requests').select('*').eq('user_id', user.id);
    
    // Recupera work schedules
    const { data: workSchedules } = await supabase.from('work_schedules').select('*').eq('user_id', user.id);
    
    console.log('\n📊 ANALISI DETTAGLIATA ALESSIA PASQUI\n');
    console.log('='.repeat(100));
    
    const problemDays = [];
    
    attendance.forEach(record => {
      const isToday = record.date === today;
      if (isToday) return; // Escludi oggi
      
      const dayOfWeek = new Date(record.date).getDay();
      const schedule = workSchedules?.find(s => Number(s.day_of_week) === Number(dayOfWeek));
      
      const actualHours = record.actual_hours || 0;
      const expectedHours = record.expected_hours || 0;
      const balance = record.balance_hours || 0;
      
      // Verifica permessi/ferie per questo giorno
      const dayLeaves = allLeaves?.filter(l => {
        const start = new Date(l.start_date).toISOString().split('T')[0];
        const end = new Date(l.end_date).toISOString().split('T')[0];
        return record.date >= start && record.date <= end;
      }) || [];
      
      const hasApprovedPerm = dayLeaves.some(l => l.status === 'approved' && l.type === 'permission');
      const hasApproved104 = dayLeaves.some(l => l.status === 'approved' && l.type === 'permission_104');
      const hasApprovedVacation = dayLeaves.some(l => l.status === 'approved' && l.type === 'vacation');
      const hasApprovedSick = dayLeaves.some(l => l.status === 'approved' && l.type === 'sick_leave');
      
      // Se ha permesso 104, balance dovrebbe essere 0
      if (hasApproved104 && balance !== 0) {
        problemDays.push({ ...record, issue: '104 balance != 0', correctBalance: 0 });
      }
      
      // Se le ore effettive sono diverse da quelle attese E non ci sono permessi/ferie, potrebbe essere un problema
      if (!hasApprovedPerm && !hasApprovedVacation && !hasApprovedSick && !hasApproved104) {
        if (Math.abs(balance) > 0.01) {
          problemDays.push({ 
            ...record, 
            schedule,
            leaves: dayLeaves,
            issue: `Balance != 0 (${formatHours(balance)}) senza permessi/ferie`,
            correctActualHours: expectedHours, // Se dovrebbe essere in pari, actual = expected
            correctBalance: 0
          });
        }
      }
      
      // Se ha permesso approvato, verifica che sia considerato correttamente
      if (hasApprovedPerm || hasApprovedVacation || hasApprovedSick) {
        // Con permesso/ferie, il balance potrebbe essere diverso da 0
        // Ma verifica che sia coerente
      }
    });
    
    console.log(`\n⚠️  GIORNI CON PROBLEMI: ${problemDays.length}\n`);
    
    problemDays.forEach(p => {
      console.log(`   ${p.date} (${['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][new Date(p.date).getDay()]}):`);
      console.log(`      Problema: ${p.issue}`);
      console.log(`      Actual: ${formatHours(p.actual_hours)}, Expected: ${formatHours(p.expected_hours)}`);
      console.log(`      Balance DB: ${formatHours(p.balance_hours)}, Dovrebbe essere: ${formatHours(p.correctBalance || 0)}`);
      if (p.schedule) {
        console.log(`      Schedule: ${p.schedule.start_time}-${p.schedule.end_time} (break: ${p.schedule.break_duration || 0}min)`);
      }
      if (p.leaves && p.leaves.length > 0) {
        console.log(`      Permessi/Ferie: ${p.leaves.length} richieste`);
        p.leaves.forEach(l => console.log(`         - ${l.type} (${l.status}), hours: ${l.hours || 'N/A'}`));
      }
      console.log();
    });
    
    console.log('='.repeat(100));
    console.log('\n💡 CONCLUSIONE:');
    console.log('   Se Alessia dovrebbe essere in pari (0h), i giorni con balance != 0');
    console.log('   dovrebbero essere corretti impostando actual_hours = expected_hours');
    console.log('   (a meno che non ci siano permessi/ferie che giustificano la differenza)\n');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

analyzeAlessiaBalance()
  .then(() => {
    console.log('\n🎉 Script completato!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

