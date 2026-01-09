
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMichele() {
    console.log('--- Searching for Michele ---');
    const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .ilike('first_name', '%Michele%');
    console.log(users);

    if (users && users.length > 0) {
        const micheleId = users[0].id;

        console.log(`\n--- RECOVERY REQUESTS for ${users[0].first_name} ---`);
        const { data: requests } = await supabase
            .from('recovery_requests')
            .select('*')
            .eq('user_id', micheleId)
            .order('submitted_at', { ascending: false });
        console.log(requests);

        console.log(`\n--- RECENT ATTENDANCE for ${users[0].first_name} ---`);
        const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', micheleId)
            .order('date', { ascending: false })
            .limit(10);
        console.log(attendance);
    }
}

checkMichele().catch(console.error);
