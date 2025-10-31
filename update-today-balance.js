require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

const { calculateExpectedHoursForSchedule } = require('./server/utils/hoursCalculation');

async function updateToday() {
  // Trova Simone
  const { data: users } = await supabase.from('users').select('id, first_name').ilike('first_name', 'simone');
  if (!users || users.length === 0) return;
  
  const userId = users[0].id;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const dayOfWeek = now.getDay();
  
  // Ottieni schedule
  const { data: schedules } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_working_day', true)
    .single();
  
  if (!schedules) {
    console.log('Nessun schedule per oggi');
    return;
  }
  
  const { start_time, end_time, break_duration, break_start_time } = schedules;
  const expectedHours = calculateExpectedHoursForSchedule({ start_time, end_time, break_duration });
  
  // Calcola actual hours usando la stessa logica corretta
  const [startHour, startMin] = start_time.split(':').map(Number);
  const [endHour, endMin] = end_time.split(':').map(Number);
  
  let actualHours = 0;
  if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
    actualHours = 0;
  } else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
    actualHours = expectedHours;
  } else {
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    const effectiveStartTimeObj = new Date(`2000-01-01T${start_time}`);
    const effectiveEndTimeObj = new Date(`2000-01-01T${end_time}`);
    const currentTimeObj = new Date(`2000-01-01T${currentTime}`);
    
    // Calcola pausa pranzo
    let breakStartTimeStr, breakEndTimeStr;
    if (break_start_time) {
      const [breakStartHour, breakStartMin] = break_start_time.split(':').map(Number);
      breakStartTimeStr = break_start_time;
      const breakEndTimeMinutes = (breakStartHour * 60 + breakStartMin) + (break_duration || 60);
      const breakEndHour = Math.floor(breakEndTimeMinutes / 60);
      const breakEndMin = breakEndTimeMinutes % 60;
      breakEndTimeStr = `${breakEndHour.toString().padStart(2, '0')}:${breakEndMin.toString().padStart(2, '0')}`;
    } else {
      const startTotalMinutes = startHour * 60 + startMin;
      const endTotalMinutes = endHour * 60 + endMin;
      const totalMinutes = endTotalMinutes - startTotalMinutes;
      const breakDurationMins = break_duration || 60;
      const halfPointMinutes = startTotalMinutes + (totalMinutes / 2);
      const breakStartMinutes = halfPointMinutes - (breakDurationMins / 2);
      const breakEndMinutes = breakStartMinutes + breakDurationMins;
      const breakStartHour = Math.floor(breakStartMinutes / 60) % 24;
      const breakStartMin = Math.floor(breakStartMinutes % 60);
      const breakEndHour = Math.floor(breakEndMinutes / 60) % 24;
      const breakEndMin = Math.floor(breakEndMinutes % 60);
      breakStartTimeStr = `${breakStartHour.toString().padStart(2, '0')}:${breakStartMin.toString().padStart(2, '0')}`;
      breakEndTimeStr = `${breakEndHour.toString().padStart(2, '0')}:${breakEndMin.toString().padStart(2, '0')}`;
    }
    
    const breakStartTime = new Date(`2000-01-01T${breakStartTimeStr}`);
    const breakEndTime = new Date(`2000-01-01T${breakEndTimeStr}`);
    
    if (currentTimeObj >= breakStartTime && currentTimeObj < breakEndTime) {
      actualHours = (breakStartTime - effectiveStartTimeObj) / (1000 * 60) / 60;
    } else if (currentTimeObj >= breakEndTime) {
      const morningMinutes = (breakStartTime - effectiveStartTimeObj) / (1000 * 60);
      const afternoonMinutes = (currentTimeObj - breakEndTime) / (1000 * 60);
      actualHours = (morningMinutes + afternoonMinutes) / 60;
    } else {
      const workedMinutes = (currentTimeObj - effectiveStartTimeObj) / (1000 * 60);
      actualHours = workedMinutes / 60;
    }
  }
  
  const balanceHours = actualHours - expectedHours;
  
  console.log(`Oggi ${today} alle ${currentHour}:${currentMinute.toString().padStart(2, '0')}:`);
  console.log(`  Expected: ${expectedHours.toFixed(2)}h`);
  console.log(`  Actual: ${actualHours.toFixed(2)}h`);
  console.log(`  Balance: ${balanceHours.toFixed(2)}h`);
  
  // Aggiorna il database
  const { error } = await supabase
    .from('attendance')
    .upsert({
      user_id: userId,
      date: today,
      expected_hours: Math.round(expectedHours * 10) / 10,
      actual_hours: Math.round(actualHours * 10) / 10,
      balance_hours: Math.round(balanceHours * 10) / 10,
      notes: `Aggiornato con calcolo corretto pausa pranzo`
    }, {
      onConflict: 'user_id,date'
    });
  
  if (error) {
    console.error('❌ Errore:', error);
  } else {
    console.log('✅ Aggiornato nel database');
  }
}

updateToday();
