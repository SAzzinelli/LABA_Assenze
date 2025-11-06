require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testHoursBalance() {
  console.log('🔍 Testing /api/attendance/hours-balance logic...\n');
  
  // Trova Simone
  const { data: users } = await supabase.from('users').select('id, first_name').ilike('first_name', 'simone').neq('role', 'admin');
  if (!users || users.length === 0) return;
  
  const userId = users[0].id;
  const targetYear = 2025;
  const targetMonth = 10;
  
  // Simula la logica dell'endpoint
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === parseInt(targetYear) && (now.getMonth() + 1) === parseInt(targetMonth);
  
  console.log(`📅 Today: ${today}, Month: ${targetMonth}/${targetYear}, IsCurrentMonth: ${isCurrentMonth}\n`);
  
  // Fetch attendance
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .gte('date', `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`)
    .lte('date', `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`);
  
  console.log(`📊 Attendance records: ${attendance?.length || 0}`);
  
  // Get schedules
  const { data: workSchedules } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('user_id', userId);
  
  // Calculate real-time for today
  let realTimeActualHours = 0;
  let realTimeExpectedHours = 0;
  let hasRealTimeCalculation = false;
  
  if (isCurrentMonth && workSchedules && workSchedules.length > 0) {
    const currentTime = now.toTimeString().substring(0, 5);
    const dayOfWeek = now.getDay();
    
    const todaySchedule = workSchedules.find(s => s.day_of_week === dayOfWeek && s.is_working_day);
    
    if (todaySchedule) {
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
      
      const result = calculateRealTimeHours(todaySchedule, currentTime, permissionData);
      realTimeActualHours = result.actualHours;
      realTimeExpectedHours = result.expectedHours;
      hasRealTimeCalculation = true;
      
      console.log(`✅ Real-time calculation for today:`);
      console.log(`   Actual: ${realTimeActualHours.toFixed(2)}h`);
      console.log(`   Expected: ${realTimeExpectedHours.toFixed(2)}h`);
      console.log(`   Balance: ${(realTimeActualHours - realTimeExpectedHours).toFixed(2)}h\n`);
    }
  }
  
  // Calculate totals
  let totalActualHours = 0;
  let totalExpectedHours = 0;
  
  if (hasRealTimeCalculation && isCurrentMonth) {
    totalActualHours = realTimeActualHours;
    totalExpectedHours = realTimeExpectedHours;
    
    console.log(`📊 Using real-time for today: ${realTimeActualHours.toFixed(2)}h actual, ${realTimeExpectedHours.toFixed(2)}h expected`);
    
    attendance?.forEach(record => {
      if (record.date !== today) {
        totalActualHours += record.actual_hours || 0;
        totalExpectedHours += record.expected_hours || 8;
        console.log(`  📅 ${record.date}: +${record.actual_hours || 0}h actual, +${record.expected_hours || 8}h expected`);
      } else {
        console.log(`  ⏭️ Skipping DB record for today (${record.date}) - using real-time instead`);
      }
    });
  } else {
    attendance?.forEach(record => {
      totalActualHours += record.actual_hours || 0;
      totalExpectedHours += record.expected_hours || 8;
    });
  }
  
  const totalBalance = totalActualHours - totalExpectedHours;
  
  console.log(`\n💰 Final totals:`);
  console.log(`   Total Actual: ${totalActualHours.toFixed(2)}h`);
  console.log(`   Total Expected: ${totalExpectedHours.toFixed(2)}h`);
  console.log(`   Balance (monte_ore): ${totalBalance.toFixed(2)}h`);
  console.log(`\n🎯 Expected balance should be: -0.2h (negative!)\n`);
  
  if (Math.abs(totalBalance - (-0.2)) > 0.1) {
    console.log(`❌ PROBLEMA: Il balance è ${totalBalance.toFixed(2)}h invece di -0.2h!`);
  }
}

testHoursBalance().catch(console.error);
