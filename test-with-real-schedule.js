require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testWithRealSchedule() {
  console.log('🔍 Testing with REAL schedule from database...\n');
  
  const { data: users } = await supabase.from('users').select('id, first_name').ilike('first_name', 'simone').neq('role', 'admin');
  if (!users || users.length === 0) return;
  
  const userId = users[0].id;
  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5);
  const dayOfWeek = now.getDay();
  
  console.log(`⏰ Current time: ${currentTime}, Day: ${dayOfWeek}\n`);
  
  // Get REAL schedule
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
  
  console.log('📋 Schedule from DB:');
  console.log(`   start_time: ${schedule.start_time}`);
  console.log(`   end_time: ${schedule.end_time}`);
  console.log(`   break_duration: ${schedule.break_duration}`);
  console.log(`   break_start_time: ${schedule.break_start_time || 'null (auto)'}\n`);
  
  // Test at 17:00
  console.log('🧪 Testing at 17:00:');
  const result17 = calculateRealTimeHours(schedule, '17:00', null);
  console.log(`   Expected: ${result17.expectedHours}h`);
  console.log(`   Actual: ${result17.actualHours}h`);
  console.log(`   Balance: ${result17.balanceHours}h\n`);
  
  // Test at current time
  console.log(`🧪 Testing at current time (${currentTime}):`);
  const resultNow = calculateRealTimeHours(schedule, currentTime, null);
  console.log(`   Expected: ${resultNow.expectedHours}h`);
  console.log(`   Actual: ${resultNow.actualHours}h`);
  console.log(`   Balance: ${resultNow.balanceHours}h\n`);
  
  // Manual calculation
  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  const breakStart = schedule.break_start_time ? schedule.break_start_time.split(':').map(Number) : null;
  const breakDuration = schedule.break_duration || 60;
  
  console.log('🧮 Manual calculation for 17:00:');
  if (breakStart) {
    const [breakStartHour, breakStartMin] = breakStart;
    const breakEndMin = (breakStartHour * 60 + breakStartMin) + breakDuration;
    const breakEndHour = Math.floor(breakEndMin / 60);
    const breakEndMinFinal = breakEndMin % 60;
    
    console.log(`   Morning: ${startHour}:${startMin.toString().padStart(2, '0')} - ${breakStartHour}:${breakStartMin.toString().padStart(2, '0')} = ${(breakStartHour * 60 + breakStartMin) - (startHour * 60 + startMin)} min`);
    console.log(`   Break: ${breakStartHour}:${breakStartMin.toString().padStart(2, '0')} - ${breakEndHour}:${breakEndMinFinal.toString().padStart(2, '0')} (${breakDuration} min)`);
    console.log(`   Afternoon: ${breakEndHour}:${breakEndMinFinal.toString().padStart(2, '0')} - 17:00 = ${(17 * 60) - (breakEndHour * 60 + breakEndMinFinal)} min`);
    
    const morningMinutes = (breakStartHour * 60 + breakStartMin) - (startHour * 60 + startMin);
    const afternoonMinutes = (17 * 60) - (breakEndHour * 60 + breakEndMinFinal);
    const totalMinutes = morningMinutes + afternoonMinutes;
    console.log(`   Total: ${totalMinutes} min = ${totalMinutes / 60}h\n`);
  }
  
  // Check what's in DB
  const today = now.toISOString().split('T')[0];
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();
  
  if (attendance) {
    console.log('📊 DB Record:');
    console.log(`   expected_hours: ${attendance.expected_hours}h`);
    console.log(`   actual_hours: ${attendance.actual_hours}h`);
    console.log(`   balance_hours: ${attendance.balance_hours}h\n`);
    
    if (Math.abs(attendance.actual_hours - resultNow.actualHours) > 0.1) {
      console.log('❌ PROBLEMA: DB ha valori diversi dal calcolo real-time!');
      console.log(`   DB: ${attendance.actual_hours}h, Real-time: ${resultNow.actualHours}h\n`);
    }
  }
}

testWithRealSchedule().catch(console.error);
