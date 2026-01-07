/**
 * Script per verificare le ferie natalizie 2025 (24/12/2025 - 06/01/2026)
 * per tutti i dipendenti
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

async function checkVacations() {
  try {
    console.log('🔍 Verifica ferie natalizie 2025...\n');
    console.log(`📅 Periodo: ${START_DATE} - ${END_DATE}\n`);

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

    // 2. Per ogni dipendente, verifica se ha le ferie
    const results = [];
    let withVacation = 0;
    let withoutVacation = 0;

    for (const employee of employees) {
      const fullName = `${employee.first_name} ${employee.last_name}`;
      
      // Cerca ferie approvate per questo periodo
      const { data: vacations, error: vacError } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, status, days_requested, notes')
        .eq('user_id', employee.id)
        .eq('type', 'vacation')
        .eq('status', 'approved')
        .lte('start_date', END_DATE)
        .gte('end_date', START_DATE);

      if (vacError) {
        console.error(`❌ Errore per ${fullName}:`, vacError);
        results.push({
          name: fullName,
          email: employee.email,
          hasVacation: false,
          error: vacError.message
        });
        withoutVacation++;
        continue;
      }

      // Verifica se c'è una ferie che copre esattamente o include il periodo
      const matchingVacation = vacations?.find(vac => {
        const vacStart = new Date(vac.start_date);
        const vacEnd = new Date(vac.end_date);
        const checkStart = new Date(START_DATE);
        const checkEnd = new Date(END_DATE);
        
        // La ferie copre il periodo se inizia prima o il 24/12 e finisce dopo o il 06/01
        return vacStart <= checkStart && vacEnd >= checkEnd;
      });

      if (matchingVacation) {
        console.log(`✅ ${fullName}: Ha ferie dal ${matchingVacation.start_date} al ${matchingVacation.end_date} (${matchingVacation.days_requested} giorni)`);
        results.push({
          name: fullName,
          email: employee.email,
          hasVacation: true,
          vacation: matchingVacation
        });
        withVacation++;
      } else {
        console.log(`❌ ${fullName}: NON ha ferie per il periodo natalizio`);
        if (vacations && vacations.length > 0) {
          console.log(`   ⚠️  Ha altre ferie:`, vacations.map(v => `${v.start_date} - ${v.end_date}`).join(', '));
        }
        results.push({
          name: fullName,
          email: employee.email,
          hasVacation: false,
          otherVacations: vacations || []
        });
        withoutVacation++;
      }
    }

    // 3. Riepilogo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(60));
    console.log(`✅ Dipendenti con ferie natalizie: ${withVacation}`);
    console.log(`❌ Dipendenti SENZA ferie natalizie: ${withoutVacation}`);
    console.log(`📋 Totale dipendenti: ${employees.length}`);

    if (withoutVacation > 0) {
      console.log('\n⚠️  DIPENDENTI SENZA FERIE NATALIZIE:');
      results
        .filter(r => !r.hasVacation)
        .forEach(r => {
          console.log(`   - ${r.name} (${r.email})`);
          if (r.otherVacations && r.otherVacations.length > 0) {
            console.log(`     Ha altre ferie: ${r.otherVacations.map(v => `${v.start_date} - ${v.end_date}`).join(', ')}`);
          }
        });
    }

    // 4. Verifica specifica per il 24 dicembre
    console.log('\n' + '='.repeat(60));
    console.log('🔍 VERIFICA SPECIFICA: 24 DICEMBRE 2025');
    console.log('='.repeat(60));
    
    const checkDate = '2025-12-24';
    const { data: vacationsOn24, error: dateError } = await supabase
      .from('leave_requests')
      .select(`
        id,
        user_id,
        start_date,
        end_date,
        status,
        users!leave_requests_user_id_fkey(first_name, last_name, email)
      `)
      .eq('type', 'vacation')
      .eq('status', 'approved')
      .lte('start_date', checkDate)
      .gte('end_date', checkDate);

    if (dateError) {
      console.error('❌ Errore nel recupero ferie per il 24/12:', dateError);
    } else {
      console.log(`✅ Dipendenti in ferie il 24/12/2025: ${vacationsOn24?.length || 0}`);
      if (vacationsOn24 && vacationsOn24.length > 0) {
        vacationsOn24.forEach(vac => {
          const user = vac.users;
          console.log(`   - ${user.first_name} ${user.last_name} (${user.email})`);
        });
      }
    }

    console.log('\n✨ Verifica completata!\n');

  } catch (error) {
    console.error('❌ Errore fatale:', error);
    process.exit(1);
  }
}

// Esegui lo script
checkVacations()
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore nello script:', error);
    process.exit(1);
  });

