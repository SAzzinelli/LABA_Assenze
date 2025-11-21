/**
 * Script per analizzare e correggere il balance totale di Alessia
 * Il problema è che mostra +1h ma dovrebbe essere 0h
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

async function fixAlessiaTotalBalance() {
  try {
    console.log('🔍 Cercando Alessia Pasqui...\n');

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
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`✅ Trovata: ${alessia.first_name} ${alessia.last_name} (ID: ${alessiaId})`);
    console.log(`📅 Oggi: ${today}\n`);
    
    // Recupera tutti i record di attendance
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', alessiaId)
      .order('date', { ascending: false });
    
    if (attendanceError) {
      console.error('❌ Errore:', attendanceError);
      return;
    }
    
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
    
    console.log('📊 GIORNI CON BALANCE != 0 (escludendo oggi e 104):\n');
    
    let totalBalance = 0;
    const nonZero = [];
    
    attendance.forEach(record => {
      const hasPerm104 = perm104Dates.has(record.date);
      const isToday = record.date === today;
      
      if (!hasPerm104 && !isToday) {
        const balance = record.balance_hours || 0;
        if (Math.abs(balance) > 0.001) {
          nonZero.push({ ...record, balance, hasPerm104, isToday });
          totalBalance += balance;
        }
      }
    });
    
    nonZero.forEach(r => {
      console.log(`   ${r.date}: ${formatHours(r.expected_hours)} attese, ${formatHours(r.actual_hours)} effettive = ${formatHours(r.balance)} (${r.balance > 0 ? '+' : ''}${r.balance.toFixed(2)}h)`);
    });
    
    console.log(`\n💰 TOTALE (escludendo oggi e 104): ${formatHours(totalBalance)} (${totalBalance > 0 ? '+' : ''}${totalBalance.toFixed(2)}h)\n`);
    
    if (Math.abs(totalBalance) < 0.01) {
      console.log('✅ Balance totale corretto: 0h (in pari)');
    } else {
      console.log(`⚠️  Balance totale: ${formatHours(totalBalance)} (dovrebbe essere 0h)`);
      console.log('\n💡 Se Alessia dovrebbe essere in pari (0h), potrebbe essere che:');
      console.log('   1. Alcune ore effettive sono errate');
      console.log('   2. Alcune ore attese sono errate');
      console.log('   3. C\'è un permesso o una ferie non considerati correttamente');
      console.log('\n🔍 Analisi dettagliata:');
      
      const positiveDays = nonZero.filter(r => r.balance > 0);
      const negativeDays = nonZero.filter(r => r.balance < 0);
      
      if (positiveDays.length > 0) {
        console.log(`\n   📈 Giorni con credito (+${positiveDays.length}):`);
        let positiveTotal = 0;
        positiveDays.forEach(r => {
          positiveTotal += r.balance;
          console.log(`      ${r.date}: ${formatHours(r.balance)} (${r.actual_hours}h effettive - ${r.expected_hours}h attese)`);
        });
        console.log(`      Totale credito: ${formatHours(positiveTotal)}`);
      }
      
      if (negativeDays.length > 0) {
        console.log(`\n   📉 Giorni con debito (${negativeDays.length}):`);
        let negativeTotal = 0;
        negativeDays.forEach(r => {
          negativeTotal += r.balance;
          console.log(`      ${r.date}: ${formatHours(r.balance)} (${r.actual_hours}h effettive - ${r.expected_hours}h attese)`);
        });
        console.log(`      Totale debito: ${formatHours(negativeTotal)}`);
      }
      
      console.log(`\n   📊 Somma: ${formatHours(positiveDays.reduce((s, r) => s + r.balance, 0))} + ${formatHours(negativeDays.reduce((s, r) => s + r.balance, 0))} = ${formatHours(totalBalance)}`);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

fixAlessiaTotalBalance()
  .then(() => {
    console.log('\n🎉 Script completato!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

