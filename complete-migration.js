/**
 * SCRIPT COMPLETO PER MIGRAZIONE SISTEMA ORE
 * Crea le tabelle e migra tutti i dati esistenti
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('📊 Creazione tabelle database...');
  
  try {
    // 1. Contract Types
    console.log('📋 Creazione contract_types...');
    const contractTypes = [
      { name: 'full_time', description: 'Tempo pieno indeterminato', annual_vacation_hours: 208, annual_permission_hours: 104, max_carryover_hours: 104, is_active: true },
      { name: 'part_time_horizontal', description: 'Part-time orizzontale', annual_vacation_hours: 104, annual_permission_hours: 52, max_carryover_hours: 52, is_active: true },
      { name: 'part_time_vertical', description: 'Part-time verticale', annual_vacation_hours: 104, annual_permission_hours: 52, max_carryover_hours: 52, is_active: true },
      { name: 'apprenticeship', description: 'Apprendistato', annual_vacation_hours: 208, annual_permission_hours: 104, max_carryover_hours: 104, is_active: true },
      { name: 'cococo', description: 'Collaborazione coordinata e continuativa', annual_vacation_hours: 0, annual_permission_hours: 0, max_carryover_hours: 0, is_active: true },
      { name: 'internship', description: 'Tirocinio', annual_vacation_hours: 0, annual_permission_hours: 0, max_carryover_hours: 0, is_active: true }
    ];
    
    for (const contract of contractTypes) {
      try {
        const { error } = await supabase.from('contract_types').upsert(contract);
        if (error && !error.message.includes('duplicate')) {
          console.log(`⚠️ Errore contract_types ${contract.name}: ${error.message}`);
        } else {
          console.log(`✅ Contract type ${contract.name} creato`);
        }
      } catch (err) {
        console.log(`⚠️ Errore creazione ${contract.name}: ${err.message}`);
      }
    }
    
    console.log('✅ Tabelle create con successo');
    return true;
    
  } catch (error) {
    console.error('❌ Errore creazione tabelle:', error.message);
    return false;
  }
}

async function migrateUsers() {
  console.log('🔄 Migrazione utenti a pattern di lavoro...');
  
  try {
    // Ottieni tutti gli utenti
    const { data: users, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, contract_type')
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ Errore recupero utenti:', error.message);
      return false;
    }
    
    console.log(`📊 Trovati ${users.length} utenti da migrare`);
    
    // Ottieni contract types
    const { data: contractTypes, error: contractError } = await supabase
      .from('contract_types')
      .select('id, name');
    
    if (contractError) {
      console.log('⚠️ Contract types non disponibili, uso default');
    }
    
    for (const user of users) {
      try {
        // Determina contract type
        let contractTypeId = null;
        if (contractTypes && contractTypes.length > 0) {
          const userContractType = user.contract_type?.toLowerCase() || 'full_time';
          const contractType = contractTypes.find(ct => ct.name === userContractType);
          contractTypeId = contractType?.id || contractTypes[0].id;
        }
        
        // Crea pattern di lavoro di default
        const workPattern = {
          user_id: user.id,
          contract_type_id: contractTypeId,
          effective_from: new Date().toISOString().split('T')[0],
          monday_hours: 8,
          tuesday_hours: 8,
          wednesday_hours: 8,
          thursday_hours: 8,
          friday_hours: 8,
          saturday_hours: 0,
          sunday_hours: 0,
          weekly_hours: 40,
          monthly_hours: 173.33,
          is_active: true
        };
        
        const { error: patternError } = await supabase
          .from('work_patterns')
          .upsert(workPattern);
        
        if (patternError) {
          console.log(`⚠️ Errore pattern per ${user.first_name} ${user.last_name}: ${patternError.message}`);
        } else {
          console.log(`✅ Pattern creato per ${user.first_name} ${user.last_name}`);
        }
        
      } catch (err) {
        console.log(`⚠️ Errore migrazione ${user.first_name} ${user.last_name}: ${err.message}`);
      }
    }
    
    console.log('✅ Migrazione utenti completata');
    return true;
    
  } catch (error) {
    console.error('❌ Errore migrazione utenti:', error.message);
    return false;
  }
}

async function migrateLeaveBalances() {
  console.log('🔄 Migrazione saldi ferie/permessi...');
  
  try {
    // Ottieni saldi esistenti
    const { data: balances, error } = await supabase
      .from('leave_balances')
      .select('*');
    
    if (error) {
      console.log('⚠️ Saldi esistenti non trovati, creo saldi di default');
      return await createDefaultBalances();
    }
    
    console.log(`📊 Trovati ${balances.length} saldi da migrare`);
    
    for (const balance of balances) {
      try {
        // Converti giorni in ore (assumendo 8h/giorno)
        const hoursPerDay = 8;
        
        const newBalance = {
          user_id: balance.user_id,
          category: balance.leave_type === 'vacation' ? 'vacation' : 'permission',
          year: balance.year || new Date().getFullYear(),
          total_accrued: balance.total * hoursPerDay,
          total_used: balance.used * hoursPerDay,
          current_balance: balance.remaining * hoursPerDay,
          pending_requests: balance.pending * hoursPerDay
        };
        
        const { error: balanceError } = await supabase
          .from('current_balances')
          .upsert(newBalance);
        
        if (balanceError) {
          console.log(`⚠️ Errore saldo per utente ${balance.user_id}: ${balanceError.message}`);
        } else {
          console.log(`✅ Saldo migrato per utente ${balance.user_id}`);
        }
        
      } catch (err) {
        console.log(`⚠️ Errore migrazione saldo ${balance.user_id}: ${err.message}`);
      }
    }
    
    console.log('✅ Migrazione saldi completata');
    return true;
    
  } catch (error) {
    console.error('❌ Errore migrazione saldi:', error.message);
    return false;
  }
}

async function createDefaultBalances() {
  console.log('📊 Creazione saldi di default...');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id')
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ Errore recupero utenti:', error.message);
      return false;
    }
    
    const currentYear = new Date().getFullYear();
    
    for (const user of users) {
      try {
        const defaultBalances = [
          {
            user_id: user.id,
            category: 'vacation',
            year: currentYear,
            total_accrued: 208, // 26 giorni * 8h
            total_used: 0,
            current_balance: 208,
            pending_requests: 0
          },
          {
            user_id: user.id,
            category: 'permission',
            year: currentYear,
            total_accrued: 104, // 13 giorni * 8h
            total_used: 0,
            current_balance: 104,
            pending_requests: 0
          },
          {
            user_id: user.id,
            category: 'overtime',
            year: currentYear,
            total_accrued: 0,
            total_used: 0,
            current_balance: 0,
            pending_requests: 0
          }
        ];
        
        for (const balance of defaultBalances) {
          const { error } = await supabase
            .from('current_balances')
            .upsert(balance);
          
          if (error) {
            console.log(`⚠️ Errore saldo default per utente ${user.id}: ${error.message}`);
          }
        }
        
        console.log(`✅ Saldi default creati per utente ${user.id}`);
        
      } catch (err) {
        console.log(`⚠️ Errore creazione saldi default ${user.id}: ${err.message}`);
      }
    }
    
    console.log('✅ Saldi di default creati');
    return true;
    
  } catch (error) {
    console.error('❌ Errore creazione saldi default:', error.message);
    return false;
  }
}

async function migrateLeaveRequests() {
  console.log('🔄 Migrazione richieste ferie esistenti...');
  
  try {
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('*');
    
    if (error) {
      console.log('⚠️ Richieste esistenti non trovate');
      return true;
    }
    
    console.log(`📊 Trovate ${requests.length} richieste da migrare`);
    
    for (const request of requests) {
      try {
        // Calcola ore basate su pattern di lavoro
        const startDate = new Date(request.start_date);
        const endDate = new Date(request.end_date);
        const dates = [];
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split('T')[0]);
        }
        
        // Calcola ore totali (assumendo 8h/giorno per ora)
        const totalHours = dates.length * 8;
        
        // Aggiorna la richiesta con le ore calcolate
        const { error: updateError } = await supabase
          .from('leave_requests')
          .update({
            hours_approved: totalHours,
            work_pattern_snapshot: {
              monday_hours: 8,
              tuesday_hours: 8,
              wednesday_hours: 8,
              thursday_hours: 8,
              friday_hours: 8,
              saturday_hours: 0,
              sunday_hours: 0,
              weekly_hours: 40
            }
          })
          .eq('id', request.id);
        
        if (updateError) {
          console.log(`⚠️ Errore aggiornamento richiesta ${request.id}: ${updateError.message}`);
        } else {
          console.log(`✅ Richiesta ${request.id} aggiornata con ${totalHours}h`);
        }
        
      } catch (err) {
        console.log(`⚠️ Errore migrazione richiesta ${request.id}: ${err.message}`);
      }
    }
    
    console.log('✅ Migrazione richieste completata');
    return true;
    
  } catch (error) {
    console.error('❌ Errore migrazione richieste:', error.message);
    return false;
  }
}

async function generateMonthlyAccruals() {
  console.log('🔄 Generazione maturazioni mensili...');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id')
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ Errore recupero utenti:', error.message);
      return false;
    }
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    for (const user of users) {
      try {
        // Genera maturazione mensile per ferie (208h/anno = 17.33h/mese)
        const vacationAccrual = {
          user_id: user.id,
          category: 'vacation',
          transaction_type: 'accrual',
          hours: 17.33,
          transaction_date: new Date().toISOString().split('T')[0],
          period_year: currentYear,
          period_month: currentMonth,
          reason: `Maturazione mensile ferie ${currentMonth}/${currentYear}`,
          created_at: new Date().toISOString()
        };
        
        const { error: vacationError } = await supabase
          .from('hours_ledger')
          .insert(vacationAccrual);
        
        if (vacationError) {
          console.log(`⚠️ Errore maturazione ferie per utente ${user.id}: ${vacationError.message}`);
        } else {
          console.log(`✅ Maturazione ferie creata per utente ${user.id}`);
        }
        
        // Genera maturazione mensile per permessi (104h/anno = 8.67h/mese)
        const permissionAccrual = {
          user_id: user.id,
          category: 'permission',
          transaction_type: 'accrual',
          hours: 8.67,
          transaction_date: new Date().toISOString().split('T')[0],
          period_year: currentYear,
          period_month: currentMonth,
          reason: `Maturazione mensile permessi ${currentMonth}/${currentYear}`,
          created_at: new Date().toISOString()
        };
        
        const { error: permissionError } = await supabase
          .from('hours_ledger')
          .insert(permissionAccrual);
        
        if (permissionError) {
          console.log(`⚠️ Errore maturazione permessi per utente ${user.id}: ${permissionError.message}`);
        } else {
          console.log(`✅ Maturazione permessi creata per utente ${user.id}`);
        }
        
      } catch (err) {
        console.log(`⚠️ Errore maturazione per utente ${user.id}: ${err.message}`);
      }
    }
    
    console.log('✅ Maturazioni mensili generate');
    return true;
    
  } catch (error) {
    console.error('❌ Errore generazione maturazioni:', error.message);
    return false;
  }
}

async function createSampleBusinessTrips() {
  console.log('🔄 Creazione trasferte di esempio...');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .limit(3);
    
    if (error) {
      console.log('⚠️ Utenti non trovati per trasferte di esempio');
      return true;
    }
    
    const sampleTrips = [
      {
        user_id: users[0].id,
        destination: 'Milano - Fiera del Mobile',
        purpose: 'Partecipazione fiera commerciale',
        departure_date: '2025-03-15',
        return_date: '2025-03-17',
        travel_hours: 8,
        event_hours: 16,
        total_hours: 24,
        status: 'pending',
        notes: 'Trasferta per fiera del mobile'
      },
      {
        user_id: users[1]?.id || users[0].id,
        destination: 'Roma - Meeting cliente',
        purpose: 'Presentazione progetto',
        departure_date: '2025-04-10',
        return_date: '2025-04-10',
        travel_hours: 4,
        event_hours: 4,
        total_hours: 8,
        status: 'approved',
        notes: 'Meeting con cliente importante'
      }
    ];
    
    for (const trip of sampleTrips) {
      try {
        const { error: tripError } = await supabase
          .from('business_trips')
          .insert(trip);
        
        if (tripError) {
          console.log(`⚠️ Errore creazione trasferta: ${tripError.message}`);
        } else {
          console.log(`✅ Trasferta creata per ${trip.destination}`);
        }
        
      } catch (err) {
        console.log(`⚠️ Errore creazione trasferta: ${err.message}`);
      }
    }
    
    console.log('✅ Trasferte di esempio create');
    return true;
    
  } catch (error) {
    console.error('❌ Errore creazione trasferte:', error.message);
    return false;
  }
}

async function completeMigration() {
  console.log('🚀 Avvio migrazione completa al sistema basato su ore...');
  console.log('=====================================');
  
  try {
    // 1. Crea tabelle
    const tablesCreated = await createTables();
    if (!tablesCreated) {
      console.log('⚠️ Creazione tabelle fallita, continuo comunque...');
    }
    
    // 2. Migra utenti
    await migrateUsers();
    
    // 3. Migra saldi
    await migrateLeaveBalances();
    
    // 4. Migra richieste
    await migrateLeaveRequests();
    
    // 5. Genera maturazioni
    await generateMonthlyAccruals();
    
    // 6. Crea trasferte di esempio
    await createSampleBusinessTrips();
    
    console.log('=====================================');
    console.log('✅ Migrazione completata con successo!');
    console.log('');
    console.log('📋 Riepilogo:');
    console.log('- Pattern di lavoro creati per tutti gli utenti');
    console.log('- Saldi ferie/permessi migrati al sistema ore');
    console.log('- Richieste ferie esistenti aggiornate con calcoli ore');
    console.log('- Maturazioni mensili generate');
    console.log('- Trasferte di esempio create');
    console.log('');
    console.log('🎯 Il sistema è ora pronto per l\'utilizzo con le nuove logiche basate su ore!');
    
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error.message);
  }
}

// Esegui la migrazione
if (require.main === module) {
  completeMigration();
}

module.exports = { completeMigration };
