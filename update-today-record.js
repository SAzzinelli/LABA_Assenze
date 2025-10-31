require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTodayRecord() {
  // Trova Simone dipendente
  const { data: users } = await supabase.from('users').select('id, first_name').ilike('first_name', 'simone').neq('role', 'admin');
  if (!users || users.length === 0) return;
  
  const userId = users[0].id;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5);
  const dayOfWeek = now.getDay();
  
  console.log(`👤 Aggiornamento record per ${users[0].first_name} - ${today} alle ${currentTime}`);
  
  // Ottieni schedule
  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_working_day', true)
    .single();
  
  if (!schedule) {
    console.log('❌ Nessuno schedule trovato');
    return;
  }
  
  // Recupera permessi
  const { data: permissionsToday } = await supabase
    .from('leave_requests')
    .select('hours, permission_type, exit_time, entry_time')
    .eq('user_id', userId)
    .eq('type', 'permission')
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today);
  
  let permissionData = null;
  if (permissionsToday && permissionsToday.length > 0) {
    let exitTime = null;
    let entryTime = null;
    let permType = null;
    
    permissionsToday.forEach(perm => {
      if (perm.permission_type === 'early_exit' && perm.exit_time) {
        exitTime = perm.exit_time;
        permType = 'early_exit';
      }
      if (perm.permission_type === 'late_entry' && perm.entry_time) {
        entryTime = perm.entry_time;
        permType = 'late_entry';
      }
    });
    
    if (exitTime || entryTime) {
      permissionData = { permission_type: permType, exit_time: exitTime, entry_time: entryTime };
    }
  }
  
  // Calcola con funzione centralizzata
  const result = calculateRealTimeHours(schedule, currentTime, permissionData);
  
  console.log(`\n✅ Calcolo:`);
  console.log(`   Expected: ${result.expectedHours}h`);
  console.log(`   Actual: ${result.actualHours}h`);
  console.log(`   Balance: ${result.balanceHours}h`);
  
  // Aggiorna il database
  const { error } = await supabase
    .from('attendance')
    .upsert({
      user_id: userId,
      date: today,
      expected_hours: result.expectedHours,
      actual_hours: result.actualHours,
      balance_hours: result.balanceHours,
      notes: `Aggiornato alle ${currentTime} con calcolo centralizzato corretto`
    }, {
      onConflict: 'user_id,date'
    });
  
  if (error) {
    console.error('❌ Errore aggiornamento:', error);
  } else {
    console.log('\n✅ Record aggiornato nel database!');
  }
}

updateTodayRecord();
