
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttendance() {
    console.log('🔍 Checking attendance records for Alessia Pasqui...');

    // 1. Find the user
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

    // 2. Fetch attendance records
    const { data: records, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .order('date');

    if (error) {
        console.error('❌ Error fetching attendance:', error);
        return;
    }

    console.log(`found ${records.length} records.`);

    // Correct schedule for calculation check
    // Mon-Fri: 7h
    // Sat: 5h
    // Sun: 0h

    records.forEach(r => {
        const date = new Date(r.date);
        const day = date.getDay(); // 0=Sun, 6=Sat

        let correctExpected = 0;
        if (day >= 1 && day <= 5) correctExpected = 7;
        else if (day === 6) correctExpected = 5;

        const isDiscrepancy = Math.abs(r.expected_hours - correctExpected) > 0.1;

        if (isDiscrepancy) {
            console.log(`⚠️ DISCREPANCY on ${r.date} (${['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][day]}): ` +
                `Stored Expected: ${r.expected_hours}h | Should be: ${correctExpected}h | ` +
                `Actual: ${r.actual_hours}h | Balance: ${r.balance_hours}h`);
        } else {
            // console.log(`✅ OK on ${r.date}: Expected ${r.expected_hours}h`);
        }
    });
}

checkAttendance();
