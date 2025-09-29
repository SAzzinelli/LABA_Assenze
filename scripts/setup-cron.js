/**
 * SETUP CRON JOB PER MATURAZIONE AUTOMATICA MENSILE
 * Configura l'esecuzione automatica della maturazione ogni primo del mese
 */

const cron = require('node-cron');
const { runMonthlyAccrual } = require('./monthly-accrual');

// Cron job per eseguire la maturazione ogni primo del mese alle 9:00
const monthlyAccrualJob = cron.schedule('0 9 1 * *', async () => {
  console.log('🕘 Cron job: Avvio maturazione mensile automatica...');
  console.log('📅 Data:', new Date().toLocaleString('it-IT'));
  
  try {
    await runMonthlyAccrual();
    console.log('✅ Cron job: Maturazione mensile completata con successo');
  } catch (error) {
    console.error('❌ Cron job: Errore durante la maturazione mensile:', error.message);
  }
}, {
  scheduled: false, // Non avviare automaticamente
  timezone: 'Europe/Rome'
});

// Funzione per avviare il cron job
function startMonthlyAccrualCron() {
  console.log('🚀 Avvio cron job per maturazione mensile automatica...');
  console.log('📅 Esecuzione: Ogni primo del mese alle 9:00 (fuso orario Roma)');
  
  monthlyAccrualJob.start();
  
  console.log('✅ Cron job attivato');
  console.log('📋 Prossima esecuzione:', monthlyAccrualJob.nextDate().toLocaleString('it-IT'));
}

// Funzione per fermare il cron job
function stopMonthlyAccrualCron() {
  console.log('🛑 Arresto cron job per maturazione mensile...');
  monthlyAccrualJob.stop();
  console.log('✅ Cron job fermato');
}

// Funzione per testare il cron job (esecuzione immediata)
function testMonthlyAccrualCron() {
  console.log('🧪 Test esecuzione cron job...');
  monthlyAccrualJob.fire();
}

// Gestione segnali per shutdown graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Ricevuto SIGINT, arresto cron job...');
  stopMonthlyAccrualCron();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Ricevuto SIGTERM, arresto cron job...');
  stopMonthlyAccrualCron();
  process.exit(0);
});

// Esegui se chiamato direttamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('start')) {
    startMonthlyAccrualCron();
    
    // Mantieni il processo attivo
    console.log('⏳ Cron job in esecuzione. Premi Ctrl+C per fermare...');
    setInterval(() => {
      // Mantieni il processo attivo
    }, 1000);
    
  } else if (args.includes('stop')) {
    stopMonthlyAccrualCron();
    
  } else if (args.includes('test')) {
    testMonthlyAccrualCron();
    
  } else {
    console.log('📋 Utilizzo:');
    console.log('  node setup-cron.js start  - Avvia il cron job');
    console.log('  node setup-cron.js stop    - Ferma il cron job');
    console.log('  node setup-cron.js test    - Testa il cron job');
    console.log('');
    console.log('📅 Il cron job eseguirà la maturazione mensile ogni primo del mese alle 9:00');
  }
}

module.exports = {
  startMonthlyAccrualCron,
  stopMonthlyAccrualCron,
  testMonthlyAccrualCron,
  monthlyAccrualJob
};
