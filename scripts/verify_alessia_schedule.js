
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchedule() {
    console.log('🔍 Verifying schedule for Alessia Pasqui...');

    const { data: users } = await supabase
        .from('users')
        .select('id')
        .ilike('first_name', 'Alessia')
        .ilike('last_name', 'Pasqui')
        .limit(1);

    if (!users || users.length === 0) {
        console.error('❌ User not found');
        return;
    }

    const userId = users[0].id;

    const { data: schedules, error } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('user_id', userId)
        .order('day_of_week');

    if (error) {
        console.error('❌ Error fetching schedules:', error);
        return;
    }

    console.log('📅 Current Schedule:');
    schedules.forEach(s => {
        console.log(`Day ${s.day_of_week}: ${s.is_working_day ? '✅ Working' : '❌ Off'} - ${s.start_time || 'N/A'} to ${s.end_time || 'N/A'} (Break: ${s.break_duration}m at ${s.break_start_time})`);
    });
}

verifySchedule();
