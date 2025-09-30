const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function addRealEmployees() {
  console.log('👥 Aggiungendo dipendenti reali per Email Management...');
  
  try {
    // Dipendenti reali da aggiungere (esempi)
    const realEmployees = [
      {
        email: 'simone.azzinelli@labafirenze.com',
        password: 'simone123',
        firstName: 'Simone',
        lastName: 'Azzinelli',
        department: 'Reparto IT',
        position: 'Sviluppatore Full Stack',
        phone: '+39 333 123 4567',
        birthDate: '1994-05-15',
        hireDate: '2023-01-15',
        workplace: 'vecchietti',
        contractType: 'Full Time - Indeterminato',
        has104: false
      },
      {
        email: 'marco.rossi@labafirenze.com',
        password: 'marco123',
        firstName: 'Marco',
        lastName: 'Rossi',
        department: 'Amministrazione',
        position: 'Responsabile Amministrativo',
        phone: '+39 333 987 6543',
        birthDate: '1985-03-20',
        hireDate: '2020-09-01',
        workplace: 'vecchietti',
        contractType: 'Full Time - Indeterminato',
        has104: false
      },
      {
        email: 'anna.bianchi@labafirenze.com',
        password: 'anna123',
        firstName: 'Anna',
        lastName: 'Bianchi',
        department: 'Segreteria',
        position: 'Segretaria',
        phone: '+39 333 555 7777',
        birthDate: '1990-12-10',
        hireDate: '2021-03-15',
        workplace: 'vecchietti',
        contractType: 'Part Time - Indeterminato',
        has104: false
      }
    ];

    for (const emp of realEmployees) {
      // Verifica se esiste già
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', emp.email)
        .single();

      if (existingUser) {
        console.log(`✅ ${emp.firstName} ${emp.lastName} già esistente`);
        continue;
      }

      // Crea password hash
      const hashedPassword = await bcrypt.hash(emp.password, 10);

      // Crea utente
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([
          {
            email: emp.email,
            password: hashedPassword,
            role: 'employee',
            first_name: emp.firstName,
            last_name: emp.lastName,
            is_active: true,
            department: emp.department,
            position: emp.position,
            phone: emp.phone,
            birth_date: emp.birthDate,
            hire_date: emp.hireDate,
            workplace: emp.workplace,
            contract_type: emp.contractType,
            has_104: emp.has104
          }
        ])
        .select()
        .single();

      if (userError) {
        console.error(`❌ Errore creazione ${emp.firstName}:`, userError.message);
        continue;
      }

      console.log(`✅ Creato: ${emp.firstName} ${emp.lastName} (${emp.email})`);
    }

    console.log('🎉 Dipendenti reali aggiunti con successo!');

  } catch (error) {
    console.error('❌ Errore generale:', error.message);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  addRealEmployees();
}

module.exports = { addRealEmployees };
