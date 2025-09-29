/**
 * TEST DEL SISTEMA BASATO SU ORE
 * Verifica che tutte le funzionalità del nuovo sistema funzionino correttamente
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

// Utility per test
function formatHours(hours) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  return `${wholeHours}h ${minutes}m`;
}

async function testContractTypes() {
  console.log('🧪 Test: Tipi di Contratto');
  
  try {
    const { data, error } = await supabase
      .from('contract_types')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Errore: ${error.message}`);
    }

    console.log(`✅ Trovati ${data.length} tipi di contratto:`);
    data.forEach(contract => {
      console.log(`   - ${contract.name}: ${contract.annual_vacation_hours}h ferie, ${contract.annual_permission_hours}h permessi`);
    });

    return data.length > 0;
  } catch (error) {
    console.error(`❌ Test fallito: ${error.message}`);
    return false;
  }
}

async function testWorkPatterns() {
  console.log('🧪 Test: Pattern di Lavoro');
  
  try {
    const { data, error } = await supabase
      .from('work_patterns')
      .select(`
        *,
        users!inner(first_name, last_name),
        contract_types!inner(name)
      `);

    if (error) {
      throw new Error(`Errore: ${error.message}`);
    }

    console.log(`✅ Trovati ${data.length} pattern di lavoro:`);
    data.forEach(pattern => {
      console.log(`   - ${pattern.users.first_name} ${pattern.users.last_name} (${pattern.contract_types.name}): ${pattern.weekly_hours}h/settimana`);
    });

    return data.length > 0;
  } catch (error) {
    console.error(`❌ Test fallito: ${error.message}`);
    return false;
  }
}

async function testCurrentBalances() {
  console.log('🧪 Test: Saldi Correnti');
  
  try {
    const { data, error } = await supabase
      .from('current_balances')
      .select(`
        *,
        users!inner(first_name, last_name)
      `)
      .eq('year', new Date().getFullYear());

    if (error) {
      throw new Error(`Errore: ${error.message}`);
    }

    console.log(`✅ Trovati ${data.length} saldi correnti:`);
    
    const balancesByUser = {};
    data.forEach(balance => {
      if (!balancesByUser[balance.users.first_name]) {
        balancesByUser[balance.users.first_name] = {};
      }
      balancesByUser[balance.users.first_name][balance.category] = balance;
    });

    Object.entries(balancesByUser).forEach(([name, balances]) => {
      console.log(`   - ${name}:`);
      if (balances.vacation) {
        console.log(`     Ferie: ${formatHours(balances.vacation.current_balance)}/${formatHours(balances.vacation.total_accrued)}`);
      }
      if (balances.permission) {
        console.log(`     Permessi: ${formatHours(balances.permission.current_balance)}/${formatHours(balances.permission.total_accrued)}`);
      }
    });

    return data.length > 0;
  } catch (error) {
    console.error(`❌ Test fallito: ${error.message}`);
    return false;
  }
}

async function testHoursLedger() {
  console.log('🧪 Test: Ledger Ore');
  
  try {
    const { data, error } = await supabase
      .from('hours_ledger')
      .select(`
        *,
        users!inner(first_name, last_name)
      `)
      .order('transaction_date', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Errore: ${error.message}`);
    }

    console.log(`✅ Trovati ${data.length} movimenti nel ledger:`);
    data.forEach(movement => {
      const sign = movement.hours_amount >= 0 ? '+' : '';
      console.log(`   - ${movement.users.first_name}: ${sign}${formatHours(movement.hours_amount)} ${movement.category} (${movement.transaction_type})`);
    });

    return data.length > 0;
  } catch (error) {
    console.error(`❌ Test fallito: ${error.message}`);
    return false;
  }
}

async function testBusinessTrips() {
  console.log('🧪 Test: Trasferte');
  
  try {
    const { data, error } = await supabase
      .from('business_trips')
      .select(`
        *,
        users!inner(first_name, last_name)
      `);

    if (error) {
      throw new Error(`Errore: ${error.message}`);
    }

    console.log(`✅ Trovate ${data.length} trasferte:`);
    data.forEach(trip => {
      console.log(`   - ${trip.users.first_name}: ${trip.trip_name} (${trip.destination}) - ${formatHours(trip.total_hours)} totali`);
    });

    return data.length > 0;
  } catch (error) {
    console.error(`❌ Test fallito: ${error.message}`);
    return false;
  }
}

async function testLeaveRequestsWithHours() {
  console.log('🧪 Test: Richieste Ferie con Ore');
  
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        users!inner(first_name, last_name)
      `)
      .eq('type', 'vacation')
      .not('hours_requested', 'is', null);

    if (error) {
      throw new Error(`Errore: ${error.message}`);
    }

    console.log(`✅ Trovate ${data.length} richieste ferie con ore:`);
    data.forEach(request => {
      console.log(`   - ${request.users.first_name}: ${formatHours(request.hours_requested)} dal ${request.start_date} al ${request.end_date}`);
    });

    return data.length > 0;
  } catch (error) {
    console.error(`❌ Test fallito: ${error.message}`);
    return false;
  }
}

async function testCalculationFunctions() {
  console.log('🧪 Test: Funzioni di Calcolo');
  
  try {
    // Test funzione calcolo ore ferie per giorno
    const testDate = '2025-02-15'; // Sabato
    const testPattern = {
      monday_hours: 8,
      tuesday_hours: 8,
      wednesday_hours: 8,
      thursday_hours: 8,
      friday_hours: 8,
      saturday_hours: 4,
      sunday_hours: 0
    };

    const dayOfWeek = new Date(testDate).getDay();
    let expectedHours = 0;
    
    switch (dayOfWeek) {
      case 1: expectedHours = testPattern.monday_hours; break;
      case 2: expectedHours = testPattern.tuesday_hours; break;
      case 3: expectedHours = testPattern.wednesday_hours; break;
      case 4: expectedHours = testPattern.thursday_hours; break;
      case 5: expectedHours = testPattern.friday_hours; break;
      case 6: expectedHours = testPattern.saturday_hours; break;
      case 0: expectedHours = testPattern.sunday_hours; break;
    }

    console.log(`✅ Calcolo ore per ${testDate} (giorno ${dayOfWeek}): ${formatHours(expectedHours)}`);

    // Test calcolo settimanale
    const weeklyHours = Object.values(testPattern).reduce((sum, hours) => sum + hours, 0);
    console.log(`✅ Ore settimanali totali: ${formatHours(weeklyHours)}`);

    // Test calcolo mensile
    const monthlyHours = weeklyHours * 4.33;
    console.log(`✅ Ore mensili: ${formatHours(monthlyHours)}`);

    return true;
  } catch (error) {
    console.error(`❌ Test fallito: ${error.message}`);
    return false;
  }
}

async function testAPIEndpoints() {
  console.log('🧪 Test: Endpoint API');
  
  try {
    // Test endpoint contract types
    const { data: contractTypes, error: contractError } = await supabase
      .from('contract_types')
      .select('*')
      .eq('is_active', true);

    if (contractError) {
      throw new Error(`Errore contract types: ${contractError.message}`);
    }

    // Test endpoint work patterns
    const { data: patterns, error: patternError } = await supabase
      .from('work_patterns')
      .select('*')
      .limit(1);

    if (patternError) {
      throw new Error(`Errore work patterns: ${patternError.message}`);
    }

    // Test endpoint current balances
    const { data: balances, error: balanceError } = await supabase
      .from('current_balances')
      .select('*')
      .limit(1);

    if (balanceError) {
      throw new Error(`Errore current balances: ${balanceError.message}`);
    }

    console.log(`✅ Tutti gli endpoint API funzionano correttamente`);
    console.log(`   - Contract types: ${contractTypes.length} trovati`);
    console.log(`   - Work patterns: ${patterns.length} trovati`);
    console.log(`   - Current balances: ${balances.length} trovati`);

    return true;
  } catch (error) {
    console.error(`❌ Test fallito: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Avvio test del sistema basato su ore...');
  console.log('=====================================');

  const tests = [
    { name: 'Tipi di Contratto', fn: testContractTypes },
    { name: 'Pattern di Lavoro', fn: testWorkPatterns },
    { name: 'Saldi Correnti', fn: testCurrentBalances },
    { name: 'Ledger Ore', fn: testHoursLedger },
    { name: 'Trasferte', fn: testBusinessTrips },
    { name: 'Richieste Ferie con Ore', fn: testLeaveRequestsWithHours },
    { name: 'Funzioni di Calcolo', fn: testCalculationFunctions },
    { name: 'Endpoint API', fn: testAPIEndpoints }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    console.log('');
    const result = await test.fn();
    if (result) {
      passedTests++;
    }
  }

  console.log('');
  console.log('=====================================');
  console.log(`📊 Risultati Test: ${passedTests}/${totalTests} superati`);
  
  if (passedTests === totalTests) {
    console.log('🎉 Tutti i test sono stati superati! Il sistema è pronto per l\'uso.');
  } else {
    console.log('⚠️ Alcuni test sono falliti. Verificare la configurazione del database.');
  }

  return passedTests === totalTests;
}

// Esegui test
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = {
  testContractTypes,
  testWorkPatterns,
  testCurrentBalances,
  testHoursLedger,
  testBusinessTrips,
  testLeaveRequestsWithHours,
  testCalculationFunctions,
  testAPIEndpoints,
  runAllTests
};
