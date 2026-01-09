
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- USERS ---');
    const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .or('last_name.eq.Spallarossa,last_name.eq.Nardi-Dei,first_name.eq.Alessia');
    console.log(users);

    if (users && users.length > 0) {
        for (const user of users) {
            const { data: attendance } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', '2025-12-01')
                .order('date', { ascending: true });

            console.log(`\n--- ATTENDANCE for ${user.first_name} ${user.last_name} (${user.id}) ---`);
            console.log(attendance ? attendance.slice(0, 5) : 'No data'); // Show first 5 to verify
            if (attendance && attendance.length > 5) {
                console.log(`... and ${attendance.length - 5} more records`);
            }
        }
    }
}

checkData().catch(console.error);
