/**
 * Script per processare immediatamente il recupero di Michele del 24/01/2026
 * ID recupero: fd9c436e-c6a6-4b47-b49c-40e17efd0f55
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRORE: Le variabili SUPABASE_URL e SUPABASE_SERVICE_KEY devono essere impostate!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const RECOVERY_ID = 'fd9c436e-c6a6-4b47-b49c-40e17efd0f55';

async function processMicheleRecovery() {
  try {
    console.log(`🔄 Processando recupero ${RECOVERY_ID}...`);

    // 1. Recupera il recupero
    const { data: recovery, error: recoveryError } = await supabase
      .from('recovery_requests')
      .select('*, users(id, first_name, last_name)')
      .eq('id', RECOVERY_ID)
      .single();

    if (recoveryError || !recovery) {
      console.error('❌ Recupero non trovato:', recoveryError);
      return;
    }

    const userName = recovery.users ? `${recovery.users.first_name} ${recovery.users.last_name}` : recovery.user_id;
    console.log(`   User: ${userName}`);
    console.log(`   Date: ${recovery.recovery_date}`);
    console.log(`   Hours: ${recovery.hours}h`);
    console.log(`   Status: ${recovery.status}`);
    console.log(`   balance_added: ${recovery.balance_added}`);

    // 2. Verifica se esiste già un ledger entry
    const { data: existingLedger } = await supabase
      .from('hours_ledger')
      .select('id')
      .eq('reference_id', recovery.id)
      .eq('reference_type', 'recovery_request')
      .single();

    if (existingLedger) {
      console.log(`   ⚠️  Esiste già un ledger entry per questo recupero`);
      console.log(`   Aggiornando solo balance_added=true...`);
      
      await supabase
        .from('recovery_requests')
        .update({ balance_added: true })
        .eq('id', RECOVERY_ID);
      
      console.log(`   ✅ Flag balance_added aggiornato`);
      return;
    }

    // 3. Processa il recupero (stessa logica di processSingleRecovery)
    const recoveryDate = new Date(recovery.recovery_date);
    const recoveryYear = recoveryDate.getFullYear();
    const recoveryMonth = recoveryDate.getMonth() + 1;
    const recoveryHours = parseFloat(recovery.hours);

    // Recupera il saldo corrente
    const { data: currentBalance, error: balanceError } = await supabase
      .from('current_balances')
      .select('current_balance, total_accrued')
      .eq('user_id', recovery.user_id)
      .eq('category', 'overtime')
      .eq('year', recoveryYear)
      .single();

    if (balanceError && balanceError.code !== 'PGRST116') {
      console.error('❌ Errore recupero saldo:', balanceError);
      return;
    }

    const currentOvertimeBalance = currentBalance?.current_balance || 0;
    const newOvertimeBalance = currentOvertimeBalance + recoveryHours;
    const totalAccrued = (currentBalance?.total_accrued || 0) + recoveryHours;

    // Inserisci nel ledger
    const recoveryReason = `Recupero ore: +${recoveryHours}h (dalle ${recovery.start_time} alle ${recovery.end_time})`;
    
    const { error: ledgerError } = await supabase
      .from('hours_ledger')
      .insert({
        user_id: recovery.user_id,
        transaction_date: recovery.recovery_date,
        transaction_type: 'accrual',
        category: 'overtime',
        hours: recoveryHours,
        reason: recoveryReason,
        notes: recoveryReason,
        reference_id: recovery.id,
        reference_type: 'recovery_request',
        period_year: recoveryYear,
        period_month: recoveryMonth,
        running_balance: newOvertimeBalance
      });

    if (ledgerError) {
      console.error('❌ Errore inserimento ledger:', ledgerError);
      return;
    }

    console.log(`   ✅ Ledger entry creata`);

    // Aggiorna current_balances
    const { error: balanceUpdateError } = await supabase
      .from('current_balances')
      .upsert({
        user_id: recovery.user_id,
        category: 'overtime',
        year: recoveryYear,
        total_accrued: totalAccrued,
        current_balance: newOvertimeBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,category,year'
      });

    if (balanceUpdateError) {
      console.error('❌ Errore aggiornamento balance:', balanceUpdateError);
      return;
    }

    console.log(`   ✅ Balance aggiornato: ${currentOvertimeBalance}h → ${newOvertimeBalance}h (+${recoveryHours}h)`);

    // Aggiorna recovery_requests
    await supabase
      .from('recovery_requests')
      .update({
        balance_added: true,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', RECOVERY_ID);

    console.log(`   ✅ Flag balance_added aggiornato`);

    // Crea/aggiorna attendance se necessario
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', recovery.user_id)
      .eq('date', recovery.recovery_date)
      .single();

    if (existingAttendance) {
      await supabase
        .from('attendance')
        .update({
          actual_hours: parseFloat(recovery.hours),
          expected_hours: 0,
          balance_hours: parseFloat(recovery.hours),
          notes: `Recupero ore: +${recovery.hours}h (dalle ${recovery.start_time} alle ${recovery.end_time})`
        })
        .eq('id', existingAttendance.id);
      console.log(`   ✅ Attendance aggiornato`);
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
      console.log(`   ✅ Attendance creato`);
    }

    console.log(`\n✅ Recupero processato con successo!`);
    console.log(`   ${userName}: ${currentOvertimeBalance}h → ${newOvertimeBalance}h (+${recoveryHours}h)`);

  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

processMicheleRecovery();
