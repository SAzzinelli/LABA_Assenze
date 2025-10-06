const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLogin() {
  const email = 'simone.azzinelli@labafirenze.com';
  const password = 'isimo1994';
  
  console.log('🔍 Debugging login for:', email);
  
  try {
    // 1. Verifica se l'utente esiste
    console.log('\n1. Verifico se l\'utente esiste...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError) {
      console.log('❌ Errore nel trovare l\'utente:', userError);
      return;
    }
    
    if (!user) {
      console.log('❌ Utente non trovato nel database');
      return;
    }
    
    console.log('✅ Utente trovato:', {
      id: user.id,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      first_name: user.first_name,
      last_name: user.last_name,
      created_at: user.created_at
    });
    
    // 2. Verifica se l'utente è attivo
    console.log('\n2. Verifico se l\'utente è attivo...');
    if (!user.is_active) {
      console.log('⚠️ Utente non attivo, lo attivo...');
      const { error: activateError } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', user.id);
      
      if (activateError) {
        console.log('❌ Errore nell\'attivazione:', activateError);
        return;
      }
      console.log('✅ Utente attivato');
    } else {
      console.log('✅ Utente già attivo');
    }
    
    // 3. Verifica password
    console.log('\n3. Verifico la password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valida:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('⚠️ Password non valida, la resetto...');
      const hashedPassword = await bcrypt.hash(password, 10);
      const { error: passwordError } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', user.id);
      
      if (passwordError) {
        console.log('❌ Errore nel reset password:', passwordError);
        return;
      }
      console.log('✅ Password resettata');
    }
    
    // 4. Test finale di login
    console.log('\n4. Test finale di login...');
    const { data: finalUser, error: finalError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();
    
    if (finalError || !finalUser) {
      console.log('❌ Errore nel test finale:', finalError);
      return;
    }
    
    const finalPasswordCheck = await bcrypt.compare(password, finalUser.password);
    console.log('Test finale password:', finalPasswordCheck);
    
    if (finalPasswordCheck) {
      console.log('\n🎉 LOGIN FUNZIONANTE!');
      console.log('Utente:', finalUser.email);
      console.log('Ruolo:', finalUser.role);
      console.log('Attivo:', finalUser.is_active);
    } else {
      console.log('\n❌ Login ancora non funziona');
    }
    
  } catch (error) {
    console.error('❌ Errore generale:', error);
  }
}

debugLogin();
