require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';

async function testEndpoints() {
  // Trova Simone
  const { data: users } = await supabase.from('users').select('id, first_name, email').ilike('first_name', 'simone');
  if (!users || users.length === 0) {
    console.log('❌ Utente Simone non trovato');
    return;
  }
  
  const userId = users[0].id;
  console.log(`👤 Utente: ${users[0].first_name} (${users[0].email})`);
  
  // Genera token
  const token = jwt.sign({ id: userId, email: users[0].email, role: 'employee' }, JWT_SECRET);
  
  // Simula la chiamata a current-hours
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().substring(0, 5);
  const dayOfWeek = now.getDay();
  
  console.log(`\n📅 Oggi: ${today} (${dayOfWeek}), ora: ${currentTime}`);
  
  // Ottieni schedule
  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_working_day', true)
    .single();
  
  if (!schedule) {
    console.log('❌ Nessuno schedule trovato per oggi');
    return;
  }
  
  console.log(`📋 Schedule: ${schedule.start_time} - ${schedule.end_time}, pausa: ${schedule.break_duration}m, break_start: ${schedule.break_start_time || 'auto'}`);
  
  // Usa la funzione centralizzata
  const { calculateRealTimeHours, calculateExpectedHoursForSchedule } = require('./server/utils/hoursCalculation');
  
  const result = calculateRealTimeHours(schedule, currentTime, null);
  
  console.log(`\n✅ Risultato calcolo centralizzato:`);
  console.log(`   Expected: ${result.expectedHours}h`);
  console.log(`   Actual: ${result.actualHours}h`);
  console.log(`   Balance: ${result.balanceHours}h`);
  console.log(`   Status: ${result.status}`);
  
  // Verifica i dati nel database
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();
  
  if (attendance) {
    console.log(`\n📊 Record DB per oggi:`);
    console.log(`   Expected: ${attendance.expected_hours}h`);
    console.log(`   Actual: ${attendance.actual_hours}h`);
    console.log(`   Balance: ${attendance.balance_hours}h`);
  } else {
    console.log(`\n⚠️ Nessun record nel DB per oggi`);
  }
  
  // Verifica il saldo mensile
  const { data: allAttendance } = await supabase
    .from('attendance')
    .select('date, actual_hours, expected_hours, balance_hours')
    .eq('user_id', userId)
    .gte('date', '2025-10-01')
    .lte('date', '2025-10-31')
    .order('date');
  
  console.log(`\n📊 Record ottobre 2025:`);
  let totalActual = 0;
  let totalExpected = 0;
  allAttendance?.forEach(r => {
    if (r.date === today) {
      // Usa calcolo real-time per oggi
      totalActual += result.actualHours;
      totalExpected += result.expectedHours;
      console.log(`   ${r.date}: actual=${result.actualHours.toFixed(2)}h (REAL-TIME), expected=${result.expectedHours.toFixed(2)}h (REAL-TIME), balance=${result.balanceHours.toFixed(2)}h`);
    } else {
      totalActual += r.actual_hours || 0;
      totalExpected += r.expected_hours || 0;
      console.log(`   ${r.date}: actual=${r.actual_hours || 0}h, expected=${r.expected_hours || 0}h, balance=${r.balance_hours || 0}h`);
    }
  });
  
  const monthlyBalance = totalActual - totalExpected;
  console.log(`\n💰 Saldo mensile (calcolato):`);
  console.log(`   Total Actual: ${totalActual.toFixed(2)}h`);
  console.log(`   Total Expected: ${totalExpected.toFixed(2)}h`);
  console.log(`   Balance: ${monthlyBalance.toFixed(2)}h`);
}

testEndpoints().catch(console.error);
