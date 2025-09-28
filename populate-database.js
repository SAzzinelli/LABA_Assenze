const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function populateDatabase() {
  console.log('🚀 Popolando il database con dati reali...');

  try {
    // 1. Creare dipartimenti
    console.log('📁 Creando dipartimenti...');
    const departments = [
      { name: 'Amministrazione', description: 'Gestione amministrativa e contabile' },
      { name: 'Segreteria', description: 'Supporto amministrativo e clienti' },
      { name: 'Orientamento', description: 'Orientamento e consulenza' },
      { name: 'Reparto IT', description: 'Tecnologie informatiche e sviluppo' }
    ];

    for (const dept of departments) {
      const { data, error } = await supabase
        .from('departments')
        .upsert(dept, { onConflict: 'name' })
        .select();
      
      if (error) console.error('Errore dipartimento:', error);
      else console.log(`✅ Dipartimento ${dept.name} creato`);
    }

    // 2. Creare utenti e dipendenti
    console.log('👥 Creando dipendenti...');
    const employees = [
      {
        user: {
          email: 'marco.rossi@labafirenze.com',
          password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
          role: 'employee',
          first_name: 'Marco',
          last_name: 'Rossi',
          is_active: true
        },
        employee: {
          employee_number: 'EMP001',
          position: 'Manager',
          hire_date: '2020-01-15',
          status: 'active',
          has_104: false,
          personal_info: {
            birth_date: '1985-03-15',
            phone: '+39 333 123 4567'
          }
        }
      },
      {
        user: {
          email: 'anna.bianchi@labafirenze.com',
          password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
          role: 'employee',
          first_name: 'Anna',
          last_name: 'Bianchi',
          is_active: true
        },
        employee: {
          employee_number: 'EMP002',
          position: 'Segretaria',
          hire_date: '2021-03-01',
          status: 'active',
          has_104: false,
          personal_info: {
            birth_date: '1990-07-22',
            phone: '+39 333 234 5678'
          }
        }
      },
      {
        user: {
          email: 'luca.verdi@labafirenze.com',
          password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
          role: 'employee',
          first_name: 'Luca',
          last_name: 'Verdi',
          is_active: true
        },
        employee: {
          employee_number: 'EMP003',
          position: 'Consulente',
          hire_date: '2019-09-01',
          status: 'active',
          has_104: true,
          personal_info: {
            birth_date: '1988-11-10',
            phone: '+39 333 345 6789'
          }
        }
      },
      {
        user: {
          email: 'sofia.neri@labafirenze.com',
          password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
          role: 'employee',
          first_name: 'Sofia',
          last_name: 'Neri',
          is_active: true
        },
        employee: {
          employee_number: 'EMP004',
          position: 'Sviluppatore',
          hire_date: '2022-01-10',
          status: 'active',
          has_104: false,
          personal_info: {
            birth_date: '1992-05-08',
            phone: '+39 333 456 7890'
          }
        }
      }
    ];

    const departmentMap = {
      'Amministrazione': null,
      'Segreteria': null,
      'Orientamento': null,
      'Reparto IT': null
    };

    // Get department IDs
    const { data: deptData } = await supabase.from('departments').select('*');
    deptData.forEach(dept => {
      departmentMap[dept.name] = dept.id;
    });

    for (const emp of employees) {
      // Create user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert(emp.user, { onConflict: 'email' })
        .select()
        .single();

      if (userError) {
        console.error('Errore utente:', userError);
        continue;
      }

      // Create employee
      const employeeData = {
        ...emp.employee,
        user_id: userData.id,
        department_id: departmentMap[emp.user.first_name === 'Marco' ? 'Amministrazione' :
                                   emp.user.first_name === 'Anna' ? 'Segreteria' :
                                   emp.user.first_name === 'Luca' ? 'Orientamento' : 'Reparto IT']
      };

      const { error: empError } = await supabase
        .from('employees')
        .upsert(employeeData, { onConflict: 'user_id' });

      if (empError) console.error('Errore dipendente:', empError);
      else console.log(`✅ Dipendente ${emp.user.first_name} ${emp.user.last_name} creato`);
    }

    // 3. Creare presenze per questa settimana
    console.log('📅 Creando presenze...');
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // Lunedì

    const { data: employeesData } = await supabase
      .from('employees')
      .select('id, users!inner(first_name, last_name)');

    for (let day = 0; day < 5; day++) { // Lunedì-Venerdì
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + day);
      const dateStr = currentDate.toISOString().split('T')[0];

      for (const emp of employeesData) {
        // 80% chance of being present
        if (Math.random() > 0.2) {
          const checkIn = `09:${Math.floor(Math.random() * 30)}:00`;
          const checkOut = `18:${Math.floor(Math.random() * 30)}:00`;
          
          const { error } = await supabase
            .from('attendance')
            .upsert({
              employee_id: emp.id,
              date: dateStr,
              check_in: checkIn,
              check_out: checkOut,
              hours_worked: 8.5,
              status: 'present'
            }, { onConflict: 'employee_id,date' });

          if (error) console.error('Errore presenza:', error);
        }
      }
    }

    // 4. Creare richieste permessi
    console.log('📝 Creando richieste permessi...');
    const leaveTypes = ['vacation', 'sick_leave', 'personal'];
    
    for (const emp of employeesData.slice(0, 3)) { // Solo primi 3 dipendenti
      const type = leaveTypes[Math.floor(Math.random() * leaveTypes.length)];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30));
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + Math.floor(Math.random() * 5) + 1);

      const { error } = await supabase
        .from('leave_requests')
        .insert({
          employee_id: emp.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          type: type,
          reason: type === 'vacation' ? 'Ferie estive' : 
                  type === 'sick_leave' ? 'Malattia' : 'Permesso personale',
          status: Math.random() > 0.5 ? 'approved' : 'pending'
        });

      if (error) console.error('Errore richiesta:', error);
      else console.log(`✅ Richiesta permesso creata per ${emp.users.first_name}`);
    }

    console.log('🎉 Database popolato con successo!');

  } catch (error) {
    console.error('❌ Errore durante il popolamento:', error);
  }
}

populateDatabase();
