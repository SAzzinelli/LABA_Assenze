#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateAttendanceForSimone() {
  try {
    console.log('🔍 Cercando Simone Azzinelli...');
    
    // Trova Simone
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', 'simone.azzinelli@labafirenze.com')
      .single();

    if (userError || !user) {
      console.error('❌ Utente non trovato:', userError?.message || 'Utente non trovato');
      return;
    }

    console.log(`✅ Utente trovato: ${user.first_name} ${user.last_name} (${user.email})`);

    // Crea orari di lavoro di default per Simone
    console.log('📅 Creando orari di lavoro di default...');
    const defaultWorkSchedules = [
      { day_of_week: 1, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Lunedì
      { day_of_week: 2, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Martedì
      { day_of_week: 3, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Mercoledì
      { day_of_week: 4, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Giovedì
      { day_of_week: 5, is_working_day: true, work_type: 'full_day', start_time: '09:00', end_time: '18:00', break_duration: 60 }, // Venerdì
      { day_of_week: 6, is_working_day: false, work_type: 'full_day', start_time: null, end_time: null, break_duration: 0 }, // Sabato
      { day_of_week: 0, is_working_day: false, work_type: 'full_day', start_time: null, end_time: null, break_duration: 0 }  // Domenica
    ];

    const schedulesWithUserId = defaultWorkSchedules.map(schedule => ({
      ...schedule,
      user_id: user.id
    }));

    // Elimina orari esistenti
    await supabase
      .from('work_schedules')
      .delete()
      .eq('user_id', user.id);

    // Inserisci nuovi orari
    const { error: schedulesError } = await supabase
      .from('work_schedules')
      .insert(schedulesWithUserId);

    if (schedulesError) {
      console.error('❌ Errore creazione orari:', schedulesError);
      return;
    }

    console.log('✅ Orari di lavoro creati con successo');

    // Genera presenza per oggi
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();
    
    console.log(`📊 Generando presenza per oggi (${today})...`);

    // Verifica se esiste già una presenza per oggi
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (existingAttendance) {
      console.log('⚠️  Presenza già esistente per oggi');
      return;
    }

    // Ottieni l'orario per oggi
    const { data: schedule } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', user.id)
      .eq('day_of_week', dayOfWeek)
      .eq('is_working_day', true)
      .single();

    if (!schedule) {
      console.log('⚠️  Nessun orario di lavoro per oggi (probabilmente weekend)');
      return;
    }

    // Calcola ore di lavoro
    const { start_time, end_time, break_duration } = schedule;
    const start = new Date(`2000-01-01T${start_time}`);
    const end = new Date(`2000-01-01T${end_time}`);
    const totalMinutes = (end - start) / (1000 * 60);
    const workMinutes = totalMinutes - (break_duration || 60);
    const workHours = workMinutes / 60;

    console.log(`⏰ Orario: ${start_time}-${end_time} (${workHours}h lavoro + ${break_duration}min pausa)`);

    // Crea la presenza
    const { data: newAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        user_id: user.id,
        date: today,
        status: 'present',
        expected_hours: workHours,
        actual_hours: workHours,
        balance_hours: 0,
        is_absent: false,
        is_overtime: false,
        is_early_departure: false,
        is_late_arrival: false,
        notes: `Presenza generata per orario ${start_time}-${end_time}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (attendanceError) {
      console.error('❌ Errore creazione presenza:', attendanceError);
      return;
    }

    console.log('✅ Presenza creata con successo');

    // Crea i dettagli della presenza
    const breakMinutes = break_duration || 60;
    const workMinutesTotal = totalMinutes - breakMinutes;
    const morningMinutes = Math.floor(workMinutesTotal / 2);
    const afternoonMinutes = workMinutesTotal - morningMinutes;
    
    const breakStart = new Date(start.getTime() + (morningMinutes * 60 * 1000));
    const breakEnd = new Date(breakStart.getTime() + (breakMinutes * 60 * 1000));
    
    const details = [
      {
        attendance_id: newAttendance.id,
        user_id: user.id,
        date: today,
        segment: 'morning',
        start_time: start_time,
        end_time: breakStart.toTimeString().substring(0, 5),
        status: 'completed',
        notes: 'Periodo mattutino completato'
      },
      {
        attendance_id: newAttendance.id,
        user_id: user.id,
        date: today,
        segment: 'lunch_break',
        start_time: breakStart.toTimeString().substring(0, 5),
        end_time: breakEnd.toTimeString().substring(0, 5),
        status: 'completed',
        notes: 'Pausa pranzo'
      },
      {
        attendance_id: newAttendance.id,
        user_id: user.id,
        date: today,
        segment: 'afternoon',
        start_time: breakEnd.toTimeString().substring(0, 5),
        end_time: end_time,
        status: 'completed',
        notes: 'Periodo pomeridiano completato'
      }
    ];

    const { error: detailsError } = await supabase
      .from('attendance_details')
      .insert(details);

    if (detailsError) {
      console.error('❌ Errore creazione dettagli:', detailsError);
    } else {
      console.log('✅ Dettagli presenza creati (mattina, pausa pranzo, pomeriggio)');
    }

    console.log('🎉 Operazione completata con successo!');
    console.log(`📊 Presenza generata per ${user.first_name} ${user.last_name} il ${today}`);
    console.log(`⏰ Orario: ${start_time}-${end_time} (${workHours}h)`);

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

generateAttendanceForSimone();
