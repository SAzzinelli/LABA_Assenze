
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSchedule() {
    console.log('🔍 Looking for Alessia Pasqui...');

    // 1. Find the user
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .ilike('first_name', 'Alessia')
        .ilike('last_name', 'Pasqui');

    if (userError) {
        console.error('❌ Error fetching user:', userError);
        return;
    }

    if (!users || users.length === 0) {
        console.error('❌ User Alessia Pasqui not found.');
        return;
    }

    const user = users[0];
    console.log(`✅ Found user: ${user.first_name} ${user.last_name} (${user.id})`);

    // 2. Define the new schedule
    // Mon-Fri: 09:00 - 17:00 (7h work + 1h break 13-14)
    // Sat: 09:00 - 14:00 (5h work, no break)
    // Sun: Off

    const schedules = [
        // Sunday (0)
        {
            user_id: user.id,
            day_of_week: 0,
            is_working_day: false,
            work_type: 'full_day',
            start_time: null,
            end_time: null,
            break_duration: 0,
            break_start_time: null
        },
        // Monday (1)
        {
            user_id: user.id,
            day_of_week: 1,
            is_working_day: true,
            work_type: 'full_day',
            start_time: '09:00',
            end_time: '17:00',
            break_duration: 60,
            break_start_time: '13:00'
        },
        // Tuesday (2)
        {
            user_id: user.id,
            day_of_week: 2,
            is_working_day: true,
            work_type: 'full_day',
            start_time: '09:00',
            end_time: '17:00',
            break_duration: 60,
            break_start_time: '13:00'
        },
        // Wednesday (3)
        {
            user_id: user.id,
            day_of_week: 3,
            is_working_day: true,
            work_type: 'full_day',
            start_time: '09:00',
            end_time: '17:00',
            break_duration: 60,
            break_start_time: '13:00'
        },
        // Thursday (4)
        {
            user_id: user.id,
            day_of_week: 4,
            is_working_day: true,
            work_type: 'full_day',
            start_time: '09:00',
            end_time: '17:00',
            break_duration: 60,
            break_start_time: '13:00'
        },
        // Friday (5)
        {
            user_id: user.id,
            day_of_week: 5,
            is_working_day: true,
            work_type: 'full_day',
            start_time: '09:00',
            end_time: '17:00',
            break_duration: 60,
            break_start_time: '13:00'
        },
        // Saturday (6)
        {
            user_id: user.id,
            day_of_week: 6,
            is_working_day: true,
            work_type: 'full_day',
            start_time: '09:00',
            end_time: '14:00',
            break_duration: 0,
            break_start_time: null
        }
    ];

    // 3. Delete existing schedules
    console.log('🗑️ Deleting existing schedules...');
    const { error: deleteError } = await supabase
        .from('work_schedules')
        .delete()
        .eq('user_id', user.id);

    if (deleteError) {
        console.error('❌ Error deleting schedules:', deleteError);
        return;
    }

    // 4. Insert new schedules
    console.log('📝 Inserting new schedules...');
    const { error: insertError } = await supabase
        .from('work_schedules')
        .insert(schedules);

    if (insertError) {
        console.error('❌ Error inserting schedules:', insertError);
        return;
    }

    // 5. Update user weekly_hours just in case (7*5 + 5 = 40h)
    const { error: updateError } = await supabase
        .from('users')
        .update({ weekly_hours: 40 })
        .eq('id', user.id);

    if (updateError) {
        console.error('❌ Error updating user weekly_hours:', updateError);
    }

    console.log('✅ Specific schedule update completed successfully!');
}

fixSchedule();
