const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Leggi le credenziali dalle variabili d'ambiente o dagli argomenti della riga di comando
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Se non trovate, prova a leggerle dagli argomenti della riga di comando
if (!supabaseUrl || !supabaseKey) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      supabaseUrl = args[i + 1];
    }
    if (args[i] === '--key' && args[i + 1]) {
      supabaseKey = args[i + 1];
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variabili SUPABASE_URL e SUPABASE_SERVICE_KEY non trovate');
  console.error('\n📋 ISTRUZIONI:');
  console.error('1. Crea un file .env nella root del progetto con:');
  console.error('   SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_KEY=your-service-key');
  console.error('\n2. Oppure esegui lo script con:');
  console.error('   node scripts/analyze-permission-discrepancies.js --url YOUR_URL --key YOUR_KEY');
  console.error('\n3. Oppure esporta le variabili d\'ambiente:');
  console.error('   export SUPABASE_URL=...');
  console.error('   export SUPABASE_SERVICE_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzePermissionDiscrepancies() {
  console.log('🔍 Analisi discrepanze tra permessi approvati e record di presenza...\n');

  try {
    // 1. Recupera tutti i permessi approvati (giornata intera e orari)
    const { data: approvedPermissions, error: permError } = await supabase
      .from('leave_requests')
      .select(`
        id,
        user_id,
        start_date,
        end_date,
        hours,
        permission_type,
        entry_time,
        exit_time,
        status,
        users!leave_requests_user_id_fkey(first_name, last_name, email)
      `)
      .eq('type', 'permission')
      .eq('status', 'approved')
      .order('start_date', { ascending: true });

    if (permError) {
      console.error('❌ Errore nel recupero permessi:', permError);
      return;
    }

    console.log(`📋 Trovati ${approvedPermissions.length} permessi approvati totali\n`);

    // 2. Per ogni permesso, controlla i record di attendance corrispondenti
    const discrepancies = [];
    const today = new Date().toISOString().split('T')[0];

    for (const perm of approvedPermissions) {
      // Genera tutte le date del permesso (potrebbe essere un range)
      const startDate = new Date(perm.start_date);
      const endDate = new Date(perm.end_date);
      const dates = [];
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      for (const date of dates) {
        // Skip date future
        if (date > today) continue;

        // Recupera il record di attendance per questa data
        const { data: attendance, error: attError } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', perm.user_id)
          .eq('date', date)
          .single();

        const userName = perm.users ? `${perm.users.first_name} ${perm.users.last_name}` : `User ${perm.user_id}`;
        const isFullDay = perm.permission_type === 'full_day' || perm.permission_type === 'giornata_intera' || perm.permission_type === 'tutta_giornata';
        const permissionHours = parseFloat(perm.hours || 0);

        // Analizza la discrepanza
        if (attError && attError.code === 'PGRST116') {
          // Nessun record di attendance trovato
          discrepancies.push({
            user: userName,
            userId: perm.user_id,
            email: perm.users?.email || 'N/A',
            date: date,
            permissionType: perm.permission_type || 'N/A',
            isFullDay: isFullDay,
            permissionHours: permissionHours,
            issue: 'NO_ATTENDANCE_RECORD',
            description: `Permesso approvato ma nessun record di presenza trovato`,
            attendanceActualHours: null,
            attendanceExpectedHours: null,
            attendanceBalanceHours: null
          });
        } else if (attendance) {
          const actualHours = parseFloat(attendance.actual_hours || 0);
          const expectedHours = parseFloat(attendance.expected_hours || 0);
          const balanceHours = parseFloat(attendance.balance_hours || 0);

          // Controlla diverse tipologie di discrepanze
          let issue = null;
          let description = '';

          if (isFullDay) {
            // Permesso giornata intera: actual_hours dovrebbe essere 0 o molto basso
            // expected_hours dovrebbe essere presente (giornata lavorativa normale)
            // balance_hours dovrebbe essere negativo (debito)
            
            if (actualHours > 2) {
              issue = 'FULL_DAY_HAS_HOURS';
              description = `Permesso giornata intera ma actual_hours = ${actualHours}h (dovrebbe essere ~0h)`;
            }
            
            // Controlla se balance_hours non riflette il permesso
            const expectedDebit = -permissionHours;
            if (balanceHours > -1 && actualHours === 0) {
              issue = 'FULL_DAY_WRONG_BALANCE';
              description = `Permesso giornata intera ma balance_hours = ${balanceHours}h (dovrebbe essere ~${expectedDebit}h)`;
            }
          } else {
            // Permesso orario: actual_hours dovrebbe essere ridotto rispetto a expected_hours
            // balance_hours dovrebbe essere negativo (debito)
            
            if (actualHours >= expectedHours && actualHours > 0) {
              issue = 'PARTIAL_PERMISSION_NO_REDUCTION';
              description = `Permesso orario (${permissionHours}h) ma actual_hours (${actualHours}h) >= expected_hours (${expectedHours}h)`;
            }
            
            // Controlla se balance_hours non riflette il permesso
            const expectedDebit = -permissionHours;
            if (Math.abs(balanceHours - expectedDebit) > 0.5 && actualHours > 0) {
              issue = 'PARTIAL_PERMISSION_WRONG_BALANCE';
              description = `Permesso orario (${permissionHours}h) ma balance_hours = ${balanceHours}h (dovrebbe essere ~${expectedDebit}h)`;
            }
          }

          // Controlla se actual_hours è 0 ma expected_hours > 0 (assenza non giustificata)
          if (actualHours === 0 && expectedHours > 0 && !isFullDay) {
            issue = 'ZERO_HOURS_WITH_EXPECTED';
            description = `Permesso orario ma actual_hours = 0h con expected_hours = ${expectedHours}h (potrebbe essere assenza non giustificata)`;
          }

          if (issue) {
            discrepancies.push({
              user: userName,
              userId: perm.user_id,
              email: perm.users?.email || 'N/A',
              date: date,
              permissionType: perm.permission_type || 'N/A',
              isFullDay: isFullDay,
              permissionHours: permissionHours,
              issue: issue,
              description: description,
              attendanceActualHours: actualHours,
              attendanceExpectedHours: expectedHours,
              attendanceBalanceHours: balanceHours,
              permissionId: perm.id
            });
          }
        }
      }
    }

    // 3. Raggruppa per utente e tipo di problema
    console.log('📊 RISULTATI ANALISI DISCREPANZE\n');
    console.log(`Trovate ${discrepancies.length} discrepanze totali\n`);

    if (discrepancies.length === 0) {
      console.log('✅ Nessuna discrepanza trovata! Tutti i permessi sono correttamente riflessi nei record di presenza.');
      return;
    }

    // Raggruppa per tipo di problema
    const byIssue = {};
    discrepancies.forEach(d => {
      if (!byIssue[d.issue]) {
        byIssue[d.issue] = [];
      }
      byIssue[d.issue].push(d);
    });

    console.log('📋 DISCREPANZE PER TIPO:\n');
    Object.keys(byIssue).forEach(issue => {
      console.log(`\n🔴 ${issue}: ${byIssue[issue].length} casi`);
      console.log('─'.repeat(80));
      
      byIssue[issue].forEach((d, idx) => {
        console.log(`\n${idx + 1}. ${d.user} (${d.email})`);
        console.log(`   Data: ${d.date}`);
        console.log(`   Tipo permesso: ${d.permissionType} ${d.isFullDay ? '(GIORNATA INTERA)' : '(ORARIO)'}`);
        console.log(`   Ore permesso: ${d.permissionHours}h`);
        if (d.attendanceActualHours !== null) {
          console.log(`   Actual hours: ${d.attendanceActualHours}h`);
          console.log(`   Expected hours: ${d.attendanceExpectedHours}h`);
          console.log(`   Balance hours: ${d.attendanceBalanceHours}h`);
        }
        console.log(`   Problema: ${d.description}`);
      });
    });

    // Raggruppa per utente
    console.log('\n\n📋 DISCREPANZE PER UTENTE:\n');
    const byUser = {};
    discrepancies.forEach(d => {
      const key = `${d.user} (${d.email})`;
      if (!byUser[key]) {
        byUser[key] = [];
      }
      byUser[key].push(d);
    });

    Object.keys(byUser).sort().forEach(user => {
      console.log(`\n👤 ${user}: ${byUser[user].length} discrepanze`);
      console.log('─'.repeat(80));
      
      byUser[user].forEach((d, idx) => {
        console.log(`\n  ${idx + 1}. ${d.date} - ${d.permissionType} ${d.isFullDay ? '(GIORNATA INTERA)' : '(ORARIO)'} - ${d.permissionHours}h`);
        console.log(`     Problema: ${d.description}`);
        if (d.attendanceActualHours !== null) {
          console.log(`     Actual: ${d.attendanceActualHours}h, Expected: ${d.attendanceExpectedHours}h, Balance: ${d.attendanceBalanceHours}h`);
        }
      });
    });

    // Statistiche riassuntive
    console.log('\n\n📊 STATISTICHE RIASSUNTIVE:\n');
    console.log('─'.repeat(80));
    console.log(`Totale discrepanze: ${discrepancies.length}`);
    console.log(`Utenti coinvolti: ${Object.keys(byUser).length}`);
    console.log(`Date coinvolte: ${new Set(discrepancies.map(d => d.date)).size}`);
    
    const fullDayIssues = discrepancies.filter(d => d.isFullDay).length;
    const partialIssues = discrepancies.filter(d => !d.isFullDay).length;
    console.log(`\nPermessi giornata intera con problemi: ${fullDayIssues}`);
    console.log(`Permessi orari con problemi: ${partialIssues}`);

    // Export per correzione futura
    console.log('\n\n💾 Dati esportati per correzione:\n');
    console.log(JSON.stringify(discrepancies, null, 2));

  } catch (error) {
    console.error('❌ Errore durante l\'analisi:', error);
  }
}

analyzePermissionDiscrepancies();
