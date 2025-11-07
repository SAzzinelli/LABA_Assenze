const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  try {
    // Trova l'user ID di Simone
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('email', 'simone.azzinelli@labadvertising.it')
      .single();
    
    if (userError) {
      console.error('❌ User error:', userError);
      return;
    }
    
    console.log('👤 User:', user);
    
    if (user) {
      // Trova i suoi orari
      const { data: schedules, error: schedError } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week');
      
      if (schedError) {
        console.error('❌ Schedules error:', schedError);
        return;
      }
      
      console.log('\n📅 Work Schedules:', schedules?.length || 0, 'records');
      schedules?.forEach(s => {
        console.log(`  Day ${s.day_of_week}: ${s.start_time}-${s.end_time}, working=${s.is_working_day}, break=${s.break_duration}m`);
      });
      
      // Trova specificatamente venerdì (day 5)
      const friday = schedules?.find(s => s.day_of_week === 5);
      console.log('\n🔍 Friday (day=5) schedule:', friday || 'NOT FOUND ❌');
      
      // Controlla anche oggi
      const today = new Date();
      const dayOfWeek = today.getDay();
      console.log(`\n📆 Oggi è giorno ${dayOfWeek} (0=Dom, 5=Ven)`);
      
      const todaySchedule = schedules?.find(s => s.day_of_week === dayOfWeek);
      console.log(`🔍 Schedule per oggi (day=${dayOfWeek}):`, todaySchedule || 'NOT FOUND ❌');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();

