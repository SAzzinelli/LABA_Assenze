
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

// Import the same calculation logic as the client (simplified version for Node)
// Since we can't easily import ES modules from client in this script without Babel/setup,
// I will replicate the key logic of calculateRealTimeHours here to verify.

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

function calculateRealTimeHours(schedule, currentTimeStr) {
    if (!schedule || !schedule.start_time || !schedule.end_time) return { status: 'not_started' };

    const today = new Date().toISOString().split('T')[0];
    const parseTime = (t) => new Date(`${today}T${t}`);

    const now = parseTime(currentTimeStr);
    const start = parseTime(schedule.start_time);
    const end = parseTime(schedule.end_time);

    // Calculate break
    let breakStart, breakEnd;
    const breakDuration = schedule.break_duration || 0;

    if (breakDuration > 0) {
        if (schedule.break_start_time) {
            breakStart = parseTime(schedule.break_start_time);
            breakEnd = new Date(breakStart.getTime() + breakDuration * 60000);
        } else {
            // Auto-calc logic from hoursCalculation.js
            const totalMs = end - start;
            const midMs = start.getTime() + (totalMs / 2);
            const breakStartMs = midMs - (breakDuration * 60000 / 2);
            breakStart = new Date(breakStartMs);
            breakEnd = new Date(breakStartMs + breakDuration * 60000);
        }
    }

    if (now < start) return { status: 'not_started' };
    if (now > end) return { status: 'completed' };

    if (breakStart && breakEnd && now >= breakStart && now < breakEnd) {
        return { status: 'on_break', breakStart, breakEnd };
    }

    return { status: 'working' };
}

async function verify() {
    console.log('🔍 Verifying Gloria Wan status...');

    // 1. Get Gloria
    const { data: users } = await supabase
        .from('users')
        .select('id')
        .ilike('last_name', '%Wan%')
        .single();

    if (!users) { console.log('❌ Gloria not found'); return; }

    const userId = users.id;

    // 2. Get Today's Schedule (Assuming today is a working day for testing, e.g., Monday)
    // We'll check all days to be sure
    const { data: schedules } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('user_id', userId);

    console.log(`📅 Found ${schedules.length} schedule entries for Gloria.`);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    schedules.sort((a, b) => a.day_of_week - b.day_of_week).forEach(s => {
        console.log(`${days[s.day_of_week]}: ${s.is_working_day ? 'Working' : 'Off'} (${s.start_time}-${s.end_time}, Break: ${s.break_duration})`);

        if (s.is_working_day) {
            // Test at 12:00 (Should be Working)
            const test12 = calculateRealTimeHours(s, '12:00:00');
            console.log(`   Detailed Test 12:00 -> ${test12.status}`);

            // Test at 14:30 (Should be On Break - since break is 14:00-15:00)
            const test1430 = calculateRealTimeHours(s, '14:30:00');
            console.log(`   Detailed Test 14:30 -> ${test1430.status}`);

            // Test at 16:00 (Should be Working)
            const test16 = calculateRealTimeHours(s, '16:00:00');
            console.log(`   Detailed Test 16:00 -> ${test16.status}`);
        }
    });
}

verify().catch(console.error);
