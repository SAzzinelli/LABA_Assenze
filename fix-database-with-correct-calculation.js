require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDatabase() {
  console.log('🔧 Fixing database with correct calculation...\n');
  
  const { data: users } = await supabase.from('users').select('id, first_name').ilike('first_name', 'simone').neq('role', 'admin');
  if (!users || users.length === 0) return;
  
  const userId = users[0].id;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5);
  const dayOfWeek = now.getDay();
  
  console.log(`📅 Today: ${today}, Time: ${currentTime}\n`);
  
  // Get schedule
  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_working_day', true)
    .single();
  
  if (!schedule) {
    console.log('❌ No schedule found');
    return;
  }
  
  console.log(`📋 Schedule: ${schedule.start_time}-${schedule.end_time}, break: ${schedule.break_duration}m, break_start: ${schedule.break_start_time || 'auto'}\n`);
  
  // Get permissions
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
  
  // Calculate with centralized function
  const result = calculateRealTimeHours(schedule, currentTime, permissionData);
  
  console.log(`✅ Calculated values (CORRECT):`);
  console.log(`   Expected: ${result.expectedHours}h`);
  console.log(`   Actual: ${result.actualHours}h`);
  console.log(`   Balance: ${result.balanceHours}h\n`);
  
  // Get current DB values
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();
  
  if (attendance) {
    console.log(`📊 Current DB values (WRONG):`);
    console.log(`   Expected: ${attendance.expected_hours}h`);
    console.log(`   Actual: ${attendance.actual_hours}h`);
    console.log(`   Balance: ${attendance.balance_hours}h\n`);
  }
  
  // Update database
  const { error } = await supabase
    .from('attendance')
    .upsert({
      user_id: userId,
      date: today,
      expected_hours: result.expectedHours,
      actual_hours: result.actualHours,
      balance_hours: result.balanceHours,
      notes: `Corretto alle ${currentTime} - pausa pranzo gestita correttamente durante il calcolo`
    }, {
      onConflict: 'user_id,date'
    });
  
  if (error) {
    console.error('❌ Error updating:', error);
  } else {
    console.log('✅ Database updated successfully!\n');
    console.log('💡 The frontend should now show:');
    console.log(`   - Ore Lavorate: ${Math.floor(result.actualHours)}h ${Math.round((result.actualHours - Math.floor(result.actualHours)) * 60)}m`);
    console.log(`   - Saldo: ${result.balanceHours >= 0 ? '+' : ''}${Math.floor(Math.abs(result.balanceHours))}h ${Math.round((Math.abs(result.balanceHours) - Math.floor(Math.abs(result.balanceHours))) * 60)}m`);
  }
}

fixDatabase().catch(console.error);
