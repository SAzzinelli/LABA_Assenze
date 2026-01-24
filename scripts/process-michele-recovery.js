/**
 * Script rapido per processare il recupero di Michele di oggi (24/01/2026)
 * 
 * Eseguire: node scripts/process-michele-recovery.js
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

async function processMicheleRecovery() {
  try {
    console.log('🔍 Cerca recupero di Michele per oggi (24/01/2026)...\n');

    // Trova Michele
    const { data: michele, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .or('first_name.ilike.michele,last_name.ilike.michele')
      .limit(5);

    if (userError || !michele || michele.length === 0) {
      console.error('❌ Michele non trovato');
      return;
    }

    console.log(`👤 Trovati ${michele.length} utenti con nome Michele:`);
    michele.forEach(u => console.log(`   - ${u.first_name} ${u.last_name} (ID: ${u.id})`));
    console.log('');

    // Cerca recuperi di Michele per oggi
    const today = '2026-01-24';
    const { data: recoveries, error: recoveryError } = await supabase
      .from('recovery_requests')
      .select('*, users(id, first_name, last_name)')
      .eq('recovery_date', today)
      .in('user_id', michele.map(u => u.id))
      .order('created_at', { ascending: false });

    if (recoveryError) {
      console.error('❌ Errore nel recupero dei recuperi:', recoveryError);
      return;
    }

    if (!recoveries || recoveries.length === 0) {
      console.log('❌ Nessun recupero trovato per Michele oggi');
      return;
    }

    console.log(`📋 Trovati ${recoveries.length} recuperi per oggi:\n`);
    recoveries.forEach(r => {
      const user = r.users ? `${r.users.first_name} ${r.users.last_name}` : `User ${r.user_id}`;
      console.log(`   ID: ${r.id}`);
      console.log(`   User: ${user}`);
      console.log(`   Data: ${r.recovery_date}, Ore: ${r.hours}h`);
      console.log(`   Status: ${r.status}, balance_added: ${r.balance_added}`);
      console.log(`   Orario: ${r.start_time} - ${r.end_time}`);
      console.log('');
    });

    // Processa il primo recupero non processato
    const unprocessed = recoveries.find(r => !r.balance_added);
    
    if (!unprocessed) {
      console.log('✅ Tutti i recuperi sono già stati processati!');
      return;
    }

    console.log(`🔄 Processamento recupero ID ${unprocessed.id}...\n`);

    // Usa la stessa logica di processSingleRecovery
    const recovery = unprocessed;
    
    // Verifica se già processato
    const { data: existingLedger } = await supabase
      .from('hours_ledger')
      .select('id')
      .eq('reference_id', recovery.id)
      .eq('reference_type', 'recovery_request')
      .single();

    if (existingLedger) {
      console.log('⚠️  Recovery già processato (esiste già ledger entry), aggiorno solo balance_added...');
      await supabase
        .from('recovery_requests')
        .update({
          balance_added: true,
          status: 'completed',
          completed_at: recovery.completed_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', recovery.id);
      console.log('✅ Recovery aggiornato!\n');
      return;
    }

    // Processa il recupero
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', recovery.user_id)
      .eq('date', recovery.recovery_date)
      .single();

    if (existingAttendance) {
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
      await supabase
        .from('attendance')
        .insert({
          user_id: recovery.user_id,
          date: recovery.recovery_date,
          actual_hours: parseFloat(recovery.hours),
          expected_hours: 0,
          balance_hours: parseFloat(recovery.hours),
          notes: `Recupero ore: +${recovery.hours}h (dalle ${recovery.start_time} alle ${recovery.end_time})`
        });
    }

    const recoveryYear = new Date(recovery.recovery_date).getFullYear();
    const recoveryHours = parseFloat(recovery.hours);
    
    const { data: currentBalance } = await supabase
      .from('current_balances')
      .select('current_balance, total_accrued')
      .eq('user_id', recovery.user_id)
      .eq('category', 'overtime_bank')
      .eq('year', recoveryYear)
      .single();

    const currentOvertimeBalance = currentBalance?.current_balance || 0;
    const newOvertimeBalance = currentOvertimeBalance + recoveryHours;
    const totalAccrued = (currentBalance?.total_accrued || 0) + recoveryHours;

    await supabase
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

    await supabase
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

    await supabase
      .from('recovery_requests')
      .update({
        completed_at: recovery.completed_at || new Date().toISOString(),
        balance_added: true,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', recovery.id);

    console.log(`💰 Banca ore aggiornata: ${currentOvertimeBalance}h → ${newOvertimeBalance}h (+${recoveryHours}h)`);
    console.log(`✅ Recovery ${recovery.id} processato con successo!\n`);

  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

processMicheleRecovery()
  .then(() => {
    console.log('✅ Script completato!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore fatale:', error);
    process.exit(1);
  });
