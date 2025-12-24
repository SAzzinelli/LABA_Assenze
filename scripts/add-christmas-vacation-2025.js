/**
 * Script per aggiungere le ferie natalizie 2025 (24/12/2025 - 06/01/2026)
 * per tutti i dipendenti tranne Simone Azzinelli (già aggiunte)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

// Date ferie natalizie
const START_DATE = '2025-12-24';
const END_DATE = '2026-01-06';

// Nome del dipendente da escludere (già ha le ferie)
const EXCLUDE_EMPLOYEE_NAME = 'Simone Azzinelli';

async function addVacationForAllEmployees() {
  try {
    console.log('🚀 Inizio aggiunta ferie natalizie 2025...\n');

    // 1. Recupera tutti i dipendenti (escludendo admin)
    console.log('📋 Recupero lista dipendenti...');
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .neq('role', 'admin')
      .order('last_name');

    if (employeesError) {
      console.error('❌ Errore nel recupero dipendenti:', employeesError);
      return;
    }

    if (!employees || employees.length === 0) {
      console.log('⚠️ Nessun dipendente trovato');
      return;
    }

    console.log(`✅ Trovati ${employees.length} dipendenti\n`);

    // 2. Filtra escludendo Simone Azzinelli
    const employeesToProcess = employees.filter(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`;
      return fullName !== EXCLUDE_EMPLOYEE_NAME;
    });

    console.log(`📝 Dipendenti da processare: ${employeesToProcess.length} (escluso ${EXCLUDE_EMPLOYEE_NAME})\n`);

    // 3. Calcola giorni richiesti
    const start = new Date(START_DATE);
    const end = new Date(END_DATE);
    const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const requestYear = new Date(START_DATE).getFullYear();

    console.log(`📅 Periodo: ${START_DATE} - ${END_DATE} (${daysRequested} giorni)\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 4. Per ogni dipendente, crea le ferie
    for (const employee of employeesToProcess) {
      const fullName = `${employee.first_name} ${employee.last_name}`;
      console.log(`🔄 Processando ${fullName} (${employee.email})...`);

      try {
        // Verifica se esiste già una richiesta di ferie per questo periodo
        const { data: existingRequest, error: checkError } = await supabase
          .from('leave_requests')
          .select('id')
          .eq('user_id', employee.id)
          .eq('type', 'vacation')
          .eq('start_date', START_DATE)
          .eq('end_date', END_DATE)
          .single();

        if (existingRequest) {
          console.log(`   ⚠️  Ferie già esistenti per ${fullName}, salto...\n`);
          continue;
        }

        // Recupera o crea bilancio ferie
        let { data: balance, error: balanceError } = await supabase
          .from('vacation_balances')
          .select('*')
          .eq('user_id', employee.id)
          .eq('year', requestYear)
          .single();

        if (balanceError && balanceError.code === 'PGRST116') {
          // Nessun bilancio trovato, creane uno nuovo con 30 giorni
          const { data: newBalance, error: createError } = await supabase
            .from('vacation_balances')
            .insert([{
              user_id: employee.id,
              year: requestYear,
              total_days: 30,
              used_days: 0,
              pending_days: 0,
              remaining_days: 30
            }])
            .select()
            .single();

          if (createError) {
            console.error(`   ❌ Errore nella creazione del bilancio ferie:`, createError);
            errorCount++;
            errors.push({ employee: fullName, error: `Creazione bilancio: ${createError.message}` });
            continue;
          }

          balance = newBalance;
        } else if (balanceError) {
          console.error(`   ❌ Errore nel recupero del bilancio ferie:`, balanceError);
          errorCount++;
          errors.push({ employee: fullName, error: `Recupero bilancio: ${balanceError.message}` });
          continue;
        }

        // Crea la richiesta di ferie
        const { data: newRequest, error: insertError } = await supabase
          .from('leave_requests')
          .insert([{
            user_id: employee.id,
            type: 'vacation',
            start_date: START_DATE,
            end_date: END_DATE,
            reason: 'Ferie',
            status: 'approved',
            submitted_at: new Date().toISOString(),
            approved_at: new Date().toISOString(),
            approved_by: null, // Script automatico
            days_requested: daysRequested,
            notes: '[Creato automaticamente - Ferie natalizie 2025]'
          }])
          .select()
          .single();

        if (insertError) {
          console.error(`   ❌ Errore nella creazione della richiesta:`, insertError);
          errorCount++;
          errors.push({ employee: fullName, error: `Creazione richiesta: ${insertError.message}` });
          continue;
        }

        // Aggiorna bilancio ferie
        const newUsedDays = (balance.used_days || 0) + daysRequested;
        const { error: updateError } = await supabase
          .from('vacation_balances')
          .update({
            used_days: newUsedDays,
            remaining_days: (balance.total_days || 30) - newUsedDays,
            updated_at: new Date().toISOString()
          })
          .eq('id', balance.id);

        if (updateError) {
          console.error(`   ⚠️  Ferie create ma errore nell'aggiornamento bilancio:`, updateError);
          // Non consideriamo questo un errore fatale, le ferie sono state create
        }

        console.log(`   ✅ Ferie create con successo per ${fullName} (${daysRequested} giorni)\n`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Errore generico per ${fullName}:`, error);
        errorCount++;
        errors.push({ employee: fullName, error: error.message });
      }
    }

    // 5. Riepilogo finale
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(60));
    console.log(`✅ Ferie create con successo: ${successCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    console.log(`📋 Totale dipendenti processati: ${employeesToProcess.length}`);

    if (errors.length > 0) {
      console.log('\n⚠️  ERRORI DETTAGLIATI:');
      errors.forEach(({ employee, error }) => {
        console.log(`   - ${employee}: ${error}`);
      });
    }

    console.log('\n✨ Operazione completata!\n');

  } catch (error) {
    console.error('❌ Errore fatale:', error);
    process.exit(1);
  }
}

// Esegui lo script
addVacationForAllEmployees()
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore nello script:', error);
    process.exit(1);
  });

