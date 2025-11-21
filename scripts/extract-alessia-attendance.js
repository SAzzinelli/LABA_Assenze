const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Prova a caricare le variabili d'ambiente dal file .env se esiste
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

if (!supabaseKey) {
  console.error('❌ Errore: SUPABASE_SERVICE_KEY o SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY deve essere configurato');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Funzione per calcolare le ore attese dallo schedule
function calculateExpectedHoursFromSchedule(schedule) {
  if (!schedule || !schedule.start_time || !schedule.end_time) return null;
  
  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  const breakDuration = schedule.break_duration !== null && schedule.break_duration !== undefined ? schedule.break_duration : 0;
  
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const workMinutes = Math.max(0, totalMinutes - breakDuration);
  return workMinutes / 60;
}

// Funzione per formattare le ore
function formatHours(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return 'N/A';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

async function extractAlessiaAttendance() {
  try {
    console.log('🔍 Cercando Alessia Pasqui...');
    
    // Trova l'ID di Alessia Pasqui
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .ilike('first_name', 'Alessia')
      .ilike('last_name', '%Pasqui%');
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ Alessia Pasqui non trovata');
      return;
    }
    
    const alessia = users[0];
    const alessiaId = alessia.id;
    
    console.log(`✅ Trovata: ${alessia.first_name} ${alessia.last_name} (ID: ${alessiaId})`);
    console.log(`📧 Email: ${alessia.email}`);
    console.log('\n' + '='.repeat(80));
    
    // Recupera tutti i suoi schedule
    console.log('📅 Caricamento orari di lavoro...');
    const { data: schedules, error: schedulesError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', alessiaId)
      .order('day_of_week');
    
    if (schedulesError) {
      console.error('❌ Errore nel caricamento schedule:', schedulesError);
      return;
    }
    
    console.log(`✅ Trovati ${schedules?.length || 0} schedule`);
    console.log('\n📋 Orari settimanali:');
    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    schedules.forEach(s => {
      if (s.is_working_day) {
        const hours = calculateExpectedHoursFromSchedule(s);
        console.log(`   ${dayNames[s.day_of_week]}: ${s.start_time || 'N/A'} - ${s.end_time || 'N/A'} (break: ${s.break_duration || 0}min) = ${formatHours(hours)}`);
      } else {
        console.log(`   ${dayNames[s.day_of_week]}: NON LAVORATIVO`);
      }
    });
    console.log('\n' + '='.repeat(80));
    
    // Recupera tutti i record di attendance
    console.log('📊 Caricamento tutte le presenze...');
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', alessiaId)
      .order('date', { ascending: false });
    
    if (attendanceError) {
      console.error('❌ Errore nel caricamento attendance:', attendanceError);
      return;
    }
    
    console.log(`✅ Trovate ${attendance?.length || 0} presenze totali`);
    console.log('\n' + '='.repeat(80));
    
    // Recupera permessi/ferie/malattie per tutte le date
    const allDates = attendance.map(a => a.date);
    const dateSet = [...new Set(allDates)];
    
    console.log('🔍 Caricamento permessi/ferie/malattie...');
    const { data: leaveRequests, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', alessiaId)
      .in('start_date', dateSet)
      .or('start_date.lte.' + dateSet[dateSet.length - 1] + ',end_date.gte.' + dateSet[0]);
    
    if (leaveError) {
      console.error('⚠️ Errore nel caricamento leave_requests:', leaveError);
    }
    
    // Crea mappa per verificare permessi/ferie/malattie per data
    const leaveMap = {};
    if (leaveRequests) {
      leaveRequests.forEach(lr => {
        const start = new Date(lr.start_date);
        const end = new Date(lr.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          if (!leaveMap[dateStr]) leaveMap[dateStr] = [];
          leaveMap[dateStr].push(lr);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 REPORT PRESENZE DI ALESSIA PASQUI');
    console.log('='.repeat(80));
    console.log();
    
    // Elabora ogni record
    const issues = [];
    
    attendance.forEach(record => {
      const date = new Date(record.date);
      const dayOfWeek = date.getDay();
      const dayName = dayNames[dayOfWeek];
      
      // Trova lo schedule per questo giorno
      const schedule = schedules.find(s => 
        Number(s.day_of_week) === Number(dayOfWeek) && s.is_working_day
      );
      
      // Calcola ore attese dallo schedule
      const expectedFromSchedule = schedule ? calculateExpectedHoursFromSchedule(schedule) : null;
      const expectedFromDB = record.expected_hours || 0;
      
      // Verifica se c'è un permesso/ferie/malattia
      const leaveForDate = leaveMap[record.date] || [];
      const hasLeave = leaveForDate.length > 0;
      const leaveTypes = leaveForDate.map(lr => lr.type).join(', ');
      
      // Determina se c'è un problema
      let issue = null;
      if (schedule && expectedFromSchedule !== null) {
        const diff = Math.abs(expectedFromSchedule - expectedFromDB);
        if (diff > 0.01) { // Tolleranza di 0.01 ore (circa 1 minuto)
          issue = `⚠️ DISCREPANZA: DB=${formatHours(expectedFromDB)}, Schedule=${formatHours(expectedFromSchedule)}`;
        }
      } else if (!schedule && expectedFromDB > 0) {
        issue = `⚠️ Nessuno schedule trovato ma DB ha ${formatHours(expectedFromDB)}`;
      }
      
      const recordInfo = {
        date: record.date,
        dayName: dayName,
        dayOfWeek: dayOfWeek,
        isWorkingDay: schedule ? true : false,
        scheduleStart: schedule?.start_time || 'N/A',
        scheduleEnd: schedule?.end_time || 'N/A',
        scheduleBreak: schedule?.break_duration || 0,
        expectedFromSchedule: expectedFromSchedule,
        expectedFromDB: expectedFromDB,
        actualHours: record.actual_hours || 0,
        balanceHours: record.balance_hours || 0,
        hasLeave: hasLeave,
        leaveTypes: leaveTypes,
        issue: issue
      };
      
      // Stampa in formato leggibile
      console.log(`📅 ${record.date} (${dayName})`);
      console.log(`   Orario Schedule: ${schedule ? `${schedule.start_time}-${schedule.end_time} (break: ${schedule.break_duration || 0}min)` : 'NON LAVORATIVO'}`);
      console.log(`   Ore Attese da Schedule: ${expectedFromSchedule !== null ? formatHours(expectedFromSchedule) : 'N/A'}`);
      console.log(`   Ore Attese da DB: ${formatHours(expectedFromDB)}`);
      console.log(`   Ore Effettive: ${formatHours(record.actual_hours || 0)}`);
      console.log(`   Balance: ${formatHours(record.balance_hours || 0)}`);
      
      if (hasLeave) {
        console.log(`   🏖️  Permessi/Ferie/Malattia: ${leaveTypes}`);
      }
      
      if (issue) {
        console.log(`   ${issue}`);
        issues.push(recordInfo);
      }
      
      console.log();
    });
    
    console.log('='.repeat(80));
    console.log(`📊 RIEPILOGO`);
    console.log('='.repeat(80));
    console.log(`Totale presenze: ${attendance.length}`);
    console.log(`Presenze con problemi: ${issues.length}`);
    
    if (issues.length > 0) {
      console.log('\n⚠️  PRESENZE CON PROBLEMI:');
      issues.forEach(issue => {
        console.log(`\n   ${issue.date} (${issue.dayName}):`);
        console.log(`      - DB: ${formatHours(issue.expectedFromDB)}`);
        console.log(`      - Schedule: ${formatHours(issue.expectedFromSchedule)} (${issue.scheduleStart}-${issue.scheduleEnd}, break: ${issue.scheduleBreak}min)`);
        console.log(`      - Differenza: ${formatHours(Math.abs(issue.expectedFromSchedule - issue.expectedFromDB))}`);
      });
    } else {
      console.log('\n✅ Nessun problema trovato!');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

extractAlessiaAttendance();

