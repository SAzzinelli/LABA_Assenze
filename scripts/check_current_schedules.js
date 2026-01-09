
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchedules() {
    const ids = [
        '7c344008-53e2-4f18-bed6-9313ba8a07d5', // Silvia
        '4d3535c6-76bd-4027-9b03-39bc7a2b6177', // Ilaria
        '3289f556-a964-49d9-af7c-718cb82f3533'  // Alessia
    ];

    const { data: schedules } = await supabase
        .from('work_schedules')
        .select('*')
        .in('user_id', ids)
        .order('user_id', { ascending: true })
        .order('day_of_week', { ascending: true });

    console.log(JSON.stringify(schedules, null, 2));
}

checkSchedules().catch(console.error);
