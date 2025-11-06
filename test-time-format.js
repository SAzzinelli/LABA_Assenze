const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

// Test con formato con secondi (come nel DB)
const schedule1 = {
  start_time: '09:00:00',
  end_time: '18:00:00',
  break_duration: 60,
  break_start_time: '13:00:00'
};

// Test con formato senza secondi
const schedule2 = {
  start_time: '09:00',
  end_time: '18:00',
  break_duration: 60,
  break_start_time: '13:00'
};

console.log('🧪 Test formato orario con secondi (09:00:00):');
const result1 = calculateRealTimeHours(schedule1, '17:00', null);
console.log(`   Actual: ${result1.actualHours}h, Balance: ${result1.balanceHours}h\n`);

console.log('🧪 Test formato orario senza secondi (09:00):');
const result2 = calculateRealTimeHours(schedule2, '17:00', null);
console.log(`   Actual: ${result2.actualHours}h, Balance: ${result2.balanceHours}h\n`);

if (result1.actualHours !== result2.actualHours) {
  console.log('❌ PROBLEMA: I formati danno risultati diversi!');
} else {
  console.log('✅ I formati funzionano entrambi correttamente');
}
