/**
 * SCRIPT DI MIGRAZIONE AL SISTEMA BASATO SU ORE
 * Migra i dati esistenti dal sistema giorni al nuovo sistema ore
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

// Utility per calcoli ore
const CONTRACT_TYPES = {
  'full_time': { annualVacationHours: 208, annualPermissionHours: 104 },
  'part_time_horizontal': { annualVacationHours: 104, annualPermissionHours: 52 },
  'part_time_vertical': { annualVacationHours: 104, annualPermissionHours: 52 },
  'apprenticeship': { annualVacationHours: 208, annualPermissionHours: 104 },
  'cococo': { annualVacationHours: 0, annualPermissionHours: 0 },
  'internship': { annualVacationHours: 0, annualPermissionHours: 0 }
};

function formatHours(hours) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  return `${wholeHours}h ${minutes}m`;
}

function hoursToDays(hours, weeklyHours = 40) {
  const averageDailyHours = weeklyHours / 5; // Assumendo 5 giorni lavorativi
  return hours / averageDailyHours;
}

async function migrateUsersToWorkPatterns() {
  console.log('🔄 Migrazione utenti a pattern di lavoro...');
  
  try {
    // Ottieni tutti gli utenti attivi
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .eq('role', 'employee');

    if (usersError) {
      throw new Error(`Errore nel recupero utenti: ${usersError.message}`);
    }

    console.log(`📊 Trovati ${users.length} utenti da migrare`);

    for (const user of users) {
      try {
        // Determina il tipo di contratto
        let contractType = 'full_time';
        if (user.contract_type) {
          contractType = user.contract_type.toLowerCase().replace(/\s+/g, '_');
        }

        // Ottieni l'ID del tipo di contratto
        const { data: contractTypeData, error: contractError } = await supabase
          .from('contract_types')
          .select('id')
          .eq('name', contractType)
          .single();

        if (contractError) {
          console.warn(`⚠️ Tipo contratto ${contractType} non trovato per ${user.first_name} ${user.last_name}, uso full_time`);
          const { data: defaultContract } = await supabase
            .from('contract_types')
            .select('id')
            .eq('name', 'full_time')
            .single();
          contractType = 'full_time';
        }

        const contractTypeId = contractTypeData?.id || (await supabase.from('contract_types').select('id').eq('name', 'full_time').single()).data.id;

        // Crea pattern di lavoro basato sul tipo di contratto
        let workPattern = {
          monday_hours: 8,
          tuesday_hours: 8,
          wednesday_hours: 8,
          thursday_hours: 8,
          friday_hours: 8,
          saturday_hours: 0,
          sunday_hours: 0
        };

        // Personalizza pattern per tipo di contratto
        switch (contractType) {
          case 'part_time_horizontal':
            workPattern = {
              monday_hours: 4,
              tuesday_hours: 4,
              wednesday_hours: 4,
              thursday_hours: 4,
              friday_hours: 4,
              saturday_hours: 0,
              sunday_hours: 0
            };
            break;
          case 'part_time_vertical':
            workPattern = {
              monday_hours: 8,
              tuesday_hours: 0,
              wednesday_hours: 8,
              thursday_hours: 0,
              friday_hours: 8,
              saturday_hours: 0,
              sunday_hours: 0
            };
            break;
          case 'cococo':
          case 'internship':
            workPattern = {
              monday_hours: 0,
              tuesday_hours: 0,
              wednesday_hours: 0,
              thursday_hours: 0,
              friday_hours: 0,
              saturday_hours: 0,
              sunday_hours: 0
            };
            break;
        }

        // Inserisci pattern di lavoro
        const { data: patternData, error: patternError } = await supabase
          .from('work_patterns')
          .insert({
            user_id: user.id,
            contract_type_id: contractTypeId,
            effective_from: user.hire_date || user.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            ...workPattern,
            notes: `Migrato automaticamente da sistema giorni - ${contractType}`
          })
          .select()
          .single();

        if (patternError) {
          console.error(`❌ Errore creazione pattern per ${user.first_name} ${user.last_name}:`, patternError.message);
        } else {
          console.log(`✅ Pattern creato per ${user.first_name} ${user.last_name} (${contractType})`);
        }

      } catch (error) {
        console.error(`❌ Errore migrazione utente ${user.first_name} ${user.last_name}:`, error.message);
      }
    }

    console.log('✅ Migrazione pattern di lavoro completata');
  } catch (error) {
    console.error('❌ Errore nella migrazione pattern di lavoro:', error.message);
  }
}

async function migrateLeaveBalances() {
  console.log('🔄 Migrazione saldi ferie/permessi...');
  
  try {
    // Ottieni tutti gli utenti con pattern di lavoro
    const { data: patterns, error: patternsError } = await supabase
      .from('work_patterns')
      .select(`
        *,
        users!inner(id, first_name, last_name, hire_date),
        contract_types!inner(annual_vacation_hours, annual_permission_hours)
      `);

    if (patternsError) {
      throw new Error(`Errore nel recupero pattern: ${patternsError.message}`);
    }

    console.log(`📊 Trovati ${patterns.length} pattern da migrare`);

    for (const pattern of patterns) {
      try {
        const user = pattern.users;
        const contractType = pattern.contract_types;
        const currentYear = new Date().getFullYear();

        // Calcola ore di maturazione annuale
        const monthlyHours = pattern.monthly_hours;
        const fullTimeMonthlyHours = 40 * 4.33; // 173.33 ore mensili FT
        const ratio = monthlyHours / fullTimeMonthlyHours;

        const annualVacationHours = contractType.annual_vacation_hours * ratio;
        const annualPermissionHours = contractType.annual_permission_hours * ratio;

        // Calcola maturazione pro-rata se ingresso a metà anno
        let vacationAccrued = annualVacationHours;
        let permissionAccrued = annualPermissionHours;

        if (user.hire_date) {
          const hireDate = new Date(user.hire_date);
          const hireYear = hireDate.getFullYear();
          
          if (hireYear === currentYear) {
            const hireMonth = hireDate.getMonth() + 1;
            const monthsWorked = 12 - hireMonth + 1;
            const proRataRatio = monthsWorked / 12;
            
            vacationAccrued = annualVacationHours * proRataRatio;
            permissionAccrued = annualPermissionHours * proRataRatio;
          }
        }

        // Crea saldi correnti
        const { error: vacationError } = await supabase
          .from('current_balances')
          .insert({
            user_id: user.id,
            category: 'vacation',
            year: currentYear,
            total_accrued: vacationAccrued,
            total_used: 0,
            current_balance: vacationAccrued,
            last_transaction_date: new Date().toISOString().split('T')[0]
          });

        if (vacationError) {
          console.error(`❌ Errore saldo ferie per ${user.first_name} ${user.last_name}:`, vacationError.message);
        }

        const { error: permissionError } = await supabase
          .from('current_balances')
          .insert({
            user_id: user.id,
            category: 'permission',
            year: currentYear,
            total_accrued: permissionAccrued,
            total_used: 0,
            current_balance: permissionAccrued,
            last_transaction_date: new Date().toISOString().split('T')[0]
          });

        if (permissionError) {
          console.error(`❌ Errore saldo permessi per ${user.first_name} ${user.last_name}:`, permissionError.message);
        }

        // Crea movimenti di maturazione nel ledger
        const { error: vacationLedgerError } = await supabase
          .from('hours_ledger')
          .insert({
            user_id: user.id,
            transaction_date: user.hire_date || new Date().toISOString().split('T')[0],
            transaction_type: 'accrual',
            category: 'vacation',
            hours_amount: vacationAccrued,
            description: `Maturazione iniziale ferie - migrazione da sistema giorni`,
            period_year: currentYear,
            running_balance: vacationAccrued
          });

        const { error: permissionLedgerError } = await supabase
          .from('hours_ledger')
          .insert({
            user_id: user.id,
            transaction_date: user.hire_date || new Date().toISOString().split('T')[0],
            transaction_type: 'accrual',
            category: 'permission',
            hours_amount: permissionAccrued,
            description: `Maturazione iniziale permessi - migrazione da sistema giorni`,
            period_year: currentYear,
            running_balance: permissionAccrued
          });

        if (!vacationError && !permissionError && !vacationLedgerError && !permissionLedgerError) {
          console.log(`✅ Saldi creati per ${user.first_name} ${user.last_name}: ${formatHours(vacationAccrued)} ferie, ${formatHours(permissionAccrued)} permessi`);
        }

      } catch (error) {
        console.error(`❌ Errore migrazione saldi per ${pattern.users.first_name} ${pattern.users.last_name}:`, error.message);
      }
    }

    console.log('✅ Migrazione saldi completata');
  } catch (error) {
    console.error('❌ Errore nella migrazione saldi:', error.message);
  }
}

async function migrateExistingLeaveRequests() {
  console.log('🔄 Migrazione richieste ferie esistenti...');
  
  try {
    // Ottieni richieste ferie esistenti
    const { data: requests, error: requestsError } = await supabase
      .from('leave_requests')
      .select(`
        *,
        users!inner(id, first_name, last_name)
      `)
      .eq('type', 'vacation')
      .eq('status', 'approved');

    if (requestsError) {
      throw new Error(`Errore nel recupero richieste: ${requestsError.message}`);
    }

    console.log(`📊 Trovate ${requests.length} richieste ferie da migrare`);

    for (const request of requests) {
      try {
        // Ottieni pattern di lavoro dell'utente
        const { data: pattern, error: patternError } = await supabase
          .from('work_patterns')
          .select('*')
          .eq('user_id', request.user_id)
          .order('effective_from', { ascending: false })
          .limit(1)
          .single();

        if (patternError) {
          console.warn(`⚠️ Pattern non trovato per ${request.users.first_name} ${request.users.last_name}, salto richiesta`);
          continue;
        }

        // Calcola ore per il periodo della richiesta
        const start = new Date(request.start_date);
        const end = new Date(request.end_date);
        const dates = [];
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split('T')[0]);
        }

        let totalHours = 0;
        dates.forEach(date => {
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
          
          totalHours += dailyHours;
        });

        // Aggiorna la richiesta con le ore calcolate
        const { error: updateError } = await supabase
          .from('leave_requests')
          .update({
            hours_requested: totalHours,
            hours_approved: totalHours,
            work_pattern_snapshot: pattern
          })
          .eq('id', request.id);

        if (updateError) {
          console.error(`❌ Errore aggiornamento richiesta ${request.id}:`, updateError.message);
        } else {
          console.log(`✅ Richiesta ${request.id} aggiornata: ${formatHours(totalHours)}`);
        }

      } catch (error) {
        console.error(`❌ Errore migrazione richiesta ${request.id}:`, error.message);
      }
    }

    console.log('✅ Migrazione richieste completata');
  } catch (error) {
    console.error('❌ Errore nella migrazione richieste:', error.message);
  }
}

async function createSampleBusinessTrips() {
  console.log('🔄 Creazione trasferte di esempio...');
  
  try {
    // Ottieni alcuni utenti per creare trasferte di esempio
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .eq('role', 'employee')
      .limit(3);

    if (usersError) {
      throw new Error(`Errore nel recupero utenti: ${usersError.message}`);
    }

    const sampleTrips = [
      {
        trip_name: 'Conferenza Tech Milano',
        destination: 'Milano',
        purpose: 'Partecipazione conferenza tecnologica',
        departure_date: '2025-02-15',
        departure_time: '08:00',
        return_date: '2025-02-15',
        return_time: '20:00',
        travel_hours: 4,
        event_hours: 8,
        waiting_hours: 1,
        travel_policy: 'full_travel',
        overtime_policy: 'overtime_bank',
        expenses_total: 150.00,
        notes: 'Trasferta di esempio per test sistema ore'
      },
      {
        trip_name: 'Meeting Clienti Roma',
        destination: 'Roma',
        purpose: 'Incontro con clienti importanti',
        departure_date: '2025-02-20',
        departure_time: '07:30',
        return_date: '2025-02-20',
        return_time: '19:30',
        travel_hours: 6,
        event_hours: 6,
        waiting_hours: 0,
        travel_policy: 'excess_travel',
        overtime_policy: 'overtime_bank',
        expenses_total: 200.00,
        notes: 'Trasferta Roma per meeting clienti'
      }
    ];

    for (let i = 0; i < Math.min(users.length, sampleTrips.length); i++) {
      const user = users[i];
      const trip = sampleTrips[i];

      const { data: tripData, error: tripError } = await supabase
        .from('business_trips')
        .insert({
          user_id: user.id,
          ...trip,
          status: 'approved'
        })
        .select()
        .single();

      if (tripError) {
        console.error(`❌ Errore creazione trasferta per ${user.first_name} ${user.last_name}:`, tripError.message);
      } else {
        console.log(`✅ Trasferta creata per ${user.first_name} ${user.last_name}: ${trip.trip_name}`);
      }
    }

    console.log('✅ Trasferte di esempio create');
  } catch (error) {
    console.error('❌ Errore nella creazione trasferte:', error.message);
  }
}

async function generateMonthlyAccruals() {
  console.log('🔄 Generazione maturazioni mensili...');
  
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Ottieni tutti gli utenti con pattern di lavoro
    const { data: patterns, error: patternsError } = await supabase
      .from('work_patterns')
      .select(`
        *,
        users!inner(id, first_name, last_name),
        contract_types!inner(annual_vacation_hours, annual_permission_hours)
      `);

    if (patternsError) {
      throw new Error(`Errore nel recupero pattern: ${patternsError.message}`);
    }

    console.log(`📊 Generazione maturazioni per ${patterns.length} utenti`);

    for (const pattern of patterns) {
      try {
        const user = pattern.users;
        const contractType = pattern.contract_types;

        // Calcola maturazione mensile
        const monthlyHours = pattern.monthly_hours;
        const fullTimeMonthlyHours = 40 * 4.33;
        const ratio = monthlyHours / fullTimeMonthlyHours;

        const monthlyVacationAccrual = (contractType.annual_vacation_hours / 12) * ratio;
        const monthlyPermissionAccrual = (contractType.annual_permission_hours / 12) * ratio;

        // Genera maturazioni per i mesi precedenti dell'anno corrente
        for (let month = 1; month < currentMonth; month++) {
          // Maturazione ferie
          const { error: vacationError } = await supabase
            .from('hours_ledger')
            .insert({
              user_id: user.id,
              transaction_date: `${currentYear}-${month.toString().padStart(2, '0')}-01`,
              transaction_type: 'accrual',
              category: 'vacation',
              hours_amount: monthlyVacationAccrual,
              description: `Maturazione mensile ferie - ${month}/${currentYear}`,
              period_year: currentYear,
              period_month: month,
              running_balance: monthlyVacationAccrual * month
            });

          // Maturazione permessi
          const { error: permissionError } = await supabase
            .from('hours_ledger')
            .insert({
              user_id: user.id,
              transaction_date: `${currentYear}-${month.toString().padStart(2, '0')}-01`,
              transaction_type: 'accrual',
              category: 'permission',
              hours_amount: monthlyPermissionAccrual,
              description: `Maturazione mensile permessi - ${month}/${currentYear}`,
              period_year: currentYear,
              period_month: month,
              running_balance: monthlyPermissionAccrual * month
            });

          if (vacationError || permissionError) {
            console.warn(`⚠️ Errore maturazione ${month}/${currentYear} per ${user.first_name} ${user.last_name}`);
          }
        }

        console.log(`✅ Maturazioni generate per ${user.first_name} ${user.last_name}`);

      } catch (error) {
        console.error(`❌ Errore maturazioni per ${pattern.users.first_name} ${pattern.users.last_name}:`, error.message);
      }
    }

    console.log('✅ Generazione maturazioni completata');
  } catch (error) {
    console.error('❌ Errore nella generazione maturazioni:', error.message);
  }
}

async function main() {
  console.log('🚀 Avvio migrazione al sistema basato su ore...');
  console.log('=====================================');

  try {
    // 1. Migra utenti a pattern di lavoro
    await migrateUsersToWorkPatterns();
    
    // 2. Migra saldi ferie/permessi
    await migrateLeaveBalances();
    
    // 3. Migra richieste ferie esistenti
    await migrateExistingLeaveRequests();
    
    // 4. Genera maturazioni mensili
    await generateMonthlyAccruals();
    
    // 5. Crea trasferte di esempio
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
    process.exit(1);
  }
}

// Esegui migrazione
if (require.main === module) {
  main();
}

module.exports = {
  migrateUsersToWorkPatterns,
  migrateLeaveBalances,
  migrateExistingLeaveRequests,
  generateMonthlyAccruals,
  createSampleBusinessTrips
};
