const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentRequests() {
  try {
    console.log('🔍 Checking recent leave requests...');
    
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching requests:', error);
      return;
    }

    console.log(`✅ Found ${requests.length} recent requests:`);
    
    requests.forEach((request, index) => {
      console.log(`${index + 1}. ${request.type} - ${request.start_date} - ${request.status}`);
      console.log(`   Notes: ${request.notes}`);
      console.log(`   Created: ${request.created_at}`);
      console.log(`   User ID: ${request.user_id}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkRecentRequests();
