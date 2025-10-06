const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQL() {
  try {
    console.log('🔧 Checking leave_requests table structure...');
    
    // Prima verifica la struttura attuale della tabella
    const { data: testData, error: testError } = await supabase
      .from('leave_requests')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('❌ Error checking table structure:', testError);
      console.log('This might indicate missing columns');
      return;
    }

    console.log('✅ Table structure check passed');
    console.log('Current columns:', testData.length > 0 ? Object.keys(testData[0]) : 'No data to check columns');
    
    // Prova a inserire un record di test per verificare le colonne
    console.log('🧪 Testing insert with new columns...');
    
    const { data: testInsert, error: insertError } = await supabase
      .from('leave_requests')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // UUID fittizio per test
        type: 'permission',
        start_date: '2025-01-08',
        end_date: '2025-01-08',
        reason: 'Test',
        notes: 'Test insert',
        status: 'pending',
        submitted_at: new Date().toISOString(),
        permission_type: 'entrata_posticipata',
        hours: 1.0,
        entry_time: '10:00',
        exit_time: null
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
      console.log('This confirms that the columns are missing');
      
      // Se l'inserimento fallisce, le colonne non esistono
      console.log('💡 You need to add these columns to your Supabase database:');
      console.log('   - permission_type VARCHAR(50)');
      console.log('   - hours DECIMAL(4,2) DEFAULT 0');
      console.log('   - exit_time TIME');
      console.log('   - entry_time TIME');
      return;
    }

    console.log('✅ Insert test successful - columns exist!');
    
    // Cancella il record di test
    await supabase
      .from('leave_requests')
      .delete()
      .eq('id', testInsert.id);
    
    console.log('🧹 Test record cleaned up');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

executeSQL();
