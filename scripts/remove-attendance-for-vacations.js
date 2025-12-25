/**
 * Script per eliminare le presenze esistenti per i giorni con ferie approvate
 * Le ferie non sono presenze, sono giorni di assenza giustificata
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function removeAttendanceForVacations() {
  try {
    console.log('🚀 Inizio rimozione presenze per giorni di ferie...\n');

    // 1. Recupera tutte le richieste di ferie approvate
    console.log('📋 Recupero richieste di ferie approvate...');
    const { data: vacations, error: vacationsError } = await supabase
      .from('leave_requests')
      .select('id, user_id, start_date, end_date, status, type')
      .eq('type', 'vacation')
      .eq('status', 'approved')
      .order('start_date');

    if (vacationsError) {
      console.error('❌ Errore nel recupero ferie:', vacationsError);
      return;
    }

    if (!vacations || vacations.length === 0) {
      console.log('⚠️ Nessuna richiesta di ferie approvata trovata');
      return;
    }

    console.log(`✅ Trovate ${vacations.length} richieste di ferie approvate\n`);

    let totalDeleted = 0;
    const errors = [];

    // 2. Per ogni richiesta di ferie, elimina le presenze per quei giorni
    for (const vacation of vacations) {
      const start = new Date(vacation.start_date);
      const end = new Date(vacation.end_date);
      const vacationDates = [];
      
      // Genera array di date per il periodo di ferie
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        vacationDates.push(d.toISOString().split('T')[0]);
      }

      console.log(`🔄 Processando ferie per utente ${vacation.user_id} dal ${vacation.start_date} al ${vacation.end_date} (${vacationDates.length} giorni)...`);

      // Elimina tutte le presenze per questi giorni
      for (const dateStr of vacationDates) {
        const { error: deleteError } = await supabase
          .from('attendance')
          .delete()
          .eq('user_id', vacation.user_id)
          .eq('date', dateStr);

        if (deleteError) {
          console.error(`   ❌ Errore eliminazione presenza per ${dateStr}:`, deleteError);
          errors.push({ vacation: vacation.id, date: dateStr, error: deleteError.message });
        } else {
          console.log(`   ✅ Presenza eliminata per ${dateStr}`);
          totalDeleted++;
        }
      }
    }

    // 3. Riepilogo finale
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO');
    console.log('='.repeat(60));
    console.log(`✅ Presenze eliminate: ${totalDeleted}`);
    console.log(`❌ Errori: ${errors.length}`);
    console.log(`📋 Totale richieste ferie processate: ${vacations.length}`);

    if (errors.length > 0) {
      console.log('\n⚠️  ERRORI DETTAGLIATI:');
      errors.forEach(({ vacation, date, error }) => {
        console.log(`   - Ferie ${vacation}, data ${date}: ${error}`);
      });
    }

    console.log('\n✨ Operazione completata!\n');

  } catch (error) {
    console.error('❌ Errore fatale:', error);
    process.exit(1);
  }
}

// Esegui lo script
removeAttendanceForVacations()
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore nello script:', error);
    process.exit(1);
  });

