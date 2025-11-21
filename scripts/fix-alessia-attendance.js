/**
 * Script per correggere tutte le presenze errate di Alessia Pasqui
 * 
 * Orari corretti:
 * - Lun-Ven: 9:00-17:00 (break 60min) = 7h
 * - Sabato: 9:00-14:00 (break 0min) = 5h
 * 
 * Correggere:
 * - Tutti i sabati con expected_hours != 5h → impostare a 5h
 * - Tutti i giorni feriali con expected_hours = 8h → impostare a 7h
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';

if (!supabaseKey) {
  console.error('❌ Errore: SUPABASE_SERVICE_KEY deve essere configurato');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Funzione per formattare le ore
function formatHours(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return 'N/A';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

async function fixAlessiaAttendance() {
  try {
    console.log('🔍 Cercando Alessia Pasqui...');
    
    // Trova l'ID di Alessia Pasqui
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .ilike('first_name', 'Alessia')
      .ilike('last_name', '%Pasqui%');
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ Alessia Pasqui non trovata');
      return;
    }
    
    const alessia = users[0];
    const alessiaId = alessia.id;
    
    console.log(`✅ Trovata: ${alessia.first_name} ${alessia.last_name} (ID: ${alessiaId})`);
    console.log('\n' + '='.repeat(80));
    
    // Recupera tutti i record di attendance
    console.log('📊 Caricamento tutte le presenze...');
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', alessiaId)
      .order('date', { ascending: false });
    
    if (attendanceError) {
      console.error('❌ Errore nel caricamento attendance:', attendanceError);
      return;
    }
    
    console.log(`✅ Trovate ${attendance?.length || 0} presenze totali`);
    console.log('\n' + '='.repeat(80));
    
    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const corrections = [];
    const errors = [];
    
    console.log('🔍 Analisi e correzione presenze...\n');
    
    attendance.forEach(record => {
      const date = new Date(record.date);
      const dayOfWeek = date.getDay();
      const dayName = dayNames[dayOfWeek];
      const expectedHours = record.expected_hours || 0;
      const actualHours = record.actual_hours || 0;
      let newExpectedHours = expectedHours;
      let needsCorrection = false;
      let correctionReason = '';
      
      // Sabato (day 6): dovrebbe essere 5h
      if (dayOfWeek === 6) {
        if (Math.abs(expectedHours - 5) > 0.01) {
          newExpectedHours = 5;
          needsCorrection = true;
          correctionReason = `Sabato: era ${formatHours(expectedHours)}, deve essere 5h`;
        }
      }
      // Lun-Ven (day 1-5): dovrebbe essere 7h (non 8h)
      else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (Math.abs(expectedHours - 8) < 0.01) {
          newExpectedHours = 7;
          needsCorrection = true;
          correctionReason = `Giorno feriale: era ${formatHours(expectedHours)}, deve essere 7h`;
        }
      }
      
      if (needsCorrection) {
        // Ricalcola balance_hours
        const newBalanceHours = actualHours - newExpectedHours;
        
        corrections.push({
          date: record.date,
          dayName: dayName,
          dayOfWeek: dayOfWeek,
          oldExpected: expectedHours,
          newExpected: newExpectedHours,
          actualHours: actualHours,
          oldBalance: record.balance_hours || 0,
          newBalance: newBalanceHours,
          reason: correctionReason
        });
      }
    });
    
    console.log(`📋 Trovate ${corrections.length} presenze da correggere:\n`);
    
    corrections.forEach(corr => {
      console.log(`   ${corr.date} (${corr.dayName})`);
      console.log(`      ${corr.reason}`);
      console.log(`      Ore Attese: ${formatHours(corr.oldExpected)} → ${formatHours(corr.newExpected)}`);
      console.log(`      Ore Effettive: ${formatHours(corr.actualHours)}`);
      console.log(`      Balance: ${formatHours(corr.oldBalance)} → ${formatHours(corr.newBalance)}`);
      console.log();
    });
    
    if (corrections.length === 0) {
      console.log('✅ Nessuna correzione necessaria!');
      return;
    }
    
    console.log('='.repeat(80));
    console.log('🔧 Applicazione correzioni...\n');
    
    let fixedCount = 0;
    
    for (const corr of corrections) {
      try {
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            expected_hours: corr.newExpected,
            balance_hours: corr.newBalance
          })
          .eq('user_id', alessiaId)
          .eq('date', corr.date);
        
        if (updateError) {
          console.error(`   ❌ Errore correggendo ${corr.date}:`, updateError.message);
          errors.push({ date: corr.date, error: updateError.message });
        } else {
          console.log(`   ✅ Corretto ${corr.date} (${corr.dayName}): ${formatHours(corr.oldExpected)} → ${formatHours(corr.newExpected)}`);
          fixedCount++;
        }
      } catch (err) {
        console.error(`   ❌ Errore correggendo ${corr.date}:`, err.message);
        errors.push({ date: corr.date, error: err.message });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(80));
    console.log(`Presenze analizzate: ${attendance.length}`);
    console.log(`Presenze da correggere: ${corrections.length}`);
    console.log(`Presenze corrette: ${fixedCount}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errori: ${errors.length}`);
      errors.forEach(err => {
        console.log(`   - ${err.date}: ${err.error}`);
      });
    }
    
    if (fixedCount === corrections.length) {
      console.log('\n✅ Tutte le correzioni completate con successo!');
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Ricalcola il balance mensile per tutti i mesi interessati
    console.log('🔄 Ricalcolo balance mensili...\n');
    
    const monthsToUpdate = new Set();
    corrections.forEach(corr => {
      const date = new Date(corr.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthsToUpdate.add(monthKey);
    });
    
    for (const monthKey of monthsToUpdate) {
      const [year, month] = monthKey.split('-').map(Number);
      try {
        console.log(`   Ricalcolo balance per ${month}/${year}...`);
        
        // Usa la funzione RPC per ricalcolare il balance mensile
        const { error: rpcError } = await supabase.rpc('update_monthly_hours_balance', {
          p_user_id: alessiaId,
          p_year: year,
          p_month: month
        });
        
        if (rpcError) {
          console.error(`   ❌ Errore ricalcolando balance per ${month}/${year}:`, rpcError.message);
        } else {
          console.log(`   ✅ Balance ricalcolato per ${month}/${year}`);
        }
      } catch (err) {
        console.error(`   ❌ Errore ricalcolando balance per ${monthKey}:`, err.message);
      }
    }
    
    console.log('\n✅ Ricalcolo balance mensili completato!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

// Esegui lo script
fixAlessiaAttendance()
  .then(() => {
    console.log('\n🎉 Script completato!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

