#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAttendanceTable() {
  try {
    console.log('🔧 Creando tabella attendance con struttura corretta...');

    // Prima elimina la tabella esistente se c'è
    console.log('🗑️  Eliminando tabella attendance esistente...');
    await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS attendance CASCADE;'
    });

    // Crea la tabella con la struttura corretta
    console.log('📋 Creando nuova tabella attendance...');
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE attendance (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          status VARCHAR(20) DEFAULT 'present',
          expected_hours DECIMAL(4,2) DEFAULT 0,
          actual_hours DECIMAL(4,2) DEFAULT 0,
          balance_hours DECIMAL(4,2) DEFAULT 0,
          clock_in TIMESTAMP WITH TIME ZONE,
          clock_out TIMESTAMP WITH TIME ZONE,
          hours_worked DECIMAL(4,2),
          is_absent BOOLEAN DEFAULT FALSE,
          is_overtime BOOLEAN DEFAULT FALSE,
          is_early_departure BOOLEAN DEFAULT FALSE,
          is_late_arrival BOOLEAN DEFAULT FALSE,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, date)
        );
      `
    });

    if (createError) {
      console.error('❌ Errore creazione tabella:', createError);
      return;
    }

    console.log('✅ Tabella attendance creata con successo!');

    // Crea indici per performance
    console.log('📊 Creando indici...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
        CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
        CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
        CREATE INDEX IF NOT EXISTS idx_attendance_is_absent ON attendance(is_absent);
      `
    });

    if (indexError) {
      console.error('⚠️  Errore creazione indici:', indexError);
    } else {
      console.log('✅ Indici creati con successo!');
    }

    // Crea anche la tabella attendance_details
    console.log('📋 Creando tabella attendance_details...');
    const { error: detailsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS attendance_details (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date DATE NOT NULL,
          segment TEXT NOT NULL,
          start_time TIME,
          end_time TIME,
          status TEXT DEFAULT 'present' NOT NULL,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT unique_attendance_segment UNIQUE (attendance_id, segment),
          CONSTRAINT valid_segment CHECK (segment IN ('morning', 'lunch_break', 'afternoon'))
        );
      `
    });

    if (detailsError) {
      console.error('❌ Errore creazione tabella attendance_details:', detailsError);
    } else {
      console.log('✅ Tabella attendance_details creata con successo!');
    }

    console.log('🎉 Setup completato! Ora puoi generare le presenze.');

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

createAttendanceTable();
