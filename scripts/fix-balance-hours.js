/**
 * Script per ricalcolare tutti i balance_hours nel database
 * balance_hours = actual_hours - expected_hours
 * 
 * Questo è necessario dopo aver corretto le expected_hours per Alessia e altri dipendenti
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

async function fixBalanceHours() {
  try {
    console.log('🔄 Ricalcolo balance_hours per tutti i record di attendance...\n');

    // Recupera tutti i record di attendance
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .order('date', { ascending: false });
    
    if (attendanceError) {
      console.error('❌ Errore nel caricamento attendance:', attendanceError);
      return;
    }
    
    console.log(`✅ Trovati ${attendance?.length || 0} record di attendance totali\n`);
    console.log('='.repeat(80));
    
    // Recupera tutti i permessi 104 approvati per escluderli dal ricalcolo
    const { data: perm104All, error: perm104Error } = await supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date')
      .eq('type', 'permission_104')
      .eq('status', 'approved');
    
    if (perm104Error) {
      console.error('⚠️ Errore nel caricamento permessi 104:', perm104Error);
    }
    
    // Crea una mappa di date con permesso 104 per ogni utente
    const perm104Map = {};
    if (perm104All) {
      perm104All.forEach(perm => {
        if (!perm104Map[perm.user_id]) perm104Map[perm.user_id] = new Set();
        const start = new Date(perm.start_date);
        const end = new Date(perm.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          perm104Map[perm.user_id].add(d.toISOString().split('T')[0]);
        }
      });
    }
    
    console.log('🔍 Analisi record...\n');
    
    let correctedCount = 0;
    let errors = [];
    const corrections = [];
    
    attendance.forEach(record => {
      const actualHours = record.actual_hours || 0;
      const expectedHours = record.expected_hours || 0;
      const oldBalanceHours = record.balance_hours || 0;
      
      // Verifica se questo giorno ha un permesso 104
      const hasPerm104 = perm104Map[record.user_id]?.has(record.date);
      
      // Calcola il nuovo balance
      let newBalanceHours;
      if (hasPerm104) {
        // Con permesso 104, balance è sempre 0
        newBalanceHours = 0;
      } else {
        // Calcolo normale: balance = actual - expected
        newBalanceHours = actualHours - expectedHours;
      }
      
      // Verifica se il balance è cambiato
      if (Math.abs(oldBalanceHours - newBalanceHours) > 0.001) {
        corrections.push({
          id: record.id,
          user_id: record.user_id,
          date: record.date,
          actual_hours: actualHours,
          expected_hours: expectedHours,
          oldBalance: oldBalanceHours,
          newBalance: newBalanceHours,
          hasPerm104: hasPerm104
        });
      }
    });
    
    console.log(`📋 Trovati ${corrections.length} record da correggere:\n`);
    
    corrections.forEach(corr => {
      console.log(`   ${corr.date} (user: ${corr.user_id.substring(0, 8)}...)`);
      console.log(`      Actual: ${formatHours(corr.actual_hours)}, Expected: ${formatHours(corr.expected_hours)}`);
      console.log(`      Balance: ${formatHours(corr.oldBalance)} → ${formatHours(corr.newBalance)} ${corr.hasPerm104 ? '(104)' : ''}`);
      console.log();
    });
    
    if (corrections.length === 0) {
      console.log('✅ Nessuna correzione necessaria!');
      return;
    }
    
    console.log('='.repeat(80));
    console.log('🔧 Applicazione correzioni...\n');
    
    for (const corr of corrections) {
      try {
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            balance_hours: corr.newBalance
          })
          .eq('id', corr.id);
        
        if (updateError) {
          console.error(`   ❌ Errore correggendo ${corr.date}:`, updateError.message);
          errors.push({ date: corr.date, error: updateError.message });
        } else {
          console.log(`   ✅ Corretto ${corr.date}: ${formatHours(corr.oldBalance)} → ${formatHours(corr.newBalance)}`);
          correctedCount++;
        }
      } catch (err) {
        console.error(`   ❌ Errore correggendo ${corr.date}:`, err.message);
        errors.push({ date: corr.date, error: err.message });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(80));
    console.log(`Record analizzati: ${attendance.length}`);
    console.log(`Record da correggere: ${corrections.length}`);
    console.log(`Record corretti: ${correctedCount}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errori: ${errors.length}`);
      errors.forEach(err => {
        console.log(`   - ${err.date}: ${err.error}`);
      });
    }
    
    if (correctedCount === corrections.length) {
      console.log('\n✅ Tutte le correzioni completate con successo!');
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Ora ricalcola il balance totale per ogni utente
    console.log('🔄 Verifica balance totali...\n');
    
    const userIds = [...new Set(attendance.map(r => r.user_id))];
    
    for (const userId of userIds) {
      try {
        const userAttendance = attendance.filter(r => r.user_id === userId);
        const userPerm104Dates = perm104Map[userId] || new Set();
        
        const totalBalance = userAttendance.reduce((sum, record) => {
          if (userPerm104Dates.has(record.date)) {
            return sum + 0; // Permesso 104: balance = 0
          }
          const balance = record.balance_hours || 0;
          return sum + balance;
        }, 0);
        
        console.log(`   User ${userId.substring(0, 8)}...: ${formatHours(totalBalance)}`);
      } catch (err) {
        console.error(`   ❌ Errore calcolando balance per user ${userId}:`, err.message);
      }
    }
    
    console.log('\n✅ Verifica balance totali completata!');
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

// Esegui lo script
fixBalanceHours()
  .then(() => {
    console.log('\n🎉 Script completato!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

