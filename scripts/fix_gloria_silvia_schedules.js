
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSchedules() {
    console.log('🔄 Starting schedule fix for Gloria Wan and Silvia Nardi-Dei...');

    // 1. Find Users
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .or('email.eq.gloria.wan@labafirenze.com,email.eq.silvia.nardidei@labafirenze.com,last_name.eq.Nardi-Dei');

    if (userError) {
        console.error('❌ Error finding users:', userError);
        return;
    }

    const gloria = users.find(u => u.first_name === 'Gloria' || u.email.includes('gloria'));
    const silvia = users.find(u => u.last_name === 'Nardi-Dei' || u.email.includes('silvia.nardidei'));

    if (!gloria) console.error('❌ Gloria Wan not found');
    if (!silvia) console.error('❌ Silvia Nardi-Dei not found');

    if (gloria) {
        console.log(`👤 Found Gloria Wan (${gloria.id})`);
        await updateGloriaSchedule(gloria.id);
    }

    if (silvia) {
        console.log(`👤 Found Silvia Nardi-Dei (${silvia.id})`);
        await updateSilviaSchedule(silvia.id);
    }
}

async function updateGloriaSchedule(userId) {
    // Gloria: Lun-Ven 10-14 (work), 14-15 (break), 15-19 (work). Total 8h. Break 60m. Sat Off.
    // Start: 10:00, End: 19:00, Break: 60

    const days = [0, 1, 2, 3, 4, 5, 6]; // 0=Sun

    for (const day of days) {
        let schedule = {
            user_id: userId,
            day_of_week: day,
            is_working_day: false,
            work_type: 'full_day',
            start_time: null,
            end_time: null,
            break_duration: 0
        };

        if (day >= 1 && day <= 5) { // Mon-Fri
            schedule.is_working_day = true;
            schedule.start_time = '10:00';
            schedule.end_time = '19:00';
            schedule.break_duration = 60;
        }

        const { error } = await supabase
            .from('work_schedules')
            .upsert(schedule, { onConflict: 'user_id,day_of_week' });

        if (error) {
            console.error(`❌ Error updating Gloria day ${day}:`, error);
        } else {
            console.log(`✅ Updated Gloria day ${day}`);
        }
    }
}

async function updateSilviaSchedule(userId) {
    // Silvia Nardi-Dei:
    // Lun (1): 9-13. No break.
    // Mar (2): 9-18. Break 13-14 (60m).
    // Mer (3): 9-18. Break 13-14 (60m).
    // Gio (4): 9-13. No break.
    // Ven (5): 9-18. Break 13-14 (60m).
    // Sab (6): Off.

    const days = [0, 1, 2, 3, 4, 5, 6];

    for (const day of days) {
        let schedule = {
            user_id: userId,
            day_of_week: day,
            is_working_day: false,
            work_type: 'full_day',
            start_time: null,
            end_time: null,
            break_duration: 0
        };

        if (day === 1 || day === 4) { // Lun, Gio: 9-13, no break
            schedule.is_working_day = true;
            schedule.start_time = '09:00';
            schedule.end_time = '13:00';
            schedule.break_duration = 0;
            schedule.work_type = 'morning'; // Optional hint
        } else if (day === 2 || day === 3 || day === 5) { // Mar, Mer, Ven: 9-18, break 60
            schedule.is_working_day = true;
            schedule.start_time = '09:00';
            schedule.end_time = '18:00';
            schedule.break_duration = 60;
        }

        const { error } = await supabase
            .from('work_schedules')
            .upsert(schedule, { onConflict: 'user_id,day_of_week' });

        if (error) {
            console.error(`❌ Error updating Silvia day ${day}:`, error);
        } else {
            console.log(`✅ Updated Silvia day ${day}`);
        }
    }
}

fixSchedules().catch(console.error);
