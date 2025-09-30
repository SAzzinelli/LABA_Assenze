#!/usr/bin/env node

/**
 * Script per applicare le modifiche al database per il nuovo sistema senza timbratura
 * Sistema monte ore con punto zero
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variabili SUPABASE_URL e SUPABASE_ANON_KEY non trovate');
  console.log('📝 Assicurati di avere un file .env con:');
  console.log('SUPABASE_URL=your_supabase_url');
  console.log('SUPABASE_ANON_KEY=your_supabase_key');
  console.log('\n💡 Oppure esporta le variabili:');
  console.log('export SUPABASE_URL=your_url');
  console.log('export SUPABASE_ANON_KEY=your_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyDatabaseChanges() {
  console.log('🚀 Inizio applicazione modifiche database...\n');

  try {
    // 1. Rimuovi colonne di timbratura dalla tabella attendance
    console.log('1️⃣ Rimozione colonne di timbratura...');
    
    const dropColumns = [
      'ALTER TABLE attendance DROP COLUMN IF EXISTS clock_in;',
      'ALTER TABLE attendance DROP COLUMN IF EXISTS clock_out;',
      'ALTER TABLE attendance DROP COLUMN IF EXISTS break_start;',
      'ALTER TABLE attendance DROP COLUMN IF EXISTS break_end;'
    ];

    for (const sql of dropColumns) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.log(`⚠️  ${sql} - ${error.message}`);
      } else {
        console.log(`✅ ${sql}`);
      }
    }

    // 2. Aggiungi nuove colonne per il sistema monte ore
    console.log('\n2️⃣ Aggiunta nuove colonne per sistema monte ore...');
    
    const addColumns = [
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS expected_hours DECIMAL(4,2) DEFAULT 8.0;',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(4,2) DEFAULT 8.0;',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS balance_hours DECIMAL(4,2) DEFAULT 0.0;',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_absent BOOLEAN DEFAULT FALSE;',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS absence_reason VARCHAR(100);',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES leave_requests(id);',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT;',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT FALSE;',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_early_departure BOOLEAN DEFAULT FALSE;',
      'ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_late_arrival BOOLEAN DEFAULT FALSE;'
    ];

    for (const sql of addColumns) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.log(`⚠️  ${sql} - ${error.message}`);
      } else {
        console.log(`✅ ${sql}`);
      }
    }

    // 3. Crea tabella work_schedules
    console.log('\n3️⃣ Creazione tabella work_schedules...');
    
    const createWorkSchedules = `
      CREATE TABLE IF NOT EXISTS work_schedules (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        is_working_day BOOLEAN DEFAULT TRUE,
        work_type VARCHAR(20) DEFAULT 'full_day',
        start_time TIME,
        end_time TIME,
        break_duration INTEGER DEFAULT 60,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, day_of_week)
      );
    `;

    const { error: workSchedulesError } = await supabase.rpc('exec_sql', { sql: createWorkSchedules });
    if (workSchedulesError) {
      console.log(`⚠️  Creazione work_schedules - ${workSchedulesError.message}`);
    } else {
      console.log('✅ Tabella work_schedules creata');
    }

    // 4. Crea tabella hours_balance
    console.log('\n4️⃣ Creazione tabella hours_balance...');
    
    const createHoursBalance = `
      CREATE TABLE IF NOT EXISTS hours_balance (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
        total_balance DECIMAL(6,2) DEFAULT 0.0,
        overtime_hours DECIMAL(5,2) DEFAULT 0.0,
        deficit_hours DECIMAL(5,2) DEFAULT 0.0,
        working_days INTEGER DEFAULT 0,
        absent_days INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, year, month)
      );
    `;

    const { error: hoursBalanceError } = await supabase.rpc('exec_sql', { sql: createHoursBalance });
    if (hoursBalanceError) {
      console.log(`⚠️  Creazione hours_balance - ${hoursBalanceError.message}`);
    } else {
      console.log('✅ Tabella hours_balance creata');
    }

    // 5. Crea indici
    console.log('\n5️⃣ Creazione indici...');
    
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_work_schedules_user ON work_schedules(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_work_schedules_day ON work_schedules(day_of_week);',
      'CREATE INDEX IF NOT EXISTS idx_hours_balance_user_year_month ON hours_balance(user_id, year, month);',
      'CREATE INDEX IF NOT EXISTS idx_hours_balance_year_month ON hours_balance(year, month);',
      'CREATE INDEX IF NOT EXISTS idx_attendance_balance_hours ON attendance(balance_hours);',
      'CREATE INDEX IF NOT EXISTS idx_attendance_is_absent ON attendance(is_absent);'
    ];

    for (const sql of createIndexes) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.log(`⚠️  ${sql} - ${error.message}`);
      } else {
        console.log(`✅ ${sql}`);
      }
    }

    // 6. Inserisci orari di lavoro di default per tutti i dipendenti
    console.log('\n6️⃣ Creazione orari di lavoro di default...');
    
    const { data: employees } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'employee')
      .eq('is_active', true);

    if (employees && employees.length > 0) {
      const defaultSchedules = [];
      
      // Orario standard: Lun-Ven 9:00-18:00 con 1h pausa pranzo
      for (const employee of employees) {
        for (let day = 1; day <= 5; day++) { // Lunedi = 1, Venerdi = 5
          defaultSchedules.push({
            user_id: employee.id,
            day_of_week: day,
            is_working_day: true,
            work_type: 'full_day',
            start_time: '09:00',
            end_time: '18:00',
            break_duration: 60
          });
        }
        // Sabato e Domenica non lavorativi
        for (let day = 0; day <= 6; day += 6) { // Domenica = 0, Sabato = 6
          defaultSchedules.push({
            user_id: employee.id,
            day_of_week: day,
            is_working_day: false,
            work_type: 'full_day',
            start_time: null,
            end_time: null,
            break_duration: 0
          });
        }
      }

      const { error: schedulesError } = await supabase
        .from('work_schedules')
        .insert(defaultSchedules);

      if (schedulesError) {
        console.log(`⚠️  Inserimento orari default - ${schedulesError.message}`);
      } else {
        console.log(`✅ Orari di lavoro di default creati per ${employees.length} dipendenti`);
      }
    }

    // 7. Aggiorna record di presenza esistenti
    console.log('\n7️⃣ Aggiornamento record di presenza esistenti...');
    
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id, user_id, date');

    if (existingAttendance && existingAttendance.length > 0) {
      for (const record of existingAttendance) {
        // Calcola ore attese per questo giorno
        const { data: schedule } = await supabase
          .from('work_schedules')
          .select('start_time, end_time, break_duration')
          .eq('user_id', record.user_id)
          .eq('day_of_week', new Date(record.date).getDay())
          .eq('is_working_day', true)
          .single();

        let expectedHours = 0;
        if (schedule && schedule.start_time && schedule.end_time) {
          const startTime = new Date(`2000-01-01 ${schedule.start_time}`);
          const endTime = new Date(`2000-01-01 ${schedule.end_time}`);
          const totalMinutes = (endTime - startTime) / (1000 * 60);
          expectedHours = (totalMinutes - schedule.break_duration) / 60;
        }

        // Aggiorna il record
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            expected_hours: expectedHours,
            actual_hours: expectedHours, // Di default uguale alle ore attese
            balance_hours: 0, // Saldo iniziale = 0
            is_absent: false,
            status: expectedHours > 0 ? 'present' : 'non_working_day'
          })
          .eq('id', record.id);

        if (updateError) {
          console.log(`⚠️  Aggiornamento record ${record.id} - ${updateError.message}`);
        }
      }
      console.log(`✅ ${existingAttendance.length} record di presenza aggiornati`);
    }

    console.log('\n🎉 Modifiche database applicate con successo!');
    console.log('\n📋 Prossimi passi:');
    console.log('1. Aggiorna il frontend per il nuovo sistema');
    console.log('2. Testa il sistema con dati reali');
    console.log('3. Configura orari personalizzati per dipendenti specifici');

  } catch (error) {
    console.error('❌ Errore durante l\'applicazione delle modifiche:', error);
    process.exit(1);
  }
}

// Esegui lo script
applyDatabaseChanges();
