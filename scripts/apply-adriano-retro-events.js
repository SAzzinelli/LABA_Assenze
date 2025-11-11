/**
 * Script per registrare eventi retroattivi (assenze/permessi) per Adriano Toccafondi.
 * - 2025-10-29: assenza intera giornata (8h di permesso)
 * - 2025-11-05: entrata posticipata di 1h
 * - 2025-11-06: entrata posticipata di 1h
 *
 * Aggiorna leave_requests e attendance per riflettere le ore effettive e il debito sul monte ore.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://gojhljczpwbjxbbrtrlq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_s7Vzh0AtPEaEv3f3VmkIEg_3ZqBhGsS';
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_EMAIL = 'adriano.toccafondi@labafirenze.com';
const ADMIN_EMAIL = 'hr@labafirenze.com';

const EVENTS = [
  {
    date: '2025-10-29',
    type: 'full_absence',
    hours: null, // verrà calcolato in base all'orario standard
    reason: 'Assenza per motivi familiari (Tribunale)',
    notes: 'Assenza intera giornata registrata retroattivamente (script 2025-11-10)',
    permissionType: 'hourly'
  },
  {
    date: '2025-11-05',
    type: 'late_entry',
    lateMinutes: 60,
    reason: 'Entrata posticipata per motivi familiari',
    notes: 'Entrata posticipata registrata retroattivamente (script 2025-11-10)',
    permissionType: 'late_entry'
  },
  {
    date: '2025-11-06',
    type: 'late_entry',
    lateMinutes: 60,
    reason: 'Entrata posticipata per motivi familiari',
    notes: 'Entrata posticipata registrata retroattivamente (script 2025-11-10)',
    permissionType: 'late_entry'
  }
];

function pad(value) {
  return value.toString().padStart(2, '0');
}

function addMinutesToTime(timeStr, minutesToAdd) {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${pad(newHours)}:${pad(newMinutes)}:00`;
}

async function ensureAdmin() {
  const { data: adminUser, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', ADMIN_EMAIL)
    .single();

  if (error || !adminUser) {
    throw new Error(`Impossibile trovare l'utente admin (${ADMIN_EMAIL}).`);
  }

  return adminUser.id;
}

async function fetchUserId() {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('email', TARGET_EMAIL)
    .single();

  if (error || !user) {
    throw new Error(`Impossibile trovare l'utente target (${TARGET_EMAIL}).`);
  }

  console.log(`👤 Target: ${user.first_name} ${user.last_name} (${user.id})`);
  return user.id;
}

async function fetchScheduleHours(userId, isoDate) {
  const dayOfWeek = new Date(isoDate).getDay(); // 0 domenica

  const { data: schedule, error } = await supabase
    .from('work_schedules')
    .select('start_time, end_time, break_duration, work_type, is_working_day')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (error || !schedule || !schedule.is_working_day || !schedule.start_time || !schedule.end_time) {
    throw new Error(`Nessun orario di lavoro valido trovato per il giorno ${isoDate}`);
  }

  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  const breakMinutes = schedule.break_duration || 60;
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const workMinutes = totalMinutes - breakMinutes;
  const workHours = workMinutes / 60;

  return {
    schedule,
    workHours: parseFloat(workHours.toFixed(2))
  };
}

async function upsertLeaveRequest({
  userId,
  adminId,
  isoDate,
  type,
  hours,
  permissionType,
  reason,
  notes,
  entryTime,
  exitTime
}) {
  const { data: existing, error: fetchError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('start_date', isoDate)
    .eq('end_date', isoDate)
    .eq('type', 'permission')
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Errore nel recupero leave_requests per ${isoDate}: ${fetchError.message}`);
  }

  const baseData = {
    user_id: userId,
    type: 'permission',
    start_date: isoDate,
    end_date: isoDate,
    reason,
    status: 'approved',
    submitted_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: adminId,
    days_requested: 1,
    permission_type: permissionType || null,
    notes,
    hours: hours !== null && hours !== undefined ? parseFloat(hours.toFixed(2)) : null,
    exit_time: exitTime || null,
    entry_time: entryTime || null
  };

  if (existing) {
    const { data: updated, error } = await supabase
      .from('leave_requests')
      .update(baseData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Errore nell'aggiornamento leave_request per ${isoDate}: ${error.message}`);
    }

    console.log(`  🔁 Leave request aggiornata (${updated.id})`);
    return updated.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('leave_requests')
    .insert([baseData])
    .select()
    .single();

  if (insertError) {
    throw new Error(`Errore nell'inserimento leave_request per ${isoDate}: ${insertError.message}`);
  }

  console.log(`  ✅ Leave request creata (${inserted.id})`);
  return inserted.id;
}

async function updateAttendance({
  userId,
  isoDate,
  workHours,
  deficitHours,
  leaveRequestId,
  event
}) {
  const { data: existing, error: fetchError } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('date', isoDate)
    .maybeSingle();

  const actualHours = Math.max(0, workHours - deficitHours);
  const balanceHours = actualHours - workHours;

  const payload = {
    user_id: userId,
    date: isoDate,
    expected_hours: parseFloat(workHours.toFixed(2)),
    actual_hours: parseFloat(actualHours.toFixed(2)),
    balance_hours: parseFloat(balanceHours.toFixed(2)),
    leave_request_id: leaveRequestId,
    notes: `[Script retroattivo] ${event.notes}`,
    is_absent: actualHours === 0,
    absence_reason: actualHours === 0 ? event.reason : null,
    is_late_arrival: event.type === 'late_entry',
    is_early_departure: event.type === 'early_exit' || false
  };

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Errore nel recupero attendance per ${isoDate}: ${fetchError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('attendance')
      .update(payload)
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Errore nell'aggiornamento attendance per ${isoDate}: ${updateError.message}`);
    }
    console.log(`  🔁 Attendance aggiornata (${existing.id}): expected=${payload.expected_hours}, actual=${payload.actual_hours}, balance=${payload.balance_hours}`);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('attendance')
      .insert([payload])
      .select()
      .single();

    if (insertError) {
      throw new Error(`Errore nell'inserimento attendance per ${isoDate}: ${insertError.message}`);
    }
    console.log(`  ✅ Attendance creata (${inserted.id}) con expected=${payload.expected_hours}, actual=${payload.actual_hours}, balance=${payload.balance_hours}`);
  }
}

async function applyEvents() {
  console.log('🚀 Avvio script eventi retroattivi per Adriano Toccafondi');

  try {
    const adminId = await ensureAdmin();
    const userId = await fetchUserId();

    for (const event of EVENTS) {
      console.log(`\n📅 Elaborazione ${event.date} (${event.type})`);

      const { schedule, workHours } = await fetchScheduleHours(userId, event.date);

      let deficitHours = 0;
      let entryTime = null;
      let exitTime = null;

      if (event.type === 'full_absence') {
        deficitHours = workHours;
      } else if (event.type === 'late_entry') {
        const lateHours = (event.lateMinutes || 0) / 60;
        deficitHours = lateHours;
        const baseStart = schedule.start_time.includes(':')
          ? `${schedule.start_time}:00`.slice(0, 8)
          : schedule.start_time;
        entryTime = addMinutesToTime(baseStart, event.lateMinutes || 0);
      } else if (event.type === 'early_exit') {
        const earlyHours = (event.earlyMinutes || 0) / 60;
        deficitHours = earlyHours;
        const baseEnd = schedule.end_time.includes(':')
          ? `${schedule.end_time}:00`.slice(0, 8)
          : schedule.end_time;
        exitTime = addMinutesToTime(baseEnd, -(event.earlyMinutes || 0));
      }

      const leaveRequestId = await upsertLeaveRequest({
        userId,
        adminId,
        isoDate: event.date,
        type: event.type,
        hours: deficitHours,
        permissionType: event.permissionType,
        reason: event.reason,
        notes: event.notes,
        entryTime,
        exitTime
      });

      await updateAttendance({
        userId,
        isoDate: event.date,
        workHours,
        deficitHours,
        leaveRequestId,
        event
      });
    }

    console.log('\n✅ Aggiornamenti completati con successo');
  } catch (error) {
    console.error('❌ Errore durante l\'esecuzione dello script:', error);
    process.exit(1);
  }

  process.exit(0);
}

applyEvents();

