require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';

async function testEndpointLogic() {
  console.log('🔍 Testing endpoint logic for Simone...\n');
  
  // Trova Simone dipendente
  const { data: users } = await supabase.from('users').select('id, first_name, email').ilike('first_name', 'simone').neq('role', 'admin');
  if (!users || users.length === 0) {
    console.log('❌ Utente non trovato');
    return;
  }
  
  const userId = users[0].id;
  console.log(`👤 User: ${users[0].first_name} (${users[0].email})`);
  
  // Simula la logica dell'endpoint /api/attendance/current-hours
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().substring(0, 5);
  const dayOfWeek = now.getDay();
  
  console.log(`\n📅 Today: ${today}, Time: ${currentTime}, Day: ${dayOfWeek}`);
  
  // Get work schedule
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
  
  console.log(`\n📋 Schedule: ${schedule.start_time}-${schedule.end_time}, break: ${schedule.break_duration}m, break_start: ${schedule.break_start_time || 'auto'}`);
  
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
      console.log(`📋 Permission: ${permType}, exit: ${exitTime}, entry: ${entryTime}`);
    }
  }
  
  // Use centralized function
  console.log(`\n🔄 Calling calculateRealTimeHours(${JSON.stringify({ start: schedule.start_time, end: schedule.end_time, break: schedule.break_duration, break_start: schedule.break_start_time })}, "${currentTime}", ${permissionData ? JSON.stringify(permissionData) : 'null'})...`);
  
  const result = calculateRealTimeHours(schedule, currentTime, permissionData);
  
  console.log(`\n✅ Result:`);
  console.log(`   Expected: ${result.expectedHours}h`);
  console.log(`   Actual: ${result.actualHours}h`);
  console.log(`   Balance: ${result.balanceHours}h`);
  console.log(`   Status: ${result.status}`);
  
  // Verify what's in DB
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();
  
  if (attendance) {
    console.log(`\n📊 DB Record:`);
    console.log(`   Expected: ${attendance.expected_hours}h`);
    console.log(`   Actual: ${attendance.actual_hours}h`);
    console.log(`   Balance: ${attendance.balance_hours}h`);
  }
  
  // Calculate expected manually
  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const breakDuration = schedule.break_duration || 60;
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const currentMinutes = currentHour * 60 + currentMin;
  const workMinutes = endMinutes - startMinutes - breakDuration;
  
  console.log(`\n🧮 Manual calculation:`);
  console.log(`   Start: ${startMinutes}min (${startHour}:${startMin})`);
  console.log(`   End: ${endMinutes}min (${endHour}:${endMin})`);
  console.log(`   Current: ${currentMinutes}min (${currentHour}:${currentMin})`);
  console.log(`   Break: ${breakDuration}min`);
  console.log(`   Expected work: ${workMinutes}min = ${workMinutes/60}h`);
  
  if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    // Calculate actual based on current time
    let actualMinutes = 0;
    
    // Determine break time
    let breakStartMinutes = 0;
    let breakEndMinutes = 0;
    
    if (schedule.break_start_time) {
      const [breakStartHour, breakStartMin] = schedule.break_start_time.split(':').map(Number);
      breakStartMinutes = breakStartHour * 60 + breakStartMin;
      breakEndMinutes = breakStartMinutes + breakDuration;
    } else {
      // Default: break in the middle
      const midPoint = startMinutes + (endMinutes - startMinutes) / 2;
      breakStartMinutes = midPoint - breakDuration / 2;
      breakEndMinutes = breakStartMinutes + breakDuration;
    }
    
    console.log(`   Break: ${breakStartMinutes}min (${Math.floor(breakStartMinutes/60)}:${breakStartMinutes%60}) - ${breakEndMinutes}min (${Math.floor(breakEndMinutes/60)}:${breakEndMinutes%60})`);
    
    if (currentMinutes < breakStartMinutes) {
      // Before break
      actualMinutes = currentMinutes - startMinutes;
    } else if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) {
      // During break
      actualMinutes = breakStartMinutes - startMinutes;
    } else {
      // After break
      actualMinutes = (breakStartMinutes - startMinutes) + (currentMinutes - breakEndMinutes);
    }
    
    console.log(`   Actual worked: ${actualMinutes}min = ${actualMinutes/60}h`);
    console.log(`   Balance: ${actualMinutes/60 - workMinutes/60}h`);
  }
}

testEndpointLogic().catch(console.error);
