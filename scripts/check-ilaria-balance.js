/**
 * Script per verificare il balance di Ilaria Spallarossa
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

async function checkIlariaBalance() {
  try {
    console.log('🔍 Cercando Ilaria Spallarossa...\n');

    // Trova Ilaria
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .ilike('first_name', 'Ilaria')
      .ilike('last_name', '%Spallarossa%');
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ Ilaria Spallarossa non trovata');
      return;
    }
    
    const ilaria = users[0];
    const ilariaId = ilaria.id;
    
    console.log(`✅ Trovata: ${ilaria.first_name} ${ilaria.last_name} (ID: ${ilariaId})`);
    console.log(`📧 Email: ${ilaria.email}`);
    console.log('\n' + '='.repeat(80));
    
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Oggi: ${today}\n`);
    
    // Recupera tutti i record di attendance di Ilaria
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', ilariaId)
      .order('date', { ascending: false });
    
    if (attendanceError) {
      console.error('❌ Errore nel caricamento attendance:', attendanceError);
      return;
    }
    
    console.log(`✅ Trovati ${attendance?.length || 0} record di attendance per Ilaria\n`);
    
    // Recupera permessi 104 approvati
    const { data: perm104All, error: perm104Error } = await supabase
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('user_id', ilariaId)
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
    
    const hasPerm104Today = perm104Dates.has(today);
    console.log(`📋 Permessi 104: ${perm104Dates.size} giorni totali`);
    console.log(`📋 Permesso 104 OGGI: ${hasPerm104Today ? 'SI' : 'NO'}\n`);
    
    // Calcola balance totale
    let totalBalance = 0;
    let totalActual = 0;
    let totalExpected = 0;
    
    console.log('📊 ANALISI RECORD:\n');
    console.log('Data'.padEnd(12) + ' | Attese'.padEnd(10) + ' | Effettive'.padEnd(12) + ' | Balance DB'.padEnd(15) + ' | Balance Calc'.padEnd(15) + ' | 104? | Oggi?');
    console.log('-'.repeat(120));
    
    const issues = [];
    
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
        issues.push({
          date: record.date,
          actualHours,
          expectedHours,
          balanceDB,
          correctBalance,
          hasPerm104,
          isToday
        });
      }
      
      // Somma al totale (escludendo permessi 104)
      if (!hasPerm104) {
        // Usa il balance corretto se c'è un problema, altrimenti dal DB
        totalBalance += (issues.find(i => i.date === record.date)?.correctBalance ?? balanceDB);
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
    console.log(`\n📊 TOTALE (escludendo permessi 104):`);
    console.log(`   Ore Attese Totali: ${formatHours(totalExpected)}`);
    console.log(`   Ore Effettive Totali: ${formatHours(totalActual)}`);
    console.log(`   Balance Totale (da DB, escludendo 104): ${formatHours(totalBalance)}`);
    console.log(`   Balance Totale (calcolato): ${formatHours(totalActual - totalExpected)}`);
    
    if (hasPerm104Today) {
      console.log(`\n🔵 OGGI ha permesso 104: il balance di oggi dovrebbe essere 0`);
    } else {
      const todayRecord = attendance.find(r => r.date === today);
      if (todayRecord) {
        const todayBalance = todayRecord.balance_hours || 0;
        console.log(`\n📅 OGGI (${today}):`);
        console.log(`   Ore Attese: ${formatHours(todayRecord.expected_hours || 0)}`);
        console.log(`   Ore Effettive: ${formatHours(todayRecord.actual_hours || 0)}`);
        console.log(`   Balance DB: ${formatHours(todayBalance)}`);
        console.log(`   ⚠️  Questo balance parziale viene escluso dal totale (la giornata non è conclusa)`);
      }
    }
    
    if (issues.length > 0) {
      console.log(`\n⚠️  PROBLEMI TROVATI: ${issues.length}\n`);
      issues.forEach(issue => {
        console.log(`   ${issue.date} ${issue.isToday ? '(OGGI)' : ''}:`);
        console.log(`      Actual: ${formatHours(issue.actualHours)}, Expected: ${formatHours(issue.expectedHours)}`);
        console.log(`      Balance DB: ${formatHours(issue.balanceDB)} → Dovrebbe essere: ${formatHours(issue.correctBalance)} ${issue.hasPerm104 ? '(104)' : ''}`);
        console.log();
      });
      
      console.log('🔧 Correzione automatica...\n');
      
      let fixedCount = 0;
      for (const issue of issues) {
        try {
          const { error: updateError } = await supabase
            .from('attendance')
            .update({
              balance_hours: issue.correctBalance
            })
            .eq('user_id', ilariaId)
            .eq('date', issue.date);
          
          if (updateError) {
            console.error(`   ❌ Errore correggendo ${issue.date}:`, updateError.message);
          } else {
            console.log(`   ✅ Corretto ${issue.date}: ${formatHours(issue.balanceDB)} → ${formatHours(issue.correctBalance)}`);
            fixedCount++;
          }
        } catch (err) {
          console.error(`   ❌ Errore correggendo ${issue.date}:`, err.message);
        }
      }
      
      console.log(`\n✅ Corretti ${fixedCount} record su ${issues.length}`);
      
      // Ricalcola balance totale dopo le correzioni
      console.log('\n🔄 Ricalcolo balance totale dopo correzioni...\n');
      
      totalBalance = 0;
      for (const record of attendance) {
        const hasPerm104 = perm104Dates.has(record.date);
        if (!hasPerm104) {
          // Usa il balance corretto (se era un problema, ora è corretto)
          const issue = issues.find(i => i.date === record.date);
          totalBalance += issue ? issue.correctBalance : (record.balance_hours || 0);
        }
      }
      
      console.log(`📊 Nuovo Balance Totale (escludendo 104 e oggi): ${formatHours(totalBalance)}`);
      
      // Escludi anche oggi dal totale se non ha permesso 104
      if (!hasPerm104Today) {
        const todayRecord = attendance.find(r => r.date === today);
        if (todayRecord) {
          const todayIssue = issues.find(i => i.date === today);
          const todayBalance = todayIssue ? todayIssue.correctBalance : (todayRecord.balance_hours || 0);
          const totalExcludingToday = totalBalance - todayBalance;
          console.log(`📊 Balance Totale (escludendo 104 e oggi): ${formatHours(totalExcludingToday)}`);
        }
      }
    } else {
      console.log('\n✅ Nessun problema trovato nei record individuali');
      
      // Verifica se il problema è che oggi è incluso nel totale
      if (!hasPerm104Today) {
        const todayRecord = attendance.find(r => r.date === today);
        if (todayRecord) {
          const todayBalance = todayRecord.balance_hours || 0;
          const totalExcludingToday = totalBalance - todayBalance;
          console.log(`\n💡 Balance Totale includendo oggi: ${formatHours(totalBalance)}`);
          console.log(`💡 Balance Totale escludendo oggi (dovrebbe essere questo): ${formatHours(totalExcludingToday)}`);
          console.log(`💡 Balance di oggi (parziale): ${formatHours(todayBalance)}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

// Esegui lo script
checkIlariaBalance()
  .then(() => {
    console.log('\n🎉 Script completato!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

