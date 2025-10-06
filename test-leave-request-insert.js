const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeaveRequestInsert() {
  try {
    console.log('🧪 Testing leave request insert...');
    
    // Prima ottieni un user_id valido
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'simone.azzinelli@labafirenze.com')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error('❌ User not found:', userError);
      return;
    }

    const userId = users[0].id;
    console.log('✅ Found user:', users[0].email, 'ID:', userId);

    // Calcola i giorni richiesti
    const start = new Date('2025-01-08');
    const end = new Date('2025-01-08');
    const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Prova l'inserimento con tutti i campi
    const insertData = {
      user_id: userId,
      type: 'permission',
      start_date: '2025-01-08',
      end_date: '2025-01-08',
      reason: 'Test permission',
      notes: 'Test richiesta permesso per entrata posticipata alle 10:00',
      doctor: null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      days_requested: daysRequested,
      permission_type: 'entrata_posticipata',
      hours: 1.0,
      entry_time: '10:00',
      exit_time: null
    };

    console.log('🔧 Inserting with data:', JSON.stringify(insertData, null, 2));

    const { data: newRequest, error } = await supabase
      .from('leave_requests')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('❌ Insert failed:', error);
      return;
    }

    console.log('✅ Insert successful!');
    console.log('📝 Created request:', newRequest);

    // Ora prova a creare le notifiche
    console.log('🔔 Testing notification creation...');
    
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('role', 'admin');

    if (adminError) {
      console.error('❌ Admin fetch failed:', adminError);
      return;
    }

    console.log('✅ Found admins:', admins.length);

    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title: 'Nuova richiesta Permesso',
      message: `Simone Azzinelli ha richiesto Permesso dal 2025-01-08 al 2025-01-08`,
      type: 'request',
      request_id: newRequest.id,
      request_type: 'permission',
      is_read: false,
      created_at: new Date().toISOString()
    }));

    console.log('🔧 Creating notifications:', notifications.length);

    const { data: notificationsResult, error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('❌ Notification creation failed:', notificationError);
      return;
    }

    console.log('✅ Notifications created successfully!');

    // Cancella il record di test
    await supabase
      .from('leave_requests')
      .delete()
      .eq('id', newRequest.id);
    
    console.log('🧹 Test record cleaned up');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testLeaveRequestInsert();
