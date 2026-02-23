/**
 * Fix permesso Matteo Coppola:
 * 1. Elimina permesso 2h del 19 febbraio (late_entry)
 * 2. Aggiunge permesso tutta la giornata del 23 febbraio
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY richieste');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MATTEO_USER_ID = 'd81d4f28-db64-42d5-b060-e5b150e48680';

async function fix() {
  console.log('🔧 Fix permessi Matteo Coppola...\n');

  try {
    // 1. Trova e elimina il permesso del 19 feb
    const { data: oldPerm, error: findErr } = await supabase
      .from('leave_requests')
      .select('id, start_date, permission_type, hours')
      .eq('user_id', MATTEO_USER_ID)
      .eq('type', 'permission')
      .eq('start_date', '2026-02-19')
      .single();

    if (findErr || !oldPerm) {
      console.error('❌ Permesso 19 feb non trovato:', findErr?.message || 'Nessun record');
      return;
    }

    const { error: delErr } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', oldPerm.id);

    if (delErr) {
      console.error('❌ Errore eliminazione permesso 19 feb:', delErr);
      return;
    }
    console.log('✅ Eliminato permesso 19 feb (2h late_entry)\n');

    // 2. Ottieni un admin per approved_by
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);
    const approvedBy = admins?.[0]?.id || null;

    // 3. Inserisci permesso 23 feb - tutta la giornata (8h standard)
    const insertData = {
      user_id: MATTEO_USER_ID,
      type: 'permission',
      start_date: '2026-02-23',
      end_date: '2026-02-23',
      status: 'approved',
      permission_type: 'full_day',
      hours: 8,
      reason: 'Permesso - Tutta la giornata',
      notes: '[Creato dall\'admin] Spostato da 19/02',
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
      days_requested: 1
    };

    const { data: newPerm, error: insErr } = await supabase
      .from('leave_requests')
      .insert([insertData])
      .select('id, start_date, permission_type, hours, status')
      .single();

    if (insErr) {
      console.error('❌ Errore creazione permesso 23 feb:', insErr);
      return;
    }

    console.log('✅ Creato permesso 23 feb - tutta la giornata (8h)');
    console.log('   ID:', newPerm.id);
    console.log('   Data:', newPerm.start_date, '| Tipo:', newPerm.permission_type, '| Ore:', newPerm.hours);
    console.log('\n✅ Operazione completata.');
  } catch (err) {
    console.error('❌ Errore:', err);
  }
}

fix();
