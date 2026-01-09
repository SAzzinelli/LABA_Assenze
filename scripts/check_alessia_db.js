
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlessia() {
    const { data: user } = await supabase.from('users').select('*').ilike('first_name', 'Alessia').single();
    if (!user) {
        console.log('Alessia not found');
        return;
    }
    console.log('User:', user.first_name, user.last_name, 'Weekly Hours:', user.weekly_hours);

    const { data: schedules } = await supabase.from('work_schedules').select('*').eq('user_id', user.id).order('day_of_week');
    console.log('Schedules:', JSON.stringify(schedules, null, 2));

    const { data: silvia } = await supabase.from('users').select('*').ilike('last_name', 'Nardi-Dei').single();
    if (silvia) {
        console.log('Silvia Weekly Hours:', silvia.weekly_hours);
    }
}

checkAlessia();
