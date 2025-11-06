require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceUpdateAll() {
  console.log('🔧 Force updating attendance record for Simone...\n');
  
  const { data: users } = await supabase.from('users').select('id, first_name').ilike('first_name', 'simone').neq('role', 'admin');
  if (!users || users.length === 0) return;
  
  const userId = users[0].id;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5);
  const dayOfWeek = now.getDay();
  
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
  
  console.log(`✅ Calculated values:`);
  console.log(`   Expected: ${result.expectedHours}h`);
  console.log(`   Actual: ${result.actualHours}h`);
  console.log(`   Balance: ${result.balanceHours}h\n`);
  
  // Update database (without updated_at)
  const { error } = await supabase
    .from('attendance')
    .upsert({
      user_id: userId,
      date: today,
      expected_hours: result.expectedHours,
      actual_hours: result.actualHours,
      balance_hours: result.balanceHours,
      notes: `Aggiornato alle ${currentTime} - calcolo centralizzato corretto`
    }, {
      onConflict: 'user_id,date'
    });
  
  if (error) {
    console.error('❌ Error updating:', error);
  } else {
    console.log('✅ Database updated successfully!\n');
    console.log('💡 Frontend should refresh to show correct values.');
    console.log('💡 If values are still wrong, Railway may need to redeploy.');
  }
}

forceUpdateAll().catch(console.error);
