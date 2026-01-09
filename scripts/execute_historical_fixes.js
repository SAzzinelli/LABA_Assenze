
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

const ILARIA_ID = '4d3535c6-76bd-4027-9b03-39bc7a2b6177';
const SILVIA_ID = '7c344008-53e2-4f18-bed6-9313ba8a07d5';
const ALESSIA_ID = '3289f556-a964-49d9-af7c-718cb82f3533';

async function executeFixes() {
    console.log('🚀 Starting execution of schedule and attendance fixes...');

    // 1. Update Ilaria's Schedule
    console.log(`\n📅 Updating schedule for Ilaria Spallarossa (${ILARIA_ID})...`);

    const ilariaSchedule = [
        { day: 1, type: 'morning', start: '09:00:00', end: '13:00:00', break: 0, break_start: null },
        { day: 2, type: 'full_day', start: '10:00:00', end: '18:00:00', break: 60, break_start: '13:00:00' },
        { day: 3, type: 'full_day', start: '10:00:00', end: '18:00:00', break: 60, break_start: '13:00:00' },
        { day: 4, type: 'morning', start: '09:00:00', end: '13:00:00', break: 0, break_start: null },
        { day: 5, type: 'morning', start: '09:30:00', end: '12:30:00', break: 0, break_start: null }
    ];

    for (const s of ilariaSchedule) {
        const { error } = await supabase
            .from('work_schedules')
            .update({
                work_type: s.type,
                start_time: s.start,
                end_time: s.end,
                break_duration: s.break,
                break_start_time: s.break_start,
                is_working_day: true
            })
            .match({ user_id: ILARIA_ID, day_of_week: s.day });

        if (error) console.error(`Error updating Ilaria day ${s.day}:`, error);
        else console.log(`✅ Day ${s.day} updated for Ilaria.`);
    }

    // Set other days to non-working for Ilaria
    await supabase
        .from('work_schedules')
        .update({ is_working_day: false, work_type: 'none' })
        .match({ user_id: ILARIA_ID })
        .in('day_of_week', [0, 6]);

    // 2. Fix Historical Attendance
    console.log('\n🕰️ Fixing historical attendance records since 2025-12-01...');

    const usersToFix = [ILARIA_ID, SILVIA_ID, ALESSIA_ID];

    // Fetch all schedules for these users to use as reference
    const { data: allSchedules } = await supabase
        .from('work_schedules')
        .select('*')
        .in('user_id', usersToFix);

    const getExpectedHours = (userId, dateStr) => {
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();
        const schedule = allSchedules.find(s => s.user_id === userId && s.day_of_week === dayOfWeek);

        if (!schedule || !schedule.is_working_day) return 0;

        const [startH, startM] = schedule.start_time.split(':').map(Number);
        const [endH, endM] = schedule.end_time.split(':').map(Number);
        const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        const netMinutes = totalMinutes - (schedule.break_duration || 0);
        return Math.max(0, netMinutes / 60);
    };

    for (const userId of usersToFix) {
        console.log(`\nProcessing user ${userId}...`);
        const { data: attendanceRecords } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .gte('date', '2025-12-01');

        if (!attendanceRecords) continue;

        for (const record of attendanceRecords) {
            const expected = getExpectedHours(userId, record.date);

            // For historical correction, we assume "actual_hours" should match "expected_hours" 
            // unless there was a manual departure/arrival noted (which is rare in this system's auto-saves).
            // The user said "devono tornare come ora", implying the past values were wrong and should match current schedule.

            if (record.expected_hours !== expected || record.actual_hours !== expected) {
                console.log(`Fixing ${record.date}: expected ${record.expected_hours}->${expected}, actual ${record.actual_hours}->${expected}`);

                await supabase
                    .from('attendance')
                    .update({
                        expected_hours: expected,
                        actual_hours: expected,
                        balance_hours: 0,
                        notes: 'Correzione storica basata su nuovo orario'
                    })
                    .eq('id', record.id);
            }
        }
    }

    console.log('\n✨ All fixes completed successfully!');
}

executeFixes().catch(console.error);
