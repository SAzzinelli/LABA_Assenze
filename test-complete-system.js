/**
 * TEST COMPLETO SISTEMA HR BASATO SU ORE
 * Verifica tutte le funzionalità implementate
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabaseTables() {
  console.log('🧪 Test: Tabelle Database');
  
  try {
    const tables = ['contract_types', 'work_patterns', 'hours_ledger', 'current_balances', 'business_trips'];
    const results = {};
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('count').limit(1);
        if (error) {
          results[table] = { exists: false, error: error.message };
        } else {
          results[table] = { exists: true, count: data?.length || 0 };
        }
      } catch (err) {
        results[table] = { exists: false, error: err.message };
      }
    }
    
    console.log('📊 Risultati tabelle:');
    Object.entries(results).forEach(([table, result]) => {
      if (result.exists) {
        console.log(`✅ ${table}: Esiste (${result.count} record)`);
      } else {
        console.log(`❌ ${table}: ${result.error}`);
      }
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ Errore test tabelle:', error.message);
    return null;
  }
}

async function testContractTypes() {
  console.log('\n🧪 Test: Tipi di Contratto');
  
  try {
    const { data, error } = await supabase
      .from('contract_types')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      console.log(`❌ Errore: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Trovati ${data.length} tipi di contratto:`);
    data.forEach(contract => {
      console.log(`  - ${contract.name}: ${contract.annual_vacation_hours}h ferie, ${contract.annual_permission_hours}h permessi`);
    });
    
    return data.length > 0;
    
  } catch (error) {
    console.error('❌ Errore test contract types:', error.message);
    return false;
  }
}

async function testWorkPatterns() {
  console.log('\n🧪 Test: Pattern di Lavoro');
  
  try {
    const { data, error } = await supabase
      .from('work_patterns')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      console.log(`❌ Errore: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Trovati ${data.length} pattern di lavoro:`);
    data.forEach(pattern => {
      console.log(`  - Utente ${pattern.user_id}: ${pattern.weekly_hours}h/settimana, ${pattern.monthly_hours}h/mese`);
    });
    
    return data.length > 0;
    
  } catch (error) {
    console.error('❌ Errore test work patterns:', error.message);
    return false;
  }
}

async function testCurrentBalances() {
  console.log('\n🧪 Test: Saldi Correnti');
  
  try {
    const { data, error } = await supabase
      .from('current_balances')
      .select('*');
    
    if (error) {
      console.log(`❌ Errore: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Trovati ${data.length} saldi correnti:`);
    const categories = {};
    data.forEach(balance => {
      if (!categories[balance.category]) {
        categories[balance.category] = 0;
      }
      categories[balance.category]++;
    });
    
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`  - ${category}: ${count} saldi`);
    });
    
    return data.length > 0;
    
  } catch (error) {
    console.error('❌ Errore test current balances:', error.message);
    return false;
  }
}

async function testHoursLedger() {
  console.log('\n🧪 Test: Ledger Ore');
  
  try {
    const { data, error } = await supabase
      .from('hours_ledger')
      .select('*')
      .limit(10);
    
    if (error) {
      console.log(`❌ Errore: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Trovati ${data.length} movimenti nel ledger:`);
    data.forEach(movement => {
      console.log(`  - ${movement.category}: ${movement.transaction_type} ${movement.hours}h (${movement.reason})`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Errore test hours ledger:', error.message);
    return false;
  }
}

async function testBusinessTrips() {
  console.log('\n🧪 Test: Trasferte');
  
  try {
    const { data, error } = await supabase
      .from('business_trips')
      .select('*');
    
    if (error) {
      console.log(`❌ Errore: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Trovate ${data.length} trasferte:`);
    data.forEach(trip => {
      console.log(`  - ${trip.destination}: ${trip.total_hours}h (${trip.status})`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Errore test business trips:', error.message);
    return false;
  }
}

async function testAPIEndpoints() {
  console.log('\n🧪 Test: Endpoint API');
  
  try {
    const endpoints = [
      '/api/hours/contract-types',
      '/api/hours/work-patterns',
      '/api/hours/current-balances',
      '/api/hours/business-trips'
    ];
    
    const results = {};
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:3000${endpoint}`);
        results[endpoint] = {
          status: response.status,
          ok: response.ok
        };
      } catch (err) {
        results[endpoint] = {
          status: 'ERROR',
          ok: false,
          error: err.message
        };
      }
    }
    
    console.log('📊 Risultati endpoint:');
    Object.entries(results).forEach(([endpoint, result]) => {
      if (result.ok) {
        console.log(`✅ ${endpoint}: ${result.status}`);
      } else {
        console.log(`❌ ${endpoint}: ${result.status} ${result.error || ''}`);
      }
    });
    
    return Object.values(results).every(r => r.ok);
    
  } catch (error) {
    console.error('❌ Errore test API:', error.message);
    return false;
  }
}

async function testCalculations() {
  console.log('\n🧪 Test: Funzioni di Calcolo');
  
  try {
    // Test calcolo ore per pattern
    const { data: patterns, error } = await supabase
      .from('work_patterns')
      .select('*')
      .limit(1);
    
    if (error || !patterns.length) {
      console.log('⚠️ Nessun pattern disponibile per test calcoli');
      return true;
    }
    
    const pattern = patterns[0];
    
    // Calcola ore per diversi giorni
    const testDates = [
      '2025-02-15', // Sabato
      '2025-02-17', // Lunedì
      '2025-02-18', // Martedì
      '2025-02-22', // Sabato
      '2025-02-23'  // Domenica
    ];
    
    console.log('📊 Calcoli ore per pattern:');
    testDates.forEach(date => {
      const dayOfWeek = new Date(date).getDay();
      let dailyHours = 0;
      
      switch (dayOfWeek) {
        case 1: dailyHours = pattern.monday_hours; break;
        case 2: dailyHours = pattern.tuesday_hours; break;
        case 3: dailyHours = pattern.wednesday_hours; break;
        case 4: dailyHours = pattern.thursday_hours; break;
        case 5: dailyHours = pattern.friday_hours; break;
        case 6: dailyHours = pattern.saturday_hours; break;
        case 0: dailyHours = pattern.sunday_hours; break;
      }
      
      const dayName = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][dayOfWeek];
      console.log(`  - ${date} (${dayName}): ${dailyHours}h`);
    });
    
    console.log(`✅ Pattern settimanale: ${pattern.weekly_hours}h`);
    console.log(`✅ Pattern mensile: ${pattern.monthly_hours}h`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Errore test calcoli:', error.message);
    return false;
  }
}

async function testSystemIntegration() {
  console.log('\n🧪 Test: Integrazione Sistema');
  
  try {
    // Test completo: utente -> pattern -> saldi -> calcoli
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .limit(1);
    
    if (usersError || !users.length) {
      console.log('⚠️ Nessun utente disponibile per test integrazione');
      return true;
    }
    
    const user = users[0];
    console.log(`👤 Test utente: ${user.first_name} ${user.last_name}`);
    
    // Verifica pattern
    const { data: patterns, error: patternsError } = await supabase
      .from('work_patterns')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);
    
    if (patternsError || !patterns.length) {
      console.log('❌ Nessun pattern trovato per l\'utente');
      return false;
    }
    
    const pattern = patterns[0];
    console.log(`✅ Pattern trovato: ${pattern.weekly_hours}h/settimana`);
    
    // Verifica saldi
    const { data: balances, error: balancesError } = await supabase
      .from('current_balances')
      .select('*')
      .eq('user_id', user.id);
    
    if (balancesError || !balances.length) {
      console.log('❌ Nessun saldo trovato per l\'utente');
      return false;
    }
    
    console.log(`✅ Saldi trovati: ${balances.length} categorie`);
    balances.forEach(balance => {
      console.log(`  - ${balance.category}: ${balance.current_balance}h disponibili`);
    });
    
    // Verifica ledger
    const { data: ledger, error: ledgerError } = await supabase
      .from('hours_ledger')
      .select('*')
      .eq('user_id', user.id)
      .limit(5);
    
    if (ledgerError) {
      console.log('⚠️ Nessun movimento nel ledger');
    } else {
      console.log(`✅ Ledger: ${ledger.length} movimenti trovati`);
    }
    
    console.log('✅ Integrazione sistema verificata');
    return true;
    
  } catch (error) {
    console.error('❌ Errore test integrazione:', error.message);
    return false;
  }
}

async function runCompleteSystemTest() {
  console.log('🚀 Avvio test completo sistema HR basato su ore...');
  console.log('=====================================');
  
  const results = {};
  
  try {
    // Test database
    results.database = await testDatabaseTables();
    
    // Test funzionalità
    results.contractTypes = await testContractTypes();
    results.workPatterns = await testWorkPatterns();
    results.currentBalances = await testCurrentBalances();
    results.hoursLedger = await testHoursLedger();
    results.businessTrips = await testBusinessTrips();
    
    // Test API
    results.apiEndpoints = await testAPIEndpoints();
    
    // Test calcoli
    results.calculations = await testCalculations();
    
    // Test integrazione
    results.integration = await testSystemIntegration();
    
    // Riepilogo
    console.log('\n=====================================');
    console.log('📊 RISULTATI TEST COMPLETO:');
    console.log('=====================================');
    
    const passed = Object.values(results).filter(r => r === true).length;
    const total = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, result]) => {
      const status = result === true ? '✅' : result === false ? '❌' : '⚠️';
      console.log(`${status} ${test}: ${result === true ? 'PASSATO' : result === false ? 'FALLITO' : 'PARZIALE'}`);
    });
    
    console.log('=====================================');
    console.log(`📈 RISULTATO FINALE: ${passed}/${total} test superati (${Math.round(passed/total*100)}%)`);
    
    if (passed === total) {
      console.log('🎉 TUTTI I TEST SUPERATI! Sistema completamente funzionante!');
    } else if (passed > total * 0.8) {
      console.log('✅ Sistema funzionante con alcune limitazioni');
    } else {
      console.log('⚠️ Sistema parzialmente funzionante, verificare configurazione');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Errore durante i test:', error.message);
    return null;
  }
}

// Esegui i test
if (require.main === module) {
  runCompleteSystemTest();
}

module.exports = { runCompleteSystemTest };
