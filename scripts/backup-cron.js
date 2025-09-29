/**
 * CRON JOB PER BACKUP AUTOMATICI
 * Esegue backup automatici del sistema HR
 */

const cron = require('node-cron');
const { createFullBackup, createIncrementalBackup, cleanupOldBackups } = require('./backup-system');

// Cron job per backup completo settimanale (domenica alle 2:00)
const weeklyBackupJob = cron.schedule('0 2 * * 0', async () => {
  console.log('🕘 Cron job: Avvio backup completo settimanale...');
  console.log('📅 Data:', new Date().toLocaleString('it-IT'));
  
  try {
    await createFullBackup();
    console.log('✅ Cron job: Backup completo settimanale completato');
  } catch (error) {
    console.error('❌ Cron job: Errore backup completo settimanale:', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Europe/Rome'
});

// Cron job per backup incrementale giornaliero (ogni giorno alle 3:00)
const dailyBackupJob = cron.schedule('0 3 * * *', async () => {
  console.log('🕘 Cron job: Avvio backup incrementale giornaliero...');
  console.log('📅 Data:', new Date().toLocaleString('it-IT'));
  
  try {
    await createIncrementalBackup();
    console.log('✅ Cron job: Backup incrementale giornaliero completato');
  } catch (error) {
    console.error('❌ Cron job: Errore backup incrementale giornaliero:', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Europe/Rome'
});

// Cron job per pulizia backup vecchi (ogni domenica alle 4:00)
const cleanupJob = cron.schedule('0 4 * * 0', async () => {
  console.log('🕘 Cron job: Avvio pulizia backup vecchi...');
  console.log('📅 Data:', new Date().toLocaleString('it-IT'));
  
  try {
    cleanupOldBackups();
    console.log('✅ Cron job: Pulizia backup vecchi completata');
  } catch (error) {
    console.error('❌ Cron job: Errore pulizia backup vecchi:', error.message);
  }
}, {
  scheduled: false,
  timezone: 'Europe/Rome'
});

// Funzione per avviare tutti i cron job
function startBackupCronJobs() {
  console.log('🚀 Avvio cron job per backup automatici...');
  console.log('📅 Backup completo: Ogni domenica alle 2:00');
  console.log('📅 Backup incrementale: Ogni giorno alle 3:00');
  console.log('📅 Pulizia backup: Ogni domenica alle 4:00');
  
  weeklyBackupJob.start();
  dailyBackupJob.start();
  cleanupJob.start();
  
  console.log('✅ Tutti i cron job attivati');
  console.log('📋 Prossimi backup:');
  console.log(`  Completo: ${weeklyBackupJob.nextDate().toLocaleString('it-IT')}`);
  console.log(`  Incrementale: ${dailyBackupJob.nextDate().toLocaleString('it-IT')}`);
  console.log(`  Pulizia: ${cleanupJob.nextDate().toLocaleString('it-IT')}`);
}

// Funzione per fermare tutti i cron job
function stopBackupCronJobs() {
  console.log('🛑 Arresto cron job per backup automatici...');
  
  weeklyBackupJob.stop();
  dailyBackupJob.stop();
  cleanupJob.stop();
  
  console.log('✅ Tutti i cron job fermati');
}

// Funzione per testare i cron job (esecuzione immediata)
function testBackupCronJobs() {
  console.log('🧪 Test esecuzione cron job...');
  
  console.log('🔄 Test backup completo...');
  weeklyBackupJob.fire();
  
  setTimeout(() => {
    console.log('🔄 Test backup incrementale...');
    dailyBackupJob.fire();
  }, 2000);
  
  setTimeout(() => {
    console.log('🔄 Test pulizia backup...');
    cleanupJob.fire();
  }, 4000);
}

// Gestione segnali per shutdown graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Ricevuto SIGINT, arresto cron job backup...');
  stopBackupCronJobs();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Ricevuto SIGTERM, arresto cron job backup...');
  stopBackupCronJobs();
  process.exit(0);
});

// Esegui se chiamato direttamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('start')) {
    startBackupCronJobs();
    
    // Mantieni il processo attivo
    console.log('⏳ Cron job backup in esecuzione. Premi Ctrl+C per fermare...');
    setInterval(() => {
      // Mantieni il processo attivo
    }, 1000);
    
  } else if (args.includes('stop')) {
    stopBackupCronJobs();
    
  } else if (args.includes('test')) {
    testBackupCronJobs();
    
  } else {
    console.log('📋 Utilizzo:');
    console.log('  node backup-cron.js start  - Avvia i cron job backup');
    console.log('  node backup-cron.js stop    - Ferma i cron job backup');
    console.log('  node backup-cron.js test    - Testa i cron job backup');
    console.log('');
    console.log('📅 I cron job eseguiranno:');
    console.log('- Backup completo ogni domenica alle 2:00');
    console.log('- Backup incrementale ogni giorno alle 3:00');
    console.log('- Pulizia backup vecchi ogni domenica alle 4:00');
  }
}

module.exports = {
  startBackupCronJobs,
  stopBackupCronJobs,
  testBackupCronJobs,
  weeklyBackupJob,
  dailyBackupJob,
  cleanupJob
};
