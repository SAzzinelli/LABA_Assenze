/**
 * Script per processare recuperi completati che non hanno ancora balance_added = true
 * 
 * Questo script trova tutti i recuperi che:
 * - Hanno status = 'completed' e balance_added = false
 * - O hanno status = 'approved' e recovery_date <= oggi e balance_added = false
 * 
 * E li processa aggiungendo le ore alla banca ore.
 * 
 * Eseguire: node scripts/process-missing-recoveries.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRORE: Le variabili SUPABASE_URL e SUPABASE_SERVICE_KEY devono essere impostate!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function processMissingRecoveries() {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    console.log('🔍 Cerca recuperi completati mancanti...');
    console.log(`📅 Today: ${today}, Current time: ${currentTime}\n`);

    // Trova tutti i recuperi che dovrebbero essere processati ma non lo sono ancora
    // 1. Recuperi con status = 'completed' e balance_added = false
    // 2. Recuperi con status = 'approved' e recovery_date <= oggi e balance_added = false
    const { data: missingRecoveries, error } = await supabase
      .from('recovery_requests')
      .select('*, users(id, first_name, last_name)')
      .eq('balance_added', false)
      .or('status.eq.completed,and(status.eq.approved,recovery_date.lte.' + today + ')');

    if (error) {
      console.error('❌ Errore nel recupero dei recuperi mancanti:', error);
      return;
    }

    if (!missingRecoveries || missingRecoveries.length === 0) {
      console.log('✅ Nessun recupero mancante da processare!');
      return;
    }

    console.log(`📋 Trovati ${missingRecoveries.length} recuperi da processare:\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const recovery of missingRecoveries) {
      const recoveryDateStr = recovery.recovery_date;
      const recoveryTime = recovery.end_time;
      const userName = recovery.users ? `${recovery.users.first_name} ${recovery.users.last_name}` : `User ${recovery.user_id}`;

      console.log(`🔍 Processing recovery ${recovery.id}:`);
      console.log(`   User: ${userName}`);
      console.log(`   Date: ${recoveryDateStr}, Time: ${recovery.start_time} - ${recovery.end_time}`);
      console.log(`   Hours: ${recovery.hours}h`);
      console.log(`   Status: ${recovery.status}, balance_added: ${recovery.balance_added}`);

      // Verifica se la data è passata o se è oggi e l'orario di fine è passato
      const isDatePast = recoveryDateStr < today;
      const isTimePast = recoveryDateStr === today && recoveryTime <= currentTime;

      // Se status è 'completed', processa sempre (indipendentemente dalla data)
      // Se status è 'approved', processa solo se la data/orario sono passati
      if (recovery.status === 'completed' || (recovery.status === 'approved' && (isDatePast || isTimePast))) {
        // Verifica se questo recupero è già stato processato (controlla il ledger)
        const { data: existingLedger } = await supabase
          .from('hours_ledger')
          .select('id')
          .eq('reference_id', recovery.id)
          .eq('reference_type', 'recovery_request')
          .single();

        if (existingLedger) {
          console.log(`   ⚠️  Recovery già processato (esiste già ledger entry), aggiorno solo balance_added...`);
          
          // Aggiorna solo balance_added e status se necessario
          await supabase
            .from('recovery_requests')
            .update({
              balance_added: true,
              status: 'completed',
              completed_at: recovery.completed_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', recovery.id);
          
          skippedCount++;
          console.log(`   ✅ Recovery ${recovery.id} aggiornato (già processato)\n`);
          continue;
        }

        try {
          // Aggiungi le ore al saldo
          // Crea o aggiorna un record di presenza per quella data con le ore di recupero
          const { data: existingAttendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', recovery.user_id)
            .eq('date', recovery.recovery_date)
            .single();

          if (existingAttendance) {
            // Aggiorna il record esistente aggiungendo le ore di recupero
            const newBalanceHours = parseFloat(existingAttendance.balance_hours || 0) + parseFloat(recovery.hours);
            const newActualHours = parseFloat(existingAttendance.actual_hours || 0) + parseFloat(recovery.hours);

            await supabase
              .from('attendance')
              .update({
                actual_hours: newActualHours,
                balance_hours: newBalanceHours,
                notes: (existingAttendance.notes || '') + `\n[Recupero ore: +${recovery.hours}h]`
              })
              .eq('id', existingAttendance.id);
          } else {
            // Crea nuovo record
            await supabase
              .from('attendance')
              .insert({
                user_id: recovery.user_id,
                date: recovery.recovery_date,
                actual_hours: parseFloat(recovery.hours),
                expected_hours: 0, // Recupero ore, non sono ore previste
                balance_hours: parseFloat(recovery.hours),
                notes: `Recupero ore: +${recovery.hours}h (dalle ${recovery.start_time} alle ${recovery.end_time})`
              });
          }

          // AGGIUNGI LE ORE ALLA BANCA ORE (overtime_bank)
          const recoveryYear = new Date(recovery.recovery_date).getFullYear();
          const recoveryHours = parseFloat(recovery.hours);
          
          // Recupera il saldo corrente della banca ore
          const { data: currentBalance, error: balanceError } = await supabase
            .from('current_balances')
            .select('current_balance, total_accrued')
            .eq('user_id', recovery.user_id)
            .eq('category', 'overtime_bank')
            .eq('year', recoveryYear)
            .single();

          const currentOvertimeBalance = currentBalance?.current_balance || 0;
          const newOvertimeBalance = currentOvertimeBalance + recoveryHours;
          const totalAccrued = (currentBalance?.total_accrued || 0) + recoveryHours;

          // Inserisci movimento nel ledger
          const { error: ledgerError } = await supabase
            .from('hours_ledger')
            .insert({
              user_id: recovery.user_id,
              transaction_date: recovery.recovery_date,
              transaction_type: 'accrual',
              category: 'overtime_bank',
              hours_amount: recoveryHours,
              description: `Recupero ore: +${recoveryHours}h (dalle ${recovery.start_time} alle ${recovery.end_time})`,
              reference_id: recovery.id,
              reference_type: 'recovery_request',
              running_balance: newOvertimeBalance
            });

          if (ledgerError) {
            console.error(`   ❌ Errore inserimento ledger:`, ledgerError);
            throw ledgerError;
          }

          // Aggiorna o crea il saldo corrente della banca ore
          const { error: balanceUpdateError } = await supabase
            .from('current_balances')
            .upsert({
              user_id: recovery.user_id,
              category: 'overtime_bank',
              year: recoveryYear,
              total_accrued: totalAccrued,
              current_balance: newOvertimeBalance,
              last_transaction_date: recovery.recovery_date,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,category,year'
            });

          if (balanceUpdateError) {
            console.error(`   ❌ Errore aggiornamento banca ore:`, balanceUpdateError);
            throw balanceUpdateError;
          }

          // Marca il recupero come completato
          await supabase
            .from('recovery_requests')
            .update({
              completed_at: recovery.completed_at || new Date().toISOString(),
              balance_added: true,
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', recovery.id);

          console.log(`   💰 Banca ore aggiornata: ${currentOvertimeBalance}h → ${newOvertimeBalance}h (+${recoveryHours}h)`);
          console.log(`   ✅ Recovery ${recovery.id} processato con successo!\n`);
          processedCount++;

        } catch (error) {
          console.error(`   ❌ Errore durante il processamento del recovery ${recovery.id}:`, error.message);
          errorCount++;
          console.log('');
        }
      } else {
        console.log(`   ⏭️  Recovery non ancora completato (data futura o orario non ancora passato)\n`);
        skippedCount++;
      }
    }

    console.log('\n📊 Riepilogo:');
    console.log(`   ✅ Processati: ${processedCount}`);
    console.log(`   ⏭️  Saltati: ${skippedCount}`);
    console.log(`   ❌ Errori: ${errorCount}`);
    console.log(`   📋 Totale: ${missingRecoveries.length}\n`);

  } catch (error) {
    console.error('❌ Errore generale durante il processamento:', error);
    process.exit(1);
  }
}

// Esegui lo script
processMissingRecoveries()
  .then(() => {
    console.log('✅ Script completato!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore fatale:', error);
    process.exit(1);
  });
