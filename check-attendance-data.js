require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  // Trova Simone
  const { data: users } = await supabase.from('users').select('id, first_name, last_name').ilike('first_name', 'simone');
  if (!users || users.length === 0) {
    console.log('❌ Utente non trovato');
    return;
  }
  
  const userId = users[0].id;
  console.log(`👤 Utente: ${users[0].first_name} ${users[0].last_name}`);
  
  // Ottieni record di ottobre 2025
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .gte('date', '2025-10-01')
    .lte('date', '2025-10-31')
    .order('date');
  
  console.log(`\n📊 Record trovati: ${attendance?.length || 0}`);
  attendance?.forEach(record => {
    console.log(`${record.date}: actual=${record.actual_hours}h, expected=${record.expected_hours}h, balance=${record.balance_hours}h`);
  });
  
  // Ottieni schedules
  const { data: schedules } = await supabase
    .from('work_schedules')
    .select('*')
    .eq('user_id', userId);
  
  console.log(`\n📅 Schedules:`);
  schedules?.forEach(s => {
    console.log(`  Day ${s.day_of_week}: ${s.start_time}-${s.end_time}, break=${s.break_duration}m, break_start=${s.break_start_time || 'auto'}`);
  });
}

checkData();
