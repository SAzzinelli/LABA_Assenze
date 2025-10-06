const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

class AttendanceScheduler {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  // Avvia tutti i task
  start() {
    if (this.isRunning) {
      console.log('⚠️ Attendance Scheduler già in esecuzione');
      return;
    }

    console.log('🚀 Avvio Attendance Scheduler...');
    this.scheduleDailyAttendance();
    this.scheduleAttendanceDetails();
    this.isRunning = true;
    console.log('✅ Attendance Scheduler avviato con successo');
  }

  // Ferma tutti i task
  stop() {
    console.log('🛑 Arresto Attendance Scheduler...');
    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`   ❌ Task ${name} fermato`);
    });
    this.tasks.clear();
    this.isRunning = false;
    console.log('✅ Attendance Scheduler fermato');
  }

  // Genera presenze automatiche giornaliere
  scheduleDailyAttendance() {
    // Ogni giorno alle 6:00 del mattino
    const task = cron.schedule('0 6 * * *', async () => {
      console.log('📅 Generazione presenze automatiche giornaliere...');
      await this.generateDailyAttendance();
    }, {
      scheduled: false,
      timezone: 'Europe/Rome'
    });

    this.tasks.set('dailyAttendance', task);
    task.start();
    console.log('   📅 Presenze automatiche: ogni giorno alle 6:00');
  }

  // Genera dettagli presenze (mattina, pausa pranzo, pomeriggio)
  scheduleAttendanceDetails() {
    // Ogni ora dalle 9:00 alle 18:00
    const task = cron.schedule('0 9-18 * * 1-5', async () => {
      console.log('⏰ Aggiornamento dettagli presenze...');
      await this.updateAttendanceDetails();
    }, {
      scheduled: false,
      timezone: 'Europe/Rome'
    });

    this.tasks.set('attendanceDetails', task);
    task.start();
    console.log('   ⏰ Dettagli presenze: ogni ora dalle 9:00 alle 18:00 (lun-ven)');
  }

  // Genera presenze automatiche per tutti i dipendenti attivi
  async generateDailyAttendance() {
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log(`📊 Generazione presenze per ${today}...`);

      // Ottieni tutti i dipendenti attivi
      const { data: employees, error: employeesError } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          employees!inner(
            department,
            position,
            workplace,
            contract_type
          )
        `)
        .eq('is_active', true)
        .eq('role', 'employee');

      if (employeesError) {
        console.error('❌ Errore nel recupero dipendenti:', employeesError);
        return;
      }

      console.log(`👥 Trovati ${employees.length} dipendenti attivi`);

      // Per ogni dipendente, genera la presenza automatica
      for (const employee of employees) {
        await this.generateEmployeeAttendance(employee, today);
      }

      console.log('✅ Presenze automatiche generate con successo');
    } catch (error) {
      console.error('❌ Errore nella generazione presenze automatiche:', error);
    }
  }

  // Genera presenza per un singolo dipendente
  async generateEmployeeAttendance(employee, date) {
    try {
      // Verifica se esiste già una presenza per oggi
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', employee.id)
        .eq('date', date)
        .single();

      if (existingAttendance) {
        console.log(`   ⏭️ Presenza già esistente per ${employee.first_name} ${employee.last_name}`);
        return;
      }

      // Determina l'orario di lavoro basato sul contratto
      const workHours = this.getWorkHours(employee.employees.contract_type);
      const startTime = '09:00';
      const endTime = '18:00';

      // Crea la presenza automatica
      const { data: newAttendance, error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          user_id: employee.id,
          date: date,
          status: 'present',
          expected_hours: workHours,
          actual_hours: workHours,
          balance_hours: 0,
          clock_in: `${date} ${startTime}:00`,
          clock_out: `${date} ${endTime}:00`,
          is_absent: false,
          is_overtime: false,
          is_early_departure: false,
          is_late_arrival: false,
          notes: 'Presenza automatica generata dal sistema',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (attendanceError) {
        console.error(`❌ Errore creazione presenza per ${employee.first_name}:`, attendanceError);
        return;
      }

      console.log(`   ✅ Presenza creata per ${employee.first_name} ${employee.last_name} (${workHours}h)`);

      // Crea i dettagli della presenza (mattina, pausa pranzo, pomeriggio)
      await this.createAttendanceDetails(newAttendance.id, employee.id, date);

    } catch (error) {
      console.error(`❌ Errore generazione presenza per ${employee.first_name}:`, error);
    }
  }

  // Crea i dettagli della presenza (mattina, pausa pranzo, pomeriggio)
  async createAttendanceDetails(attendanceId, userId, date) {
    try {
      const details = [
        {
          attendance_id: attendanceId,
          user_id: userId,
          date: date,
          period: 'mattina',
          start_time: `${date} 09:00:00`,
          end_time: `${date} 13:00:00`,
          hours: 4,
          status: 'completed',
          notes: 'Turno mattutino'
        },
        {
          attendance_id: attendanceId,
          user_id: userId,
          date: date,
          period: 'pausa_pranzo',
          start_time: `${date} 13:00:00`,
          end_time: `${date} 14:00:00`,
          hours: 1,
          status: 'break',
          notes: 'Pausa pranzo'
        },
        {
          attendance_id: attendanceId,
          user_id: userId,
          date: date,
          period: 'pomeriggio',
          start_time: `${date} 14:00:00`,
          end_time: `${date} 18:00:00`,
          hours: 4,
          status: 'completed',
          notes: 'Turno pomeridiano'
        }
      ];

      const { error } = await supabase
        .from('attendance_details')
        .insert(details);

      if (error) {
        console.error('❌ Errore creazione dettagli presenza:', error);
        return;
      }

      console.log(`   📋 Dettagli presenza creati per ${date}`);
    } catch (error) {
      console.error('❌ Errore creazione dettagli presenza:', error);
    }
  }

  // Aggiorna i dettagli delle presenze durante la giornata
  async updateAttendanceDetails() {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentHour = now.getHours();

      console.log(`🕐 Aggiornamento dettagli presenze - ${today} ${currentHour}:00`);

      // Determina quale periodo aggiornare
      let periodToUpdate = null;
      if (currentHour >= 9 && currentHour < 13) {
        periodToUpdate = 'mattina';
      } else if (currentHour >= 13 && currentHour < 14) {
        periodToUpdate = 'pausa_pranzo';
      } else if (currentHour >= 14 && currentHour < 18) {
        periodToUpdate = 'pomeriggio';
      }

      if (!periodToUpdate) {
        console.log('   ⏭️ Nessun periodo da aggiornare in questo momento');
        return;
      }

      // Aggiorna i dettagli per il periodo corrente
      const { error } = await supabase
        .from('attendance_details')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('date', today)
        .eq('period', periodToUpdate);

      if (error) {
        console.error('❌ Errore aggiornamento dettagli:', error);
        return;
      }

      console.log(`   ✅ Dettagli aggiornati per periodo: ${periodToUpdate}`);
    } catch (error) {
      console.error('❌ Errore aggiornamento dettagli presenze:', error);
    }
  }

  // Determina le ore di lavoro basate sul tipo di contratto
  getWorkHours(contractType) {
    if (contractType.includes('Full Time')) {
      return 8;
    } else if (contractType.includes('Part Time')) {
      return 4;
    } else if (contractType.includes('P.IVA')) {
      return 8;
    } else {
      return 8; // Default
    }
  }

  // Genera presenze per un periodo specifico (per admin)
  async generateAttendanceForPeriod(userId, startDate, endDate) {
    try {
      console.log(`📅 Generazione presenze per periodo ${startDate} - ${endDate}`);

      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates = [];

      // Genera array di date
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.getDay();
        
        // Solo giorni lavorativi (lunedì-venerdì)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          dates.push(dateStr);
        }
      }

      // Ottieni i dati del dipendente
      const { data: employee, error: employeeError } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          employees!inner(contract_type)
        `)
        .eq('id', userId)
        .single();

      if (employeeError || !employee) {
        console.error('❌ Dipendente non trovato:', employeeError);
        return { success: false, error: 'Dipendente non trovato' };
      }

      // Genera presenze per ogni data
      for (const date of dates) {
        await this.generateEmployeeAttendance(employee, date);
      }

      console.log(`✅ Presenze generate per ${dates.length} giorni lavorativi`);
      return { success: true, daysGenerated: dates.length };

    } catch (error) {
      console.error('❌ Errore generazione presenze per periodo:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = AttendanceScheduler;
