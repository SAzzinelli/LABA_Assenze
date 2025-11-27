const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAlessia() {
    console.log('🔍 Searching for Alessia...');

    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .ilike('first_name', '%Alessia%');

    if (userError) {
        console.error('❌ User search error:', userError);
        return;
    }

    if (!users || users.length === 0) {
        console.log('❌ User Alessia not found');
        return;
    }

    const user = users[0];
    console.log(`✅ Found user: ${user.first_name} ${user.last_name} (${user.id})`);

    // 1. Check Work Schedules
    console.log('\n📅 Checking Work Schedules...');
    const { data: schedules, error: scheduleError } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week');

    if (scheduleError) {
        console.error('❌ Schedule error:', scheduleError);
    } else {
        schedules.forEach(s => {
            console.log(`   Day ${s.day_of_week}: Working=${s.is_working_day}, ${s.start_time}-${s.end_time}, Break=${s.break_duration}`);
        });
    }

    // 1.5 Check Hours Balance Table
    console.log('\n💰 Checking Hours Balance Table...');
    const { data: hb, error: hbError } = await supabase
        .from('hours_balance')
        .select('*')
        .eq('user_id', user.id);

    if (hbError) {
        console.error('❌ Hours Balance error:', hbError);
    } else {
        console.log('   Hours Balance records:', hb);
    }

    // 2. Check ALL Attendance
    console.log('\n📊 Checking ALL Attendance History...');

    const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('date');

    if (attError) {
        console.error('❌ Attendance error:', attError);
    } else {
        let totalActual = 0;
        let totalExpected = 0;
        let totalBalance = 0;
        let calculatedBalance = 0;

        console.log('   Date       | Actual | Expected | Balance (DB) | Calc Balance (Act-Exp)');
        console.log('   -----------|--------|----------|--------------|-----------------------');

        attendance.forEach(r => {
            const act = r.actual_hours || 0;
            const expDb = r.expected_hours;
            const expFixed = r.expected_hours !== null && r.expected_hours !== undefined ? r.expected_hours : 8;

            const balDb = r.balance_hours;
            const balCalc = act - expFixed;

            totalActual += act;
            totalExpected += expFixed;
            totalBalance += balDb || 0;
            calculatedBalance += balCalc;

            // Print if balance is non-zero or it's recent
            if (Math.abs(balDb) > 0.1 || r.date >= '2025-11-01') {
                console.log(`   ${r.date} | ${act.toFixed(2).padStart(6)} | ${String(expDb).padStart(8)} | ${String(balDb).padStart(12)} | ${balCalc.toFixed(2).padStart(21)}`);
            }
        });

        console.log('\n   TOTALS:');
        console.log(`   Actual: ${totalActual.toFixed(2)}`);
        console.log(`   Expected (Fixed): ${totalExpected.toFixed(2)}`);
        console.log(`   Balance (Sum of DB): ${totalBalance.toFixed(2)}`);
        console.log(`   Balance (Calculated): ${calculatedBalance.toFixed(2)}`);
    }
    // 3. Check Real-Time Calculation for Today
    console.log('\n⏱️ Checking Real-Time Calculation for Today...');
    const { calculateRealTimeHours } = require('../server/utils/hoursCalculation');

    const today = new Date();
    const dayOfWeek = today.getDay();
    console.log(`   Today is day ${dayOfWeek} (0=Sun, 1=Mon, ...)`);

    const todaySchedule = schedules.find(s => s.day_of_week === dayOfWeek);

    if (!todaySchedule) {
        console.log('   ❌ No schedule found for today!');
    } else {
        console.log('   ✅ Found schedule for today:', todaySchedule);

        const currentTime = today.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        console.log(`   Current Time: ${currentTime}`);

        const result = calculateRealTimeHours(todaySchedule, currentTime);
        console.log('   📊 Calculation Result:', JSON.stringify(result, null, 2));
    }
}

debugAlessia();
