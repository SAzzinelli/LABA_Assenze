const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addMissingColumns() {
  try {
    console.log('🔧 Adding all missing columns to leave_requests table...');
    
    // Prima controlla la struttura attuale
    const { data: existingData, error: selectError } = await supabase
      .from('leave_requests')
      .select('*')
      .limit(1);

    if (selectError) {
      console.log('📋 Current table structure error:', selectError.message);
    } else {
      console.log('📋 Current table has data:', existingData.length > 0);
    }

    // Prova a inserire un record con tutti i campi per vedere quali mancano
    console.log('🧪 Testing insert with all possible columns...');
    
    const testRecord = {
      user_id: '00000000-0000-0000-0000-000000000000',
      type: 'permission',
      start_date: '2025-01-08',
      end_date: '2025-01-08',
      reason: 'Test',
      notes: 'Test notes',
      doctor: 'Test doctor',
      status: 'pending',
      submitted_at: new Date().toISOString(),
      permission_type: 'entrata_posticipata',
      hours: 1.0,
      entry_time: '10:00',
      exit_time: null
    };

    const { data: testInsert, error: insertError } = await supabase
      .from('leave_requests')
      .insert(testRecord)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Insert failed - missing columns detected:');
      console.log('Error:', insertError.message);
      
      // Analizza l'errore per capire quali colonne mancano
      const errorMessage = insertError.message;
      
      if (errorMessage.includes('notes')) {
        console.log('❌ Missing: notes column');
      }
      if (errorMessage.includes('doctor')) {
        console.log('❌ Missing: doctor column');
      }
      if (errorMessage.includes('permission_type')) {
        console.log('❌ Missing: permission_type column');
      }
      if (errorMessage.includes('hours')) {
        console.log('❌ Missing: hours column');
      }
      if (errorMessage.includes('entry_time')) {
        console.log('❌ Missing: entry_time column');
      }
      if (errorMessage.includes('exit_time')) {
        console.log('❌ Missing: exit_time column');
      }
      
      console.log('\n💡 You need to add these columns to your Supabase database:');
      console.log('   ALTER TABLE leave_requests ADD COLUMN notes TEXT;');
      console.log('   ALTER TABLE leave_requests ADD COLUMN doctor TEXT;');
      console.log('   ALTER TABLE leave_requests ADD COLUMN permission_type VARCHAR(50);');
      console.log('   ALTER TABLE leave_requests ADD COLUMN hours DECIMAL(4,2) DEFAULT 0;');
      console.log('   ALTER TABLE leave_requests ADD COLUMN entry_time TIME;');
      console.log('   ALTER TABLE leave_requests ADD COLUMN exit_time TIME;');
      
    } else {
      console.log('✅ All columns exist! Insert successful');
      
      // Cancella il record di test
      await supabase
        .from('leave_requests')
        .delete()
        .eq('id', testInsert.id);
      
      console.log('🧹 Test record cleaned up');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

addMissingColumns();
