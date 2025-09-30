const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createRealAdmin() {
  console.log('👨‍💼 Creando admin reale con email hr@labafirenze.com...');
  
  try {
    // Verifica se l'admin esiste già
    const { data: existingAdmin, error: checkError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', 'hr@labafirenze.com')
      .single();

    if (existingAdmin) {
      console.log('✅ Admin hr@labafirenze.com già esistente!');
      console.log(`   ID: ${existingAdmin.id}`);
      console.log(`   Ruolo: ${existingAdmin.role}`);
      return;
    }

    // Crea password hash
    const hashedPassword = await bcrypt.hash('laba2025', 10);

    // Crea admin
    const { data: newAdmin, error: createError } = await supabase
      .from('users')
      .insert([
        {
          email: 'hr@labafirenze.com',
          password: hashedPassword,
          role: 'admin',
          first_name: 'HR',
          last_name: 'LABA',
          is_active: true,
          department: 'Amministrazione',
          position: 'Responsabile HR',
          workplace: 'LABA Firenze - Sede Via Vecchietti',
          contract_type: 'Full Time - Indeterminato'
        }
      ])
      .select()
      .single();

    if (createError) {
      console.error('❌ Errore creazione admin:', createError.message);
      return;
    }

    console.log('✅ Admin creato con successo!');
    console.log(`   Email: ${newAdmin.email}`);
    console.log(`   Ruolo: ${newAdmin.role}`);
    console.log(`   ID: ${newAdmin.id}`);
    console.log(`   Password: laba2025`);

  } catch (error) {
    console.error('❌ Errore generale:', error.message);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  createRealAdmin();
}

module.exports = { createRealAdmin };
