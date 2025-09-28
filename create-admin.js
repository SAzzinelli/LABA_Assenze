const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  console.log('👤 Creazione utente admin...');
  const email = 'admin@laba.com';
  const password = 'admin123';
  const firstName = 'Admin';
  const lastName = 'LABA';
  const role = 'admin';

  try {
    // Check if admin already exists
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      console.log('⚠️ Utente admin già esistente.');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('🔐 Password hashata creata');

    const { data: newAdmin, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password: hashedPassword,
          role,
          first_name: firstName,
          last_name: lastName,
          is_active: true,
          has_104: false
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Errore creazione admin:', error);
      return;
    }

    console.log('✅ Utente admin creato con successo:', newAdmin);
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👑 Ruolo:', role);
  } catch (error) {
    console.error('❌ Errore generale nella creazione admin:', error);
  }
}

createAdmin();