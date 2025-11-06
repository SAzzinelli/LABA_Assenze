require('dotenv').config();
const { calculateRealTimeHours } = require('./server/utils/hoursCalculation');

// Test: alle 17:00 con orario 09:00-18:00, pausa 13:00-14:00
const schedule = {
  start_time: '09:00',
  end_time: '18:00',
  break_duration: 60,
  break_start_time: '13:00'
};

const currentTime = '17:00';

console.log('🧪 Test calcolo ore alle 17:00');
console.log('   Orario: 09:00-18:00');
console.log('   Pausa: 13:00-14:00 (60 min)');
console.log('   Tempo corrente: 17:00\n');

const result = calculateRealTimeHours(schedule, currentTime, null);

console.log('📊 Risultato:');
console.log(`   Expected: ${result.expectedHours}h`);
console.log(`   Actual: ${result.actualHours}h`);
console.log(`   Balance: ${result.balanceHours}h`);
console.log(`   Status: ${result.status}\n`);

// Calcolo manuale
console.log('🧮 Calcolo manuale:');
console.log('   09:00-13:00 = 4h');
console.log('   14:00-17:00 = 3h');
console.log('   Totale: 7h (non 6h!)\n');

if (result.actualHours < 7) {
  console.log('❌ PROBLEMA: Il calcolo mostra meno di 7h!');
  console.log('   La pausa pranzo viene sottratta alla fine invece che durante il calcolo.\n');
} else {
  console.log('✅ Calcolo corretto!');
}
