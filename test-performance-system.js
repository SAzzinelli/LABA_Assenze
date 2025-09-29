#!/usr/bin/env node

/**
 * Test Performance Sistema Ore HR LABA
 * 
 * Questo script testa le performance del sistema basato su ore,
 * misurando tempi di risposta, throughput e utilizzo risorse.
 */

const { createClient } = require('@supabase/supabase-js');
const performance = require('perf_hooks').performance;

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvamhsamN6cHdianhiYnJ0cmxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NjQ5NDEsImV4cCI6MjA1MTE0MDk0MX0.8QZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq';

const supabase = createClient(supabaseUrl, supabaseKey);

// Configurazione test
const TEST_CONFIG = {
  iterations: 100,
  concurrentUsers: 10,
  testDuration: 30000, // 30 secondi
  warmupIterations: 10
};

// Statistiche performance
const stats = {
  apiCalls: {
    contractTypes: { times: [], errors: 0 },
    workPatterns: { times: [], errors: 0 },
    currentBalances: { times: [], errors: 0 },
    businessTrips: { times: [], errors: 0 },
    calculations: { times: [], errors: 0 }
  },
  database: {
    queries: { times: [], errors: 0 },
    inserts: { times: [], errors: 0 },
    updates: { times: [], errors: 0 }
  },
  memory: {
    initial: 0,
    peak: 0,
    current: 0
  }
};

/**
 * Misura tempo di esecuzione di una funzione
 */
async function measureTime(fn, label) {
  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    const duration = end - start;
    
    if (stats.apiCalls[label]) {
      stats.apiCalls[label].times.push(duration);
    } else if (stats.database[label]) {
      stats.database[label].times.push(duration);
    }
    
    return { result, duration, error: null };
  } catch (error) {
    const end = performance.now();
    const duration = end - start;
    
    if (stats.apiCalls[label]) {
      stats.apiCalls[label].errors++;
    } else if (stats.database[label]) {
      stats.database[label].errors++;
    }
    
    return { result: null, duration, error };
  }
}

/**
 * Test performance query database
 */
