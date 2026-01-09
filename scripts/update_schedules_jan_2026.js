
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSchedules() {
    console.log('🔄 Starting schedule updates for Jan 2026 requests...');

    // 1. Find Users
    // finding Silvia by email or last name (using variations to be safe)
    // finding Alessia by first name and likely last name Pasqui
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .or('email.eq.silvia.nardidei@labafirenze.com,last_name.eq.Nardi-Dei,first_name.eq.Alessia');

    if (userError) {
        console.error('❌ Error finding users:', userError);
        return;
    }

    const silvia = users.find(u => u.last_name === 'Nardi-Dei' || u.email.includes('silvia.nardidei'));
    const alessia = users.find(u => u.first_name === 'Alessia'); // Assuming only one Alessia or the main one we know

    if (!silvia) console.error('❌ Silvia Nardi-Dei not found');
    if (!alessia) console.error('❌ Alessia not found');

    if (silvia) {
        console.log(`👤 Found Silvia Nardi-Dei (${silvia.id})`);
        await updateSilviaSchedule(silvia.id);
    }

    if (alessia) {
        console.log(`👤 Found Alessia (${alessia.id})`);
        await updateAlessiaSchedule(alessia.id);
    }
}

async function updateSilviaSchedule(userId) {
    // Silvia Nardi-Dei:
    // Lun (1), Gio (4): 9-18, break 13-14 (60m). (INVERTED from previous request which was morning only)
    // Mar (2), Mer (3), Ven (5): 9-13. No break. (INVERTED from previous request which was full day)
    // Sab (6): Off.

    console.log('Updating Silvia schedule...');
    const days = [0, 1, 2, 3, 4, 5, 6];

    for (const day of days) {
        let schedule = {
            user_id: userId,
            day_of_week: day,
            is_working_day: false,
            work_type: 'full_day',
            start_time: null,
            end_time: null,
            break_duration: 0,
            break_start_time: null
        };

        if (day === 1 || day === 4) { // Lun, Gio: Full day 9-18
            schedule.is_working_day = true;
            schedule.start_time = '09:00';
            schedule.end_time = '18:00';
            schedule.break_duration = 60;
            schedule.break_start_time = '13:00';
        } else if (day === 2 || day === 3 || day === 5) { // Mar, Mer, Ven: Morning 9-13
            schedule.is_working_day = true;
            schedule.start_time = '09:00';
            schedule.end_time = '13:00';
            schedule.break_duration = 0;
            schedule.break_start_time = null;
        }

        const { error } = await supabase
            .from('work_schedules')
            .upsert(schedule, { onConflict: 'user_id,day_of_week' });

        if (error) {
            console.error(`❌ Error updating Silvia day ${day}:`, error);
        } else {
            // console.log(`✅ Updated Silvia day ${day}`);
        }
    }
    console.log('✅ Silvia Nardi-Dei schedule updated.');
}

async function updateAlessiaSchedule(userId) {
    // Alessia:
    // Lun-Ven: 9-17, break 13-14. (Standard)
    // Sab: 9-14. NO BREAK.

    console.log('Updating Alessia schedule...');
    const days = [0, 1, 2, 3, 4, 5, 6];

    for (const day of days) {
        let schedule = {
            user_id: userId,
            day_of_week: day,
            is_working_day: false,
            work_type: 'full_day',
            start_time: null,
            end_time: null,
            break_duration: 0,
            break_start_time: null
        };

        if (day >= 1 && day <= 5) { // Mon-Fri
            schedule.is_working_day = true;
            schedule.start_time = '09:00';
            schedule.end_time = '17:00';
            schedule.break_duration = 60;
            schedule.break_start_time = '13:00';
        } else if (day === 6) { // Sat
            schedule.is_working_day = true;
            schedule.start_time = '09:00';
            schedule.end_time = '14:00';
            schedule.break_duration = 0; // "diritta senza pausa"
            schedule.break_start_time = null;
        }

        const { error } = await supabase
            .from('work_schedules')
            .upsert(schedule, { onConflict: 'user_id,day_of_week' });

        if (error) {
            console.error(`❌ Error updating Alessia day ${day}:`, error);
        } else {
            // console.log(`✅ Updated Alessia day ${day}`);
        }
    }
    console.log('✅ Alessia schedule updated.');
}

updateSchedules().catch(console.error);
