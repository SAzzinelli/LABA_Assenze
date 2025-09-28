#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

const supabase = createClient(supabaseUrl, supabaseKey);

// Dati di esempio per i dipendenti
const employees = [
  {
    email: 'admin@labafirenze.com',
    password: 'laba2025',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'LABA',
    birthDate: '1980-01-01',
    phone: '+39 055 123 4567',
    department: 'Amministrazione',
    has104: false,
    workplace: 'LABA Firenze - Sede Via Vecchietti',
    contractType: 'Full Time - Indeterminato'
  },
  {
    email: 'marco.rossi@labafirenze.com',
    password: 'password123',
    role: 'employee',
    firstName: 'Marco',
    lastName: 'Rossi',
    birthDate: '1985-05-15',
    phone: '+39 333 123 4567',
    department: 'Reparto IT',
    has104: false,
    workplace: 'LABA Firenze - Sede Via Vecchietti',
    contractType: 'Full Time - Indeterminato'
  },
  {
    email: 'silvia.verdi@labafirenze.com',
    password: 'password123',
    role: 'employee',
    firstName: 'Silvia',
    lastName: 'Verdi',
    birthDate: '1990-03-22',
    phone: '+39 333 987 6543',
    department: 'Segreteria',
    has104: false,
    workplace: 'LABA Firenze - Sede Via Vecchietti',
    contractType: 'Part Time - Indeterminato'
  },
  {
    email: 'giuseppe.bianchi@labafirenze.com',
    password: 'password123',
    role: 'employee',
    firstName: 'Giuseppe',
    lastName: 'Bianchi',
    birthDate: '1988-12-10',
    phone: '+39 333 555 7777',
    department: 'Orientamento',
    has104: true,
    workplace: 'LABA Firenze - Sede Via Vecchietti',
    contractType: 'Full Time - Determinato'
  },
  {
    email: 'francesca.neri@labafirenze.com',
    password: 'password123',
    role: 'employee',
    firstName: 'Francesca',
    lastName: 'Neri',
    birthDate: '1992-07-08',
    phone: '+39 333 111 2222',
    department: 'Amministrazione',
    has104: false,
    workplace: 'LABA Firenze - Sede Via Vecchietti',
    contractType: 'Full Time - Indeterminato'
  }
];

// Dati di esempio per le presenze
const generateAttendanceData = (userId) => {
  const attendance = [];
  const today = new Date();
  
  // Genera presenze per gli ultimi 30 giorni
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Skip weekend
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // 80% probabilità di presenza
    if (Math.random() < 0.8) {
      const checkIn = new Date(date);
      checkIn.setHours(9 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0);
      
      const checkOut = new Date(checkIn);
      checkOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0);
      
      const hoursWorked = ((checkOut - checkIn) / (1000 * 60 * 60)) - 1; // -1 per pausa pranzo
      
      attendance.push({
        user_id: userId,
        date: date.toISOString().split('T')[0],
        clock_in: checkIn.toISOString(),
        clock_out: checkOut.toISOString(),
        hours_worked: Math.round(hoursWorked * 100) / 100,
        status: 'present'
      });
    }
  }
  
  return attendance;
};

// Dati di esempio per le richieste
const generateLeaveRequests = (userId, userRole) => {
  const requests = [];
  const today = new Date();
  
  if (userRole === 'employee') {
    // Genera alcune richieste di permesso
    const types = ['permission', 'vacation', 'sick'];
    const reasons = {
      permission: ['Visita medica', 'Motivi familiari', 'Appuntamento', 'Permesso personale'],
      vacation: ['Ferie estive', 'Vacanza in famiglia', 'Weekend lungo'],
      sick: ['Influenza', 'Mal di testa', 'Febbre']
    };
    
    for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30) + 1);
      
      const endDate = new Date(startDate);
      if (type === 'vacation') {
        endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 7) + 1);
      } else {
        endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 2));
      }
      
      const daysRequested = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      const status = Math.random() < 0.7 ? 'pending' : (Math.random() < 0.5 ? 'approved' : 'rejected');
      
      requests.push({
        user_id: userId,
        type,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        days_requested: daysRequested,
        reason: reasons[type][Math.floor(Math.random() * reasons[type].length)],
        status,
        approved_at: status !== 'pending' ? new Date().toISOString() : null
      });
    }
  }
  
  return requests;
};

async function populateDatabase() {
  console.log('🚀 Inizio popolamento database...');
  
  try {
    // 1. Pulisci tabelle esistenti
    console.log('🧹 Pulizia tabelle esistenti...');
    await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('leave_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 2. Inserisci dipendenti
    console.log('👥 Inserimento dipendenti...');
    const createdUsers = [];
    
    for (const emp of employees) {
      const hashedPassword = await bcrypt.hash(emp.password, 10);
      
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: emp.email,
          password: hashedPassword,
          role: emp.role,
          first_name: emp.firstName,
          last_name: emp.lastName,
          has_104: emp.has104
        })
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Errore inserimento ${emp.email}:`, error);
      } else {
        console.log(`✅ Inserito: ${emp.firstName} ${emp.lastName}`);
        createdUsers.push(data);
      }
    }
    
    // 3. Inserisci presenze
    console.log('⏰ Inserimento presenze...');
    for (const user of createdUsers) {
      const attendanceData = generateAttendanceData(user.id);
      
      if (attendanceData.length > 0) {
        const { error } = await supabase
          .from('attendance')
          .insert(attendanceData);
        
        if (error) {
          console.error(`❌ Errore presenze ${user.first_name}:`, error);
        } else {
          console.log(`✅ Presenze inserite per ${user.first_name}: ${attendanceData.length} record`);
        }
      }
    }
    
    // 4. Inserisci richieste
    console.log('📝 Inserimento richieste...');
    for (const user of createdUsers) {
      const requestsData = generateLeaveRequests(user.id, user.role);
      
      if (requestsData.length > 0) {
        const { error } = await supabase
          .from('leave_requests')
          .insert(requestsData);
        
        if (error) {
          console.error(`❌ Errore richieste ${user.first_name}:`, error);
        } else {
          console.log(`✅ Richieste inserite per ${user.first_name}: ${requestsData.length} record`);
        }
      }
    }
    
    console.log('🎉 Database popolato con successo!');
    console.log(`📊 Statistiche:`);
    console.log(`   - ${createdUsers.length} utenti creati`);
    console.log(`   - ${createdUsers.filter(u => u.role === 'admin').length} admin`);
    console.log(`   - ${createdUsers.filter(u => u.role === 'employee').length} dipendenti`);
    
  } catch (error) {
    console.error('❌ Errore durante il popolamento:', error);
  }
}

// Esegui script
if (require.main === module) {
  populateDatabase();
}

module.exports = { populateDatabase };
