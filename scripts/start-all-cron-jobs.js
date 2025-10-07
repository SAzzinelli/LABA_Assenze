/**
 * AVVIO TUTTI I CRON JOB DEL SISTEMA HR
 * Avvia tutti i cron job necessari per il funzionamento automatico del sistema
 */

const { startMonthlyAccrualCron } = require('./setup-cron');
const { startBackupCronJobs } = require('./backup-cron');
const { startHourlyAttendanceSaver } = require('./hourly-attendance-saver');
const { startDailyAttendanceFinalizer } = require('./daily-attendance-finalizer');

/**
 * Avvia tutti i cron job del sistema
 */
function startAllCronJobs() {
  console.log('🚀 Avvio di tutti i cron job del sistema HR...');
  console.log('='.repeat(60));
  
  try {
    // 1. Cron job per salvataggio presenze ogni ora
    console.log('📅 1. Salvataggio presenze ogni ora...');
    startHourlyAttendanceSaver();
    
    // 2. Cron job per finalizzazione giornata a mezzanotte
    console.log('📅 2. Finalizzazione giornata a mezzanotte...');
    startDailyAttendanceFinalizer();
    
    // 3. Cron job per maturazione mensile
    console.log('📅 3. Maturazione mensile...');
    startMonthlyAccrualCron();
    
    // 4. Cron job per backup automatici
    console.log('📅 4. Backup automatici...');
    startBackupCronJobs();
    
    console.log('='.repeat(60));
    console.log('✅ Tutti i cron job sono stati avviati con successo!');
    console.log('');
    console.log('📋 Riepilogo cron job attivi:');
    console.log('  🕘 Salvataggio presenze: Ogni ora al minuto 0');
    console.log('  🌙 Finalizzazione giornata: Ogni giorno a mezzanotte');
    console.log('  📊 Maturazione mensile: Ogni primo del mese alle 9:00');
    console.log('  💾 Backup completo: Ogni domenica alle 2:00');
    console.log('  💾 Backup incrementale: Ogni giorno alle 3:00');
    console.log('  🧹 Pulizia backup: Ogni domenica alle 4:00');
    console.log('');
    console.log('⏳ Il sistema è ora completamente automatico!');
    console.log('   Premi Ctrl+C per fermare tutti i cron job.');
    
  } catch (error) {
    console.error('❌ Errore durante l\'avvio dei cron job:', error.message);
    process.exit(1);
  }
}

/**
 * Ferma tutti i cron job del sistema
 */
function stopAllCronJobs() {
  console.log('🛑 Arresto di tutti i cron job del sistema HR...');
  
  try {
    const { stopMonthlyAccrualCron } = require('./setup-cron');
    const { stopBackupCronJobs } = require('./backup-cron');
    const { stopHourlyAttendanceSaver } = require('./hourly-attendance-saver');
    const { stopDailyAttendanceFinalizer } = require('./daily-attendance-finalizer');
    
    stopHourlyAttendanceSaver();
    stopDailyAttendanceFinalizer();
    stopMonthlyAccrualCron();
    stopBackupCronJobs();
    
    console.log('✅ Tutti i cron job sono stati fermati');
    
  } catch (error) {
    console.error('❌ Errore durante l\'arresto dei cron job:', error.message);
  }
}

// Gestione segnali per shutdown graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Ricevuto SIGINT, arresto tutti i cron job...');
  stopAllCronJobs();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Ricevuto SIGTERM, arresto tutti i cron job...');
  stopAllCronJobs();
  process.exit(0);
});

// Esegui se chiamato direttamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('start')) {
    startAllCronJobs();
    
    // Mantieni il processo attivo
    setInterval(() => {
      // Mantieni il processo attivo
    }, 1000);
    
  } else if (args.includes('stop')) {
    stopAllCronJobs();
    
  } else {
    console.log('📋 Utilizzo:');
    console.log('  node start-all-cron-jobs.js start  - Avvia tutti i cron job');
    console.log('  node start-all-cron-jobs.js stop   - Ferma tutti i cron job');
    console.log('');
    console.log('📅 Questo script avvia:');
    console.log('  - Salvataggio presenze ogni ora');
    console.log('  - Finalizzazione giornata a mezzanotte');
    console.log('  - Maturazione mensile');
    console.log('  - Backup automatici');
    console.log('');
    console.log('🔧 Assicurati di configurare ADMIN_TOKEN nelle variabili d\'ambiente');
  }
}

module.exports = {
  startAllCronJobs,
  stopAllCronJobs
};
