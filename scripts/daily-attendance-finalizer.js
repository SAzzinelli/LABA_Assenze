/**
 * CRON JOB PER FINALIZZAZIONE GIORNATA A MEZZANOTTE
 * Salva definitivamente tutti i dati della giornata appena conclusa
 */

const cron = require('node-cron');
const fetch = require('node-fetch');

// Configurazione
const API_BASE_URL = process.env.API_BASE_URL || 'https://hr.laba.biz';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-token-here';

/**
 * Finalizza la giornata appena conclusa per tutti i dipendenti
 */
async function finalizeDailyAttendance() {
  console.log('🕘 Cron job: Finalizzazione giornata appena conclusa...');
  console.log('📅 Data:', new Date().toLocaleString('it-IT'));
  
  try {
    // La data di ieri (giornata appena conclusa)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`📅 Finalizzazione per il giorno: ${yesterdayStr}`);
    
    // 1. Ottieni tutti i dipendenti (non admin)
    const usersResponse = await fetch(`${API_BASE_URL}/api/employees`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!usersResponse.ok) {
      throw new Error(`Errore nel recupero dipendenti: ${usersResponse.status}`);
    }
    
    const users = await usersResponse.json();
    console.log(`👥 Trovati ${users.length} dipendenti`);
    
    // 2. Per ogni dipendente, finalizza le ore del giorno precedente
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const user of users) {
      try {
        // Controlla se esiste già un record per ieri
        const existingResponse = await fetch(`${API_BASE_URL}/api/attendance?userId=${user.id}&date=${yesterdayStr}`, {
          headers: {
            'Authorization': `Bearer ${ADMIN_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (existingResponse.ok) {
          const existingData = await existingResponse.json();
          
          if (existingData.length > 0 && existingData[0].actual_hours > 0) {
            console.log(`✅ Già finalizzato: ${user.first_name} ${user.last_name} - ${existingData[0].actual_hours}h`);
            skippedCount++;
            continue;
          }
        }
        
        // Calcola le ore finali per ieri (giornata completa)
        const attendanceResponse = await fetch(`${API_BASE_URL}/api/attendance/hours-balance?userId=${user.id}&year=${yesterday.getFullYear()}&month=${yesterday.getMonth() + 1}`, {
          headers: {
            'Authorization': `Bearer ${ADMIN_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!attendanceResponse.ok) {
          console.error(`❌ Errore calcolo ore per ${user.first_name} ${user.last_name}: ${attendanceResponse.status}`);
          errorCount++;
          continue;
        }
        
        const attendanceData = await attendanceResponse.json();
        
        // Calcola le ore finali per ieri
        let finalActualHours = 0;
        let finalExpectedHours = 0;
        let finalBalanceHours = 0;
        
        // Se c'è un record per ieri nel database, usa quello
        if (attendanceData.attendance && attendanceData.attendance.length > 0) {
          const yesterdayRecord = attendanceData.attendance.find(record => record.date === yesterdayStr);
          if (yesterdayRecord) {
            finalActualHours = yesterdayRecord.actual_hours;
            finalExpectedHours = yesterdayRecord.expected_hours;
            finalBalanceHours = yesterdayRecord.balance_hours;
          }
        }
        
        // Se non c'è record per ieri, calcola le ore finali basandosi sull'orario di lavoro
        if (finalActualHours === 0) {
          const dayOfWeek = yesterday.getDay();
          const todaySchedule = attendanceData.workSchedules?.find(schedule => 
            schedule.day_of_week === dayOfWeek && schedule.is_working_day
          );
          
          if (todaySchedule) {
            const { start_time, end_time, break_duration } = todaySchedule;
            const [startHour, startMin] = start_time.split(':').map(Number);
            const [endHour, endMin] = end_time.split(':').map(Number);
            const breakDuration = break_duration || 60;
            
            // Calcola ore attese (sottraendo pausa pranzo)
            const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
            const workMinutes = totalMinutes - breakDuration;
            finalExpectedHours = workMinutes / 60;
            
            // Per una giornata completa, le ore effettive = ore attese
            finalActualHours = finalExpectedHours;
            finalBalanceHours = 0;
          }
        }
        
        // Salva il record finale per ieri
        if (finalActualHours > 0) {
          const saveResponse = await fetch(`${API_BASE_URL}/api/attendance/save-daily`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${ADMIN_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.id,
              date: yesterdayStr,
              actualHours: finalActualHours,
              expectedHours: finalExpectedHours,
              balanceHours: finalBalanceHours,
              notes: 'Finalizzazione automatica giornata'
            })
          });
          
          if (saveResponse.ok) {
            console.log(`✅ Finalizzato: ${user.first_name} ${user.last_name} - ${finalActualHours}h`);
            successCount++;
          } else {
            console.error(`❌ Errore finalizzazione per ${user.first_name} ${user.last_name}: ${saveResponse.status}`);
            errorCount++;
          }
        } else {
          console.log(`⏭️  Saltato: ${user.first_name} ${user.last_name} - giorno non lavorativo`);
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Errore per ${user.first_name} ${user.last_name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Finalizzazione completata: ${successCount} finalizzati, ${skippedCount} saltati, ${errorCount} errori`);
    
  } catch (error) {
    console.error('❌ Cron job: Errore durante la finalizzazione:', error.message);
  }
}

// Cron job per eseguire la finalizzazione ogni giorno a mezzanotte
const dailyFinalizeJob = cron.schedule('0 0 * * *', async () => {
  await finalizeDailyAttendance();
}, {
  scheduled: false, // Non avviare automaticamente
  timezone: 'Europe/Rome'
});

// Funzione per avviare il cron job
function startDailyAttendanceFinalizer() {
  console.log('🚀 Avvio cron job per finalizzazione giornata...');
  console.log('📅 Esecuzione: Ogni giorno a mezzanotte (fuso orario Roma)');
  
  dailyFinalizeJob.start();
  
  console.log('✅ Cron job attivato');
  console.log('📋 Prossima esecuzione:', dailyFinalizeJob.nextDate().toLocaleString('it-IT'));
}

// Funzione per fermare il cron job
function stopDailyAttendanceFinalizer() {
  console.log('🛑 Arresto cron job per finalizzazione giornata...');
  dailyFinalizeJob.stop();
  console.log('✅ Cron job fermato');
}

// Funzione per testare il cron job (esecuzione immediata)
function testDailyAttendanceFinalizer() {
  console.log('🧪 Test esecuzione cron job...');
  dailyFinalizeJob.fire();
}

// Gestione segnali per shutdown graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Ricevuto SIGINT, arresto cron job...');
  stopDailyAttendanceFinalizer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Ricevuto SIGTERM, arresto cron job...');
  stopDailyAttendanceFinalizer();
  process.exit(0);
});

// Esegui se chiamato direttamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('start')) {
    startDailyAttendanceFinalizer();
    
    // Mantieni il processo attivo
    console.log('⏳ Cron job in esecuzione. Premi Ctrl+C per fermare...');
    setInterval(() => {
      // Mantieni il processo attivo
    }, 1000);
    
  } else if (args.includes('stop')) {
    stopDailyAttendanceFinalizer();
    
  } else if (args.includes('test')) {
    testDailyAttendanceFinalizer();
    
  } else {
    console.log('📋 Utilizzo:');
    console.log('  node daily-attendance-finalizer.js start  - Avvia il cron job');
    console.log('  node daily-attendance-finalizer.js stop    - Ferma il cron job');
    console.log('  node daily-attendance-finalizer.js test    - Testa il cron job');
    console.log('');
    console.log('📅 Il cron job finalizzerà la giornata ogni giorno a mezzanotte');
    console.log('🔧 Assicurati di configurare ADMIN_TOKEN nelle variabili d\'ambiente');
  }
}

module.exports = {
  startDailyAttendanceFinalizer,
  stopDailyAttendanceFinalizer,
  testDailyAttendanceFinalizer,
  dailyFinalizeJob,
  finalizeDailyAttendance
};
