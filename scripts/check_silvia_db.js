
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSilviaSchedule() {
    const { data: user } = await supabase.from('users').select('id, name').ilike('name', '%Silvia Nardi%').single();
    if (!user) {
        console.log('User not found');
        return;
    }
    console.log('User:', user.name, 'ID:', user.id);

    const { data: schedules } = await supabase.from('work_schedules').select('*').eq('user_id', user.id).order('day_of_week');
    console.log('Schedules:', JSON.stringify(schedules, null, 2));
}

checkSilviaSchedule();
