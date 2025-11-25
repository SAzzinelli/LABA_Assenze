const cron = require('node-cron');
const { sendEmail, sendEmailToAdmins } = require('./emailService');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

class EmailScheduler {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  // Avvia il scheduler
  start() {
    if (this.isRunning) {
      console.log('📧 Email Scheduler già attivo');
      return;
    }

    console.log('🚀 Avvio Email Scheduler...');
    this.isRunning = true;

    // Report settimanali - ogni lunedì alle 9:00
    this.scheduleWeeklyReports();

    // Promemoria timbratura - ogni giorno alle 8:30
    this.scheduleDailyReminders();

    console.log('✅ Email Scheduler avviato con successo');
  }

  // Ferma il scheduler
  stop() {
    console.log('🛑 Fermata Email Scheduler...');
    this.tasks.forEach((task, name) => {
      task.destroy();
      console.log(`   ❌ Task fermato: ${name}`);
    });
    this.tasks.clear();
    this.isRunning = false;
    console.log('✅ Email Scheduler fermato');
  }

  // Report settimanali automatici
  scheduleWeeklyReports() {
    const task = cron.schedule('0 9 * * 1', async () => {
      console.log('📊 Invio report settimanali automatici...');
      await this.sendWeeklyReportsToAll();
    }, {
      scheduled: false,
      timezone: 'Europe/Rome'
    });

    this.tasks.set('weeklyReports', task);
    task.start();
    console.log('   📅 Report settimanali: ogni lunedì alle 9:00');
  }

  // Promemoria giornalieri automatici
  scheduleDailyReminders() {
    const task = cron.schedule('30 8 * * 1-5', async () => {
      console.log('⏰ Invio promemoria timbratura automatici...');
      await this.sendDailyRemindersToAll();
    }, {
      scheduled: false,
      timezone: 'Europe/Rome'
    });

    this.tasks.set('dailyReminders', task);
    task.start();
    console.log('   ⏰ Promemoria giornalieri: ogni giorno alle 8:30 (lun-ven)');
  }

  // Invia report settimanali a tutti i dipendenti
  async sendWeeklyReportsToAll() {
    try {
      const { data: employees, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('role', 'employee')
        .eq('is_active', true);

      if (error) {
        console.error('❌ Errore recupero dipendenti:', error.message);
        return;
      }

      for (const emp of employees) {
        if (isRealEmail(emp.email)) {
          // Calcola dati settimanali reali
          const weekData = await this.calculateWeeklyData(emp.id);

          await sendEmail(emp.email, 'weeklyReport', [
            `${emp.first_name} ${emp.last_name}`,
            weekData
          ]);

          console.log(`   📧 Report inviato a: ${emp.first_name} ${emp.last_name}`);
        }
      }

      console.log('✅ Report settimanali inviati a tutti i dipendenti');
    } catch (error) {
      console.error('❌ Errore invio report settimanali:', error.message);
    }
  }

  // Invia promemoria giornalieri a tutti i dipendenti
  async sendDailyRemindersToAll() {
    try {
      const { data: employees, error } = await supabase
        .from('users')
        .select('id, email, personal_email, first_name, last_name, department')
        .eq('role', 'employee')
        .eq('is_active', true);

      if (error) {
        console.error('❌ Errore recupero dipendenti:', error.message);
        return;
      }

      // Le email di timbratura sono state rimosse - non più necessarie
      console.log('   ⏰ Promemoria timbratura disabilitati (non più necessari)');

      /* 
      for (const emp of employees) {
        if (isRealEmail(emp.email)) {
          await sendEmail(emp.email, 'attendanceReminder', [
            `${emp.first_name} ${emp.last_name}`,
            emp.department || 'Ufficio'
          ]);
          
          console.log(`   ⏰ Promemoria inviato a: ${emp.first_name} ${emp.last_name}`);
        }
      }
      */

      console.log('✅ Promemoria giornalieri inviati a tutti i dipendenti');
    } catch (error) {
      console.error('❌ Errore invio promemoria:', error.message);
    }
  }

  // Calcola dati settimanali per un dipendente
  async calculateWeeklyData(userId) {
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const { data: weeklyAttendance } = await supabase
      .from('attendance')
      .select('actual_hours, expected_hours, date')
      .eq('user_id', userId)
      .gte('date', startOfWeek.toISOString().split('T')[0])
      .lte('date', endOfWeek.toISOString().split('T')[0])
      .not('actual_hours', 'is', null);

    let totalHours = 0;
    let daysPresent = 0;
    let overtimeHours = 0;
    let totalExpectedHours = 0;

    if (weeklyAttendance) {
      weeklyAttendance.forEach(record => {
        const actual = record.actual_hours || 0;
        const expected = record.expected_hours || 8; // Fallback to 8 if missing, but should be there

        if (actual > 0) {
          totalHours += actual;
          daysPresent++;
          totalExpectedHours += expected;

          if (actual > expected) {
            overtimeHours += (actual - expected);
          }
        }
      });
    }

    const balanceHours = totalHours - totalExpectedHours;

    return {
      weekNumber: Math.ceil((currentDate.getDate() - currentDate.getDay() + 1) / 7),
      totalHours: Math.round(totalHours * 10) / 10,
      daysPresent: daysPresent,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      balanceHours: Math.round(balanceHours * 10) / 10
    };
  }

  // Ottieni stato del scheduler
  getStatus() {
    return {
      isRunning: this.isRunning,
      tasks: Array.from(this.tasks.keys()),
      activeTasks: Array.from(this.tasks.entries()).map(([name, task]) => ({
        name,
        running: task.running
      }))
    };
  }
}

// Istanza singleton
const emailScheduler = new EmailScheduler();

module.exports = emailScheduler;