async function testDatabasePerformance() {
  console.log('🧪 Test Performance Database...');
  
  // Test query contract_types
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    await measureTime(async () => {
      const { data, error } = await supabase
        .from('contract_types')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    }, 'queries');
  }
  
  // Test query work_patterns
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    await measureTime(async () => {
      const { data, error } = await supabase
        .from('work_patterns')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    }, 'queries');
  }
  
  // Test query hours_ledger
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    await measureTime(async () => {
      const { data, error } = await supabase
        .from('hours_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }, 'queries');
  }
  
  console.log('✅ Test Database completato');
}

/**
 * Test performance calcoli ore
 */
async function testCalculationPerformance() {
  console.log('🧪 Test Performance Calcoli...');
  
  // Simula calcoli complessi
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    await measureTime(async () => {
      // Simula calcolo ferie per periodo
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');
      const workPattern = {
        monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8,
        saturday: 0, sunday: 0
      };
      
      let totalHours = 0;
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
        
        if (workPattern[dayName] > 0) {
          totalHours += workPattern[dayName];
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return totalHours;
    }, 'calculations');
  }
  
  console.log('✅ Test Calcoli completato');
}

/**
 * Test performance operazioni CRUD
 */
async function testCRUDPerformance() {
  console.log('🧪 Test Performance CRUD...');
  
  // Test inserimenti
  for (let i = 0; i < 10; i++) {
    await measureTime(async () => {
      const { data, error } = await supabase
        .from('hours_ledger')
        .insert({
          user_id: 'test-user-' + i,
          category: 'vacation',
          type: 'accrual',
          hours: 8,
          reason: 'Test performance',
          period_year: 2025,
          period_month: 9
        });
      
      if (error) throw error;
      return data;
    }, 'inserts');
  }
  
  // Test aggiornamenti
  for (let i = 0; i < 10; i++) {
    await measureTime(async () => {
      const { data, error } = await supabase
        .from('hours_ledger')
        .update({ reason: 'Test performance updated' })
        .eq('reason', 'Test performance');
      
      if (error) throw error;
      return data;
    }, 'updates');
  }
  
  console.log('✅ Test CRUD completato');
}

/**
 * Test carico concorrente
 */
async function testConcurrentLoad() {
  console.log('🧪 Test Carico Concorrente...');
  
  const promises = [];
  
  for (let i = 0; i < TEST_CONFIG.concurrentUsers; i++) {
    promises.push(
      measureTime(async () => {
        // Simula operazioni multiple per utente
        const { data: contracts } = await supabase
          .from('contract_types')
          .select('*');
        
        const { data: patterns } = await supabase
          .from('work_patterns')
          .select('*');
        
        const { data: balances } = await supabase
          .from('current_balances')
          .select('*');
        
        return { contracts, patterns, balances };
      }, 'queries')
    );
  }
  
  await Promise.all(promises);
  console.log('✅ Test Carico Concorrente completato');
}

/**
 * Test stress del sistema
 */
async function testStressSystem() {
  console.log('🧪 Test Stress Sistema...');
  
  const startTime = Date.now();
  const promises = [];
  
  while (Date.now() - startTime < TEST_CONFIG.testDuration) {
    promises.push(
      measureTime(async () => {
        // Operazioni multiple simultanee
        const [contracts, patterns, ledger, balances] = await Promise.all([
          supabase.from('contract_types').select('*'),
          supabase.from('work_patterns').select('*'),
          supabase.from('hours_ledger').select('*').limit(50),
          supabase.from('current_balances').select('*')
        ]);
        
        return { contracts, patterns, ledger, balances };
      }, 'queries')
    );
    
    // Limita il numero di promise simultanee
    if (promises.length >= 50) {
      await Promise.all(promises.splice(0, 25));
    }
  }
  
  // Completa le promise rimanenti
  if (promises.length > 0) {
    await Promise.all(promises);
  }
  
  console.log('✅ Test Stress completato');
}

/**
 * Calcola statistiche
 */
function calculateStats(times) {
  if (times.length === 0) return null;
  
  const sorted = times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  
  return {
    count: times.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / times.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

/**
 * Monitora utilizzo memoria
 */
function monitorMemory() {
  const memUsage = process.memoryUsage();
  stats.memory.current = memUsage.heapUsed / 1024 / 1024; // MB
  
  if (stats.memory.peak < stats.memory.current) {
    stats.memory.peak = stats.memory.current;
  }
}

/**
 * Genera report performance
 */
function generateReport() {
  console.log('\n📊 REPORT PERFORMANCE SISTEMA ORE');
  console.log('=====================================');
  
  // Statistiche Database
  console.log('\n🗄️ PERFORMANCE DATABASE:');
  Object.entries(stats.database).forEach(([operation, data]) => {
    if (data.times.length > 0) {
      const stats_calc = calculateStats(data.times);
      console.log(`  ${operation.toUpperCase()}:`);
      console.log(`    Operazioni: ${stats_calc.count}`);
      console.log(`    Tempo medio: ${stats_calc.avg.toFixed(2)}ms`);
      console.log(`    Tempo min: ${stats_calc.min.toFixed(2)}ms`);
      console.log(`    Tempo max: ${stats_calc.max.toFixed(2)}ms`);
      console.log(`    P95: ${stats_calc.p95.toFixed(2)}ms`);
      console.log(`    P99: ${stats_calc.p99.toFixed(2)}ms`);
      console.log(`    Errori: ${data.errors}`);
    }
  });
  
  // Statistiche Calcoli
  console.log('\n🧮 PERFORMANCE CALCOLI:');
  if (stats.apiCalls.calculations.times.length > 0) {
    const calcStats = calculateStats(stats.apiCalls.calculations.times);
    console.log(`  Operazioni: ${calcStats.count}`);
    console.log(`  Tempo medio: ${calcStats.avg.toFixed(2)}ms`);
    console.log(`  Tempo min: ${calcStats.min.toFixed(2)}ms`);
    console.log(`  Tempo max: ${calcStats.max.toFixed(2)}ms`);
    console.log(`  P95: ${calcStats.p95.toFixed(2)}ms`);
    console.log(`  P99: ${calcStats.p99.toFixed(2)}ms`);
    console.log(`  Errori: ${stats.apiCalls.calculations.errors}`);
  }
  
  // Utilizzo Memoria
  console.log('\n💾 UTILIZZO MEMORIA:');
  console.log(`  Memoria iniziale: ${stats.memory.initial.toFixed(2)} MB`);
  console.log(`  Memoria picco: ${stats.memory.peak.toFixed(2)} MB`);
  console.log(`  Memoria corrente: ${stats.memory.current.toFixed(2)} MB`);
  console.log(`  Incremento: ${(stats.memory.peak - stats.memory.initial).toFixed(2)} MB`);
  
  // Raccomandazioni
  console.log('\n💡 RACCOMANDAZIONI:');
  
  const avgQueryTime = stats.database.queries.times.length > 0 
    ? calculateStats(stats.database.queries.times).avg 
    : 0;
  
  if (avgQueryTime > 100) {
    console.log('  ⚠️ Tempi query elevati (>100ms) - Considerare ottimizzazioni indici');
  } else if (avgQueryTime > 50) {
    console.log('  ⚠️ Tempi query moderati (>50ms) - Monitorare performance');
  } else {
    console.log('  ✅ Tempi query ottimali (<50ms)');
  }
  
  if (stats.memory.peak > 100) {
    console.log('  ⚠️ Utilizzo memoria elevato (>100MB) - Monitorare memory leaks');
  } else {
    console.log('  ✅ Utilizzo memoria ottimale (<100MB)');
  }
  
  const totalErrors = Object.values(stats.database).reduce((sum, data) => sum + data.errors, 0) +
                     Object.values(stats.apiCalls).reduce((sum, data) => sum + data.errors, 0);
  
  if (totalErrors > 0) {
    console.log(`  ⚠️ ${totalErrors} errori rilevati - Verificare configurazione`);
  } else {
    console.log('  ✅ Nessun errore rilevato');
  }
  
  console.log('\n🎯 RISULTATO FINALE:');
  if (avgQueryTime < 50 && stats.memory.peak < 100 && totalErrors === 0) {
    console.log('  🟢 PERFORMANCE ECCELLENTI');
  } else if (avgQueryTime < 100 && stats.memory.peak < 200 && totalErrors < 5) {
    console.log('  🟡 PERFORMANCE BUONE');
  } else {
    console.log('  🔴 PERFORMANCE DA MIGLIORARE');
  }
}

/**
 * Funzione principale
 */
async function main() {
  console.log('🚀 Avvio test performance sistema ore HR LABA...');
  console.log('=====================================');
  
  // Inizializza monitoraggio memoria
  stats.memory.initial = process.memoryUsage().heapUsed / 1024 / 1024;
  
  try {
    // Warmup
    console.log('🔥 Warmup sistema...');
    for (let i = 0; i < TEST_CONFIG.warmupIterations; i++) {
      await supabase.from('contract_types').select('*').limit(1);
    }
    
    // Esegui test
    await testDatabasePerformance();
    monitorMemory();
    
    await testCalculationPerformance();
    monitorMemory();
    
    await testCRUDPerformance();
    monitorMemory();
    
    await testConcurrentLoad();
    monitorMemory();
    
    await testStressSystem();
    monitorMemory();
    
    // Genera report
    generateReport();
    
    console.log('\n✅ Test performance completato con successo!');
    
  } catch (error) {
    console.error('❌ Errore durante i test:', error);
    process.exit(1);
  }
}

// Esegui test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, calculateStats, measureTime };
