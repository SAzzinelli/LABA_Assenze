const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSimoneCredentials() {
  try {
    console.log('🔍 Controllo credenziali per simone.azzinelli@labafirenze.com...');

    // Cerca l'utente Simone
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'simone.azzinelli@labafirenze.com')
      .single();

    if (fetchError) {
      console.error('❌ Errore nel recupero utente:', fetchError);
      return;
    }

    if (!user) {
      console.log('❌ Utente simone.azzinelli@labafirenze.com non trovato');
      return;
    }

    console.log('✅ Utente trovato:', {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active
    });

    // Controlla se è attivo
    if (!user.is_active) {
      console.log('⚠️ Utente non attivo, attivazione...');
      const { error: activateError } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', user.id);

      if (activateError) {
        console.error('❌ Errore attivazione utente:', activateError);
        return;
      }
      console.log('✅ Utente attivato');
    }

    // Reset password a "password123"
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: passwordError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', user.id);

    if (passwordError) {
      console.error('❌ Errore reset password:', passwordError);
      return;
    }

    console.log('✅ Password resettata a:', newPassword);

    // Verifica le credenziali
    const isValidPassword = await bcrypt.compare(newPassword, hashedPassword);
    console.log('✅ Verifica password:', isValidPassword ? 'OK' : 'ERRORE');

    console.log('\n🎉 Credenziali corrette per simone.azzinelli@labafirenze.com:');
    console.log('   Email: simone.azzinelli@labafirenze.com');
    console.log('   Password: password123');
    console.log('   Ruolo:', user.role);
    console.log('   Attivo:', true);

  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

// Esegui il fix
fixSimoneCredentials();
