/**
 * CRON JOB PER SALVATAGGIO AUTOMATICO PRESENZE OGNI ORA
 * Salva automaticamente i dati real-time delle presenze ogni ora
 */

const cron = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configurazione
const API_BASE_URL = process.env.API_BASE_URL || 'https://hr.laba.biz';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-admin-token-here';

/**
 * Salva le presenze real-time per tutti i dipendenti
 */
async function saveHourlyAttendance() {
  console.log('🕘 Cron job: Salvataggio presenze orarie...');
  console.log('📅 Data:', new Date().toLocaleString('it-IT'));
  
  try {
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
    
    // 2. Per ogni dipendente, calcola e salva le ore real-time
    const today = new Date().toISOString().split('T')[0];
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        // Calcola le ore real-time per questo dipendente
        const attendanceResponse = await fetch(`${API_BASE_URL}/api/attendance/hours-balance?userId=${user.id}&year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`, {
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
        
        // Se ci sono dati real-time per oggi, salviamo
        if (attendanceData.today && attendanceData.today.actual_hours > 0) {
          const saveResponse = await fetch(`${API_BASE_URL}/api/attendance/save-hourly`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${ADMIN_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.id,
              date: today,
              actualHours: attendanceData.today.actual_hours,
              expectedHours: attendanceData.today.expected_hours,
              balanceHours: attendanceData.today.balance_hours,
              notes: 'Salvataggio automatico orario'
            })
          });
          
          if (saveResponse.ok) {
            console.log(`✅ Salvato: ${user.first_name} ${user.last_name} - ${attendanceData.today.actual_hours}h`);
            successCount++;
          } else {
            console.error(`❌ Errore salvataggio per ${user.first_name} ${user.last_name}: ${saveResponse.status}`);
            errorCount++;
          }
        } else {
          console.log(`⏭️  Saltato: ${user.first_name} ${user.last_name} - nessuna attività oggi`);
        }
        
      } catch (error) {
        console.error(`❌ Errore per ${user.first_name} ${user.last_name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Cron job completato: ${successCount} salvati, ${errorCount} errori`);
    
  } catch (error) {
    console.error('❌ Cron job: Errore durante il salvataggio presenze:', error.message);
  }
}

// Cron job per eseguire il salvataggio ogni ora (minuto 0)
const hourlySaveJob = cron.schedule('0 * * * *', async () => {
  await saveHourlyAttendance();
}, {
  scheduled: false, // Non avviare automaticamente
  timezone: 'Europe/Rome'
});

// Funzione per avviare il cron job
function startHourlyAttendanceSaver() {
  console.log('🚀 Avvio cron job per salvataggio presenze orarie...');
  console.log('📅 Esecuzione: Ogni ora al minuto 0 (fuso orario Roma)');
  
  hourlySaveJob.start();
  
  console.log('✅ Cron job attivato');
  console.log('📋 Prossima esecuzione:', hourlySaveJob.nextDate().toLocaleString('it-IT'));
}

// Funzione per fermare il cron job
function stopHourlyAttendanceSaver() {
  console.log('🛑 Arresto cron job per salvataggio presenze...');
  hourlySaveJob.stop();
  console.log('✅ Cron job fermato');
}

// Funzione per testare il cron job (esecuzione immediata)
function testHourlyAttendanceSaver() {
  console.log('🧪 Test esecuzione cron job...');
  saveHourlyAttendance();
}

// Gestione segnali per shutdown graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Ricevuto SIGINT, arresto cron job...');
  stopHourlyAttendanceSaver();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Ricevuto SIGTERM, arresto cron job...');
  stopHourlyAttendanceSaver();
  process.exit(0);
});

// Esegui se chiamato direttamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('start')) {
    startHourlyAttendanceSaver();
    
    // Mantieni il processo attivo
    console.log('⏳ Cron job in esecuzione. Premi Ctrl+C per fermare...');
    setInterval(() => {
      // Mantieni il processo attivo
    }, 1000);
    
  } else if (args.includes('stop')) {
    stopHourlyAttendanceSaver();
    
  } else if (args.includes('test')) {
    testHourlyAttendanceSaver();
    
  } else {
    console.log('📋 Utilizzo:');
    console.log('  node hourly-attendance-saver.js start  - Avvia il cron job');
    console.log('  node hourly-attendance-saver.js stop    - Ferma il cron job');
    console.log('  node hourly-attendance-saver.js test    - Testa il cron job');
    console.log('');
    console.log('📅 Il cron job salverà le presenze ogni ora al minuto 0');
    console.log('🔧 Assicurati di configurare ADMIN_TOKEN nelle variabili d\'ambiente');
  }
}

module.exports = {
  startHourlyAttendanceSaver,
  stopHourlyAttendanceSaver,
  testHourlyAttendanceSaver,
  hourlySaveJob,
  saveHourlyAttendance
};
