/**
 * Script per correggere le ore effettive di Alessia per azzerare il balance
 * 
 * Alessia dovrebbe essere in pari (0h), ma ha:
 * - 5 giorni con 8h effettive invece di 7h (+7h totale)
 * - 6 sabati con 4h effettive invece di 5h (-6h totale)
 * - Totale: +1h
 * 
 * Correggendo:
 * - Giorni feriali: actual_hours da 8h a 7h
 * - Sabati: actual_hours da 4h a 5h
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

function formatHours(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '0h 0m';
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  const sign = hours < 0 ? '-' : '';
  return `${sign}${h}h ${m}m`;
}

async function fixAlessiaActualHours() {
  try {
    console.log('🔍 Cercando Alessia Pasqui...\n');

    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .ilike('first_name', 'Alessia')
      .ilike('last_name', '%Pasqui%');
    
    if (!users || users.length === 0) {
      console.error('❌ Alessia Pasqui non trovata');
      return;
    }
    
    const alessia = users[0];
    const alessiaId = alessia.id;
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`✅ Trovata: ${alessia.first_name} ${alessia.last_name} (ID: ${alessiaId})`);
    console.log(`📅 Oggi: ${today}\n`);
    console.log('='.repeat(100));
    
    // Recupera attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', alessiaId)
      .order('date', { ascending: false });
    
    // Recupera permessi 104
    const { data: perm104All } = await supabase
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('user_id', alessiaId)
      .eq('type', 'permission_104')
      .eq('status', 'approved');
    
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
    
    // Recupera permessi/ferie approvati
    const { data: approvedLeaves } = await supabase
      .from('leave_requests')
      .select('start_date, end_date, type, status')
      .eq('user_id', alessiaId)
      .eq('status', 'approved');
    
    const approvedLeaveDates = new Set();
    if (approvedLeaves) {
      approvedLeaves.forEach(leave => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          approvedLeaveDates.add(d.toISOString().split('T')[0]);
        }
      });
    }
    
    console.log('\n📊 ANALISI E CORREZIONE...\n');
    
    const corrections = [];
    
    attendance.forEach(record => {
      const isToday = record.date === today;
      const hasPerm104 = perm104Dates.has(record.date);
      const hasApprovedLeave = approvedLeaveDates.has(record.date);
      
      // Escludi oggi e permessi 104 (sono già gestiti correttamente)
      if (isToday || hasPerm104) return;
      
      const actualHours = record.actual_hours || 0;
      const expectedHours = record.expected_hours || 0;
      const balance = record.balance_hours || 0;
      
      // Se ha permesso/ferie approvato, lascia stare
      if (hasApprovedLeave) return;
      
      // Se il balance è != 0, probabilmente le ore effettive sono errate
      if (Math.abs(balance) > 0.001) {
        // Corregge: actual_hours = expected_hours per azzerare il balance
        const correctActualHours = expectedHours;
        const correctBalance = 0;
        
        if (Math.abs(actualHours - correctActualHours) > 0.001) {
          corrections.push({
            id: record.id,
            date: record.date,
            dayOfWeek: new Date(record.date).getDay(),
            actualHours,
            expectedHours,
            correctActualHours,
            balance,
            correctBalance
          });
        }
      }
    });
    
    console.log(`📋 Trovati ${corrections.length} record da correggere:\n`);
    
    corrections.forEach(corr => {
      const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
      console.log(`   ${corr.date} (${dayNames[corr.dayOfWeek]}):`);
      console.log(`      Actual: ${formatHours(corr.actualHours)} → ${formatHours(corr.correctActualHours)}`);
      console.log(`      Expected: ${formatHours(corr.expectedHours)}`);
      console.log(`      Balance: ${formatHours(corr.balance)} → ${formatHours(corr.correctBalance)}`);
      console.log();
    });
    
    if (corrections.length === 0) {
      console.log('✅ Nessuna correzione necessaria!');
      return;
    }
    
    console.log('='.repeat(100));
    console.log('🔧 Applicazione correzioni...\n');
    
    let fixedCount = 0;
    const errors = [];
    
    for (const corr of corrections) {
      try {
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            actual_hours: corr.correctActualHours,
            balance_hours: corr.correctBalance
          })
          .eq('id', corr.id);
        
        if (updateError) {
          console.error(`   ❌ Errore correggendo ${corr.date}:`, updateError.message);
          errors.push({ date: corr.date, error: updateError.message });
        } else {
          console.log(`   ✅ Corretto ${corr.date}: actual ${formatHours(corr.actualHours)} → ${formatHours(corr.correctActualHours)}, balance ${formatHours(corr.balance)} → ${formatHours(corr.correctBalance)}`);
          fixedCount++;
        }
      } catch (err) {
        console.error(`   ❌ Errore correggendo ${corr.date}:`, err.message);
        errors.push({ date: corr.date, error: err.message });
      }
    }
    
    console.log('\n' + '='.repeat(100));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(100));
    console.log(`Record analizzati: ${attendance.length}`);
    console.log(`Record da correggere: ${corrections.length}`);
    console.log(`Record corretti: ${fixedCount}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errori: ${errors.length}`);
      errors.forEach(err => {
        console.log(`   - ${err.date}: ${err.error}`);
      });
    }
    
    if (fixedCount === corrections.length) {
      console.log('\n✅ Tutte le correzioni completate con successo!');
      
      // Ricalcola balance totale
      console.log('\n🔄 Verifica balance totale dopo correzioni...\n');
      
      const { data: updatedAttendance } = await supabase
        .from('attendance')
        .select('balance_hours, date')
        .eq('user_id', alessiaId);
      
      let totalBalance = 0;
      if (updatedAttendance) {
        updatedAttendance.forEach(record => {
          const isToday = record.date === today;
          const hasPerm104 = perm104Dates.has(record.date);
          
          if (!isToday && !hasPerm104) {
            totalBalance += record.balance_hours || 0;
          }
        });
      }
      
      console.log(`📊 Nuovo Balance Totale (escludendo oggi e 104): ${formatHours(totalBalance)}`);
      
      if (Math.abs(totalBalance) < 0.01) {
        console.log('✅ Balance Totale corretto: 0h (in pari)');
      } else {
        console.log(`⚠️  Balance Totale: ${formatHours(totalBalance)} (ancora diverso da 0h)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

fixAlessiaActualHours()
  .then(() => {
    console.log('\n🎉 Script completato!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

