/**
 * Script per verificare e correggere i balance di Alessia Pasqui
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
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  const sign = hours < 0 ? '-' : '';
  return `${sign}${h}h ${m}m`;
}

async function fixAlessiaBalance() {
  try {
    console.log('🔍 Cercando Alessia Pasqui...\n');

    // Trova Alessia
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
    console.log(`📧 Email: ${alessia.email}`);
    console.log('\n' + '='.repeat(80));
    
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Oggi: ${today}\n`);
    
    // Recupera tutti i record di attendance di Alessia
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', alessiaId)
      .order('date', { ascending: false });
    
    if (attendanceError) {
      console.error('❌ Errore nel caricamento attendance:', attendanceError);
      return;
    }
    
    console.log(`✅ Trovati ${attendance?.length || 0} record di attendance per Alessia\n`);
    
    // Recupera permessi 104 approvati
    const { data: perm104All, error: perm104Error } = await supabase
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('user_id', alessiaId)
      .eq('type', 'permission_104')
      .eq('status', 'approved');
    
    if (perm104Error) {
      console.error('⚠️ Errore nel caricamento permessi 104:', perm104Error);
    }
    
    // Crea una mappa di date con permesso 104
    const perm104Dates = new Set();
    if (perm104All) {
      perm104All.forEach(perm => {
        const start = new Date(perm.start_date);
        const end = new Date(perm.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          perm104Dates.add(d.toISOString().split('T')[0]);
        }
      });
    }
    
    console.log(`📋 Permessi 104: ${perm104Dates.size} giorni totali\n`);
    
    // Ricalcola balance per ogni record
    let totalBalance = 0;
    let totalActual = 0;
    let totalExpected = 0;
    
    console.log('📊 ANALISI E CORREZIONE RECORD:\n');
    console.log('Data'.padEnd(12) + ' | Attese'.padEnd(10) + ' | Effettive'.padEnd(12) + ' | Balance DB'.padEnd(15) + ' | Balance Calc'.padEnd(15) + ' | 104? | Oggi?');
    console.log('-'.repeat(120));
    
    const corrections = [];
    
    attendance.forEach(record => {
      const actualHours = record.actual_hours || 0;
      const expectedHours = record.expected_hours || 0;
      const balanceDB = record.balance_hours || 0;
      const hasPerm104 = perm104Dates.has(record.date);
      const isToday = record.date === today;
      
      // Calcola balance corretto
      let correctBalance;
      if (hasPerm104) {
        correctBalance = 0; // Permesso 104: balance = 0
      } else {
        correctBalance = actualHours - expectedHours;
      }
      
      // Verifica se il balance nel DB è corretto
      const balanceDiff = Math.abs(balanceDB - correctBalance);
      if (balanceDiff > 0.001) {
        corrections.push({
          id: record.id,
          date: record.date,
          actualHours,
          expectedHours,
          balanceDB,
          correctBalance,
          hasPerm104,
          isToday
        });
      }
      
      // Somma al totale (escludendo permessi 104 e oggi)
      if (!hasPerm104 && !isToday) {
        totalBalance += correctBalance;
      }
      
      totalActual += actualHours;
      totalExpected += expectedHours;
      
      const dateStr = record.date.padEnd(12);
      const expectedStr = formatHours(expectedHours).padEnd(10);
      const actualStr = formatHours(actualHours).padEnd(12);
      const balanceDBStr = formatHours(balanceDB).padEnd(15);
      const balanceCalcStr = formatHours(correctBalance).padEnd(15);
      const perm104Str = hasPerm104 ? 'SI' : 'NO';
      const todayStr = isToday ? 'SI' : 'NO';
      
      console.log(`${dateStr} | ${expectedStr} | ${actualStr} | ${balanceDBStr} | ${balanceCalcStr} | ${perm104Str.padEnd(4)} | ${todayStr}`);
    });
    
    console.log('-'.repeat(120));
    console.log(`\n📊 TOTALE (escludendo permessi 104 e oggi):`);
    console.log(`   Ore Attese Totali: ${formatHours(totalExpected)}`);
    console.log(`   Ore Effettive Totali: ${formatHours(totalActual)}`);
    console.log(`   Balance Totale Corretto: ${formatHours(totalBalance)}`);
    
    if (corrections.length > 0) {
      console.log(`\n⚠️  PROBLEMI TROVATI: ${corrections.length}\n`);
      corrections.forEach(corr => {
        console.log(`   ${corr.date} ${corr.isToday ? '(OGGI)' : ''}:`);
        console.log(`      Actual: ${formatHours(corr.actualHours)}, Expected: ${formatHours(corr.expectedHours)}`);
        console.log(`      Balance DB: ${formatHours(corr.balanceDB)} → Dovrebbe essere: ${formatHours(corr.correctBalance)} ${corr.hasPerm104 ? '(104)' : ''}`);
        console.log();
      });
      
      console.log('🔧 Correzione automatica...\n');
      
      let fixedCount = 0;
      for (const corr of corrections) {
        try {
          const { error: updateError } = await supabase
            .from('attendance')
            .update({
              balance_hours: corr.correctBalance
            })
            .eq('id', corr.id);
          
          if (updateError) {
            console.error(`   ❌ Errore correggendo ${corr.date}:`, updateError.message);
          } else {
            console.log(`   ✅ Corretto ${corr.date}: ${formatHours(corr.balanceDB)} → ${formatHours(corr.correctBalance)}`);
            fixedCount++;
          }
        } catch (err) {
          console.error(`   ❌ Errore correggendo ${corr.date}:`, err.message);
        }
      }
      
      console.log(`\n✅ Corretti ${fixedCount} record su ${corrections.length}`);
      
      // Ricalcola balance totale dopo le correzioni
      console.log('\n🔄 Ricalcolo balance totale dopo correzioni...\n');
      
      totalBalance = 0;
      for (const record of attendance) {
        const hasPerm104 = perm104Dates.has(record.date);
        const isToday = record.date === today;
        
        if (!hasPerm104 && !isToday) {
          const correction = corrections.find(c => c.date === record.date);
          const correctBalance = correction ? correction.correctBalance : (record.balance_hours || 0);
          totalBalance += correctBalance;
        }
      }
      
      console.log(`📊 Nuovo Balance Totale (escludendo 104 e oggi): ${formatHours(totalBalance)}`);
      
      if (Math.abs(totalBalance) < 0.01) {
        console.log('\n✅ Balance Totale corretto: 0h (in pari)');
      } else {
        console.log(`\n⚠️  Balance Totale: ${formatHours(totalBalance)} (dovrebbe essere 0h per essere in pari)`);
      }
    } else {
      console.log('\n✅ Nessun problema trovato nei record individuali');
      
      // Verifica balance totale escludendo oggi
      console.log(`\n💡 Balance Totale (escludendo 104 e oggi): ${formatHours(totalBalance)}`);
      
      if (Math.abs(totalBalance) < 0.01) {
        console.log('✅ Balance Totale corretto: 0h (in pari)');
      } else {
        console.log(`⚠️  Balance Totale: ${formatHours(totalBalance)} (dovrebbe essere 0h per essere in pari)`);
        console.log('💡 Potrebbe essere un problema nel calcolo o nei record passati');
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

// Esegui lo script
fixAlessiaBalance()
  .then(() => {
    console.log('\n🎉 Script completato!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

