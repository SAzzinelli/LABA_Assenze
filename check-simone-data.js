require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSimone() {
  // Trova Simone
  const { data: users } = await supabase.from('users').select('id, first_name, email, role').ilike('first_name', 'simone').neq('role', 'admin');
  if (!users || users.length === 0) {
    console.log('❌ Utente Simone dipendente non trovato');
    return;
  }
  
  const userId = users[0].id;
  console.log(`👤 Utente: ${users[0].first_name} (${users[0].email}), role: ${users[0].role}`);
  
  // Verifica dati DB per oggi
  const today = new Date().toISOString().split('T')[0];
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();
  
  console.log(`\n📊 Record DB per oggi (${today}):`);
  if (attendance) {
    console.log(`   Expected: ${attendance.expected_hours}h`);
    console.log(`   Actual: ${attendance.actual_hours}h`);
    console.log(`   Balance: ${attendance.balance_hours}h`);
    console.log(`   Notes: ${attendance.notes || 'nessuna'}`);
  } else {
    console.log(`   ⚠️ Nessun record nel DB`);
  }
  
  // Calcola cosa DOVREBBE essere usando la funzione centralizzata
  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5);
  const dayOfWeek = now.getDay();
  
  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_working_day', true)
    .single();
  
  if (!schedule) {
    console.log(`\n❌ Nessuno schedule trovato per oggi (day ${dayOfWeek})`);
    return;
  }
  
  console.log(`\n📋 Schedule: ${schedule.start_time}-${schedule.end_time}, pausa: ${schedule.break_duration}m, break_start: ${schedule.break_start_time || 'auto'}`);
  
  const result = calculateRealTimeHours(schedule, currentTime, null);
  
  console.log(`\n✅ Calcolo REAL-TIME (dovrebbe essere):`);
  console.log(`   Expected: ${result.expectedHours}h`);
  console.log(`   Actual: ${result.actualHours}h`);
  console.log(`   Balance: ${result.balanceHours}h`);
  console.log(`   Status: ${result.status}`);
  
  // Verifica il saldo mensile
  const { data: allAtt } = await supabase
    .from('attendance')
    .select('date, actual_hours, expected_hours, balance_hours')
    .eq('user_id', userId)
    .gte('date', '2025-10-01')
    .lte('date', '2025-10-31')
    .order('date');
  
  let totalActual = 0;
  let totalExpected = 0;
  
  allAtt?.forEach(r => {
    if (r.date === today) {
      totalActual += result.actualHours;
      totalExpected += result.expectedHours;
    } else {
      totalActual += r.actual_hours || 0;
      totalExpected += r.expected_hours || 0;
    }
  });
  
  const monthlyBalance = totalActual - totalExpected;
  
  console.log(`\n💰 Saldo mensile (calcolato):`);
  console.log(`   Total Actual: ${totalActual.toFixed(2)}h`);
  console.log(`   Total Expected: ${totalExpected.toFixed(2)}h`);
  console.log(`   Balance: ${monthlyBalance.toFixed(2)}h`);
  
  // Suggerimento per aggiornare il DB
  if (attendance && (Math.abs(attendance.actual_hours - result.actualHours) > 0.1 || Math.abs(attendance.balance_hours - result.balanceHours) > 0.1)) {
    console.log(`\n⚠️ DISCREPANZA RILEVATA:`);
    console.log(`   DB actual: ${attendance.actual_hours}h vs Real-time: ${result.actualHours}h (diff: ${(attendance.actual_hours - result.actualHours).toFixed(2)}h)`);
    console.log(`   DB balance: ${attendance.balance_hours}h vs Real-time: ${result.balanceHours}h (diff: ${(attendance.balance_hours - result.balanceHours).toFixed(2)}h)`);
    console.log(`\n💡 Il DB dovrebbe essere aggiornato con i valori real-time`);
  }
}

checkSimone().catch(console.error);
