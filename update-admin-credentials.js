const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAdminCredentials() {
  console.log('🔐 Aggiornando credenziali admin...');

  try {
    // Hash della nuova password
    const hashedPassword = await bcrypt.hash('laba2025', 10);
    console.log('✅ Password hashata con successo');

    // Cerca l'utente admin esistente
    const { data: existingAdmin, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'admin')
      .single();

    if (fetchError) {
      console.error('❌ Errore nel recupero admin esistente:', fetchError);
      return;
    }

    if (!existingAdmin) {
      console.log('⚠️ Nessun admin trovato, creo nuovo admin...');
      
      // Crea nuovo admin
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          email: 'admin@labafirenze.com',
          password: hashedPassword,
          role: 'admin',
          first_name: 'admin',
          last_name: 'LABA',
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Errore creazione nuovo admin:', createError);
        return;
      }

      console.log('✅ Nuovo admin creato:', newAdmin.email);
    } else {
      console.log('📝 Admin esistente trovato:', existingAdmin.email);
      
      // Aggiorna le credenziali dell'admin esistente
      const { data: updatedAdmin, error: updateError } = await supabase
        .from('users')
        .update({
          password: hashedPassword,
          first_name: 'admin',
          last_name: 'LABA'
        })
        .eq('id', existingAdmin.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Errore aggiornamento admin:', updateError);
        return;
      }

      console.log('✅ Credenziali admin aggiornate:', updatedAdmin.email);
    }

    console.log('🎉 Credenziali admin aggiornate con successo!');
    console.log('📧 Email: admin@labafirenze.com');
    console.log('👤 Nome: admin');
    console.log('🔑 Password: laba2025');

  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

updateAdminCredentials().catch(console.error);
