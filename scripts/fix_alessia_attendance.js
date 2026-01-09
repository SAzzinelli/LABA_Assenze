
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAttendance() {
    console.log('🛠️ Fixing attendance records for Alessia Pasqui...');

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

    const { data: records, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .order('date');

    if (error) {
        console.error('❌ Error fetching attendance:', error);
        return;
    }

    let updatesCount = 0;

    for (const r of records) {
        const date = new Date(r.date);
        const day = date.getDay(); // 0=Sun, 6=Sat

        let correctExpected = 0;
        if (day >= 1 && day <= 5) correctExpected = 7;
        else if (day === 6) correctExpected = 5;
        else if (day === 0) correctExpected = 0;

        // Determine if update is needed
        // We update if expected_hours is wrong
        const needsUpdate = Math.abs(r.expected_hours - correctExpected) > 0.1;

        if (needsUpdate) {
            let newActual = r.actual_hours;

            // If actual was equal to the WRONG expected (e.g. 8), assume it was a full day and correct it to NEW expected (e.g. 7)
            // If actual was 0 or something else, likely leave it alone or handle specific cases?
            // Assuming default auto-generated attendance was full day -> 8h.
            if (Math.abs(r.actual_hours - 8.0) < 0.1) {
                newActual = correctExpected;
            }

            const newBalance = newActual - correctExpected;

            console.log(`✏️ Updating ${r.date}: Expected ${r.expected_hours}->${correctExpected}, Actual ${r.actual_hours}->${newActual}`);

            const { error: updateError } = await supabase
                .from('attendance')
                .update({
                    expected_hours: correctExpected,
                    actual_hours: newActual,
                    balance_hours: newBalance
                })
                .eq('id', r.id);

            if (updateError) console.error(`❌ Failed to update ${r.date}:`, updateError);
            else updatesCount++;
        }
    }

    console.log(`✅ Fixed ${updatesCount} records.`);
}

fixAttendance();
