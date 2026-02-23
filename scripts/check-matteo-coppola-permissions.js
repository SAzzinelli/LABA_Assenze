/**
 * Script per elencare TUTTI i permessi di Matteo Coppola
 * - Permessi orari (type: permission)
 * - Permessi 104 (type: permission_104)
 * - Include cronologia: created_at, updated_at, approved_at
 * - Tutti gli status (approved, pending, rejected, cancelled)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variabili SUPABASE_URL e SUPABASE_SERVICE_KEY richieste nel .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function formatTime(t) {
  if (!t) return '-';
  const s = String(t);
  return s.length >= 5 ? s.substring(0, 5) : s;
}

async function checkMatteoCoppolaPermissions() {
  console.log('🔍 Ricerca permessi di Matteo Coppola...\n');

  try {
    // 1. Trova l'utente
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, department, has_104')
      .eq('first_name', 'Matteo')
      .eq('last_name', 'Coppola');

    if (userError) {
      console.error('❌ Errore nel recupero utente:', userError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ Nessun utente "Matteo Coppola" trovato.');
      return;
    }

    const user = users[0];
    console.log('👤 UTENTE:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.first_name} ${user.last_name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Dipartimento: ${user.department || '-'}`);
    console.log(`   Ha 104: ${user.has_104 ? 'Sì' : 'No'}`);
    console.log('');

    // 2. Recupera TUTTE le leave_requests per permessi (type permission e permission_104)
    const { data: permissions, error: permError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['permission', 'permission_104'])
      .order('start_date', { ascending: false });

    if (permError) {
      console.error('❌ Errore nel recupero permessi:', permError);
      return;
    }

    const permOrari = (permissions || []).filter(p => p.type === 'permission');
    const perm104 = (permissions || []).filter(p => p.type === 'permission_104');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 PERMESSI ORARI (type: permission)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Totale: ${permOrari.length}\n`);

    if (permOrari.length === 0) {
      console.log('   Nessun permesso orario trovato.\n');
    } else {
      permOrari.forEach((p, i) => {
        const statusIcon = { approved: '✅', pending: '⏳', rejected: '❌', cancelled: '🚫' }[p.status] || '❓';
        const tipo = p.permission_type || '-';
        const ore = p.hours != null ? `${p.hours}h` : '-';
        const exit = formatTime(p.exit_time);
        const entry = formatTime(p.entry_time);
        console.log(`${i + 1}. ${statusIcon} ${p.start_date} → ${p.end_date}`);
        console.log(`   Tipo: ${tipo} | Ore: ${ore} | Exit: ${exit} | Entry: ${entry}`);
        console.log(`   Stato: ${p.status}`);
        console.log(`   Motivo: ${p.reason || '-'}`);
        if (p.notes) console.log(`   Note: ${p.notes}`);
        console.log(`   Creato: ${formatDate(p.created_at)}`);
        if (p.approved_at) console.log(`   Approvato: ${formatDate(p.approved_at)}`);
        if (p.rejection_reason) console.log(`   Motivo rifiuto: ${p.rejection_reason}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 PERMESSI 104 (type: permission_104)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Totale: ${perm104.length}\n`);

    if (perm104.length === 0) {
      console.log('   Nessun permesso 104 trovato.\n');
    } else {
      perm104.forEach((p, i) => {
        const statusIcon = { approved: '✅', pending: '⏳', rejected: '❌', cancelled: '🚫' }[p.status] || '❓';
        const giorni = p.days_requested != null ? `${p.days_requested} gg` : '-';
        console.log(`${i + 1}. ${statusIcon} ${p.start_date} → ${p.end_date}`);
        console.log(`   Giorni richiesti: ${giorni}`);
        console.log(`   Stato: ${p.status}`);
        console.log(`   Motivo: ${p.reason || '-'}`);
        if (p.notes) console.log(`   Note: ${p.notes}`);
        console.log(`   Creato: ${formatDate(p.created_at)}`);
        if (p.approved_at) console.log(`   Approvato: ${formatDate(p.approved_at)}`);
        if (p.rejection_reason) console.log(`   Motivo rifiuto: ${p.rejection_reason}`);
        console.log('');
      });
    }

    // 3. Permessi "attivi" (approved con end_date >= oggi)
    const today = new Date().toISOString().split('T')[0];
    const attiviOrari = permOrari.filter(p => p.status === 'approved' && p.end_date >= today);
    const attivi104 = perm104.filter(p => p.status === 'approved' && p.end_date >= today);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🟢 PERMESSI ATTIVI (approvati e non ancora scaduti)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Permessi orari: ${attiviOrari.length}`);
    attiviOrari.forEach(p => {
      console.log(`   - ${p.start_date} → ${p.end_date} | ${p.permission_type || '-'} | ${p.hours}h`);
    });
    console.log(`\nPermessi 104: ${attivi104.length}`);
    attivi104.forEach(p => {
      console.log(`   - ${p.start_date} → ${p.end_date} | ${p.days_requested} gg`);
    });

    // 4. Audit logs per leave_requests di questo utente (se esistono)
    const allIds = [...permOrari.map(p => p.id), ...perm104.map(p => p.id)];
    let auditLogs = [];
    if (allIds.length > 0) {
      const { data, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'leave_requests')
        .in('record_id', allIds)
        .order('created_at', { ascending: false });
      if (!auditError && data) auditLogs = data;
    }

    if (auditLogs.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('📜 LOG MODIFICHE (audit_logs)');
      console.log('═══════════════════════════════════════════════════════════════');
      auditLogs.forEach(a => {
        console.log(`   ${formatDate(a.created_at)} | ${a.action} | record: ${a.record_id}`);
      });
    }
  } catch (err) {
    console.error('❌ Errore:', err);
  }
}

checkMatteoCoppolaPermissions();
