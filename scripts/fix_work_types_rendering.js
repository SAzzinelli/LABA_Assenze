
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixWorkTypes() {
    console.log('🔄 Fixing work_types for Silvia and Alessia...');

    const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .or('last_name.eq.Nardi-Dei,first_name.eq.Alessia');

    const silvia = users.find(u => u.last_name === 'Nardi-Dei');
    const alessia = users.find(u => u.first_name === 'Alessia');

    if (silvia) {
        console.log(`👤 Fixing Silvia (${silvia.id})...`);
        for (const day of [2, 3, 5]) { // Mar, Mer, Ven: Morning only
            await supabase
                .from('work_schedules')
                .update({ work_type: 'morning' })
                .match({ user_id: silvia.id, day_of_week: day });
        }
        for (const day of [1, 4]) { // Lun, Gio: Full day
            await supabase
                .from('work_schedules')
                .update({ work_type: 'full_day' })
                .match({ user_id: silvia.id, day_of_week: day });
        }
    }

    if (alessia) {
        console.log(`👤 Fixing Alessia (${alessia.id})...`);
        // Alessia Sat (6) is morning only (continuous 9-14)
        await supabase
            .from('work_schedules')
            .update({ work_type: 'morning' })
            .match({ user_id: alessia.id, day_of_week: 6 });

        // Alessia Mon-Fri (1-5) are full days
        for (const day of [1, 2, 3, 4, 5]) {
            await supabase
                .from('work_schedules')
                .update({ work_type: 'full_day' })
                .match({ user_id: alessia.id, day_of_week: day });
        }
    }

    console.log('✅ Fix completed.');
}

fixWorkTypes().catch(console.error);
