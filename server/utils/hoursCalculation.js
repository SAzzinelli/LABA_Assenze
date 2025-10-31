// Server-side mirror of client hoursCalculation (subset used by backend)
// Keep logic aligned with client/src/utils/hoursCalculation.js

const CONTRACT_TYPES = {
  full_time: { defaultWeeklyHours: 40, defaultDailyHours: 8 },
  part_time_horizontal: { defaultWeeklyHours: 20, defaultDailyHours: 4 },
  part_time_vertical: { defaultWeeklyHours: 20, defaultDailyHours: 8 },
  apprenticeship: { defaultWeeklyHours: 40, defaultDailyHours: 8 },
  cococo: { defaultWeeklyHours: 0, defaultDailyHours: 0 },
  internship: { defaultWeeklyHours: 0, defaultDailyHours: 0 }
};

function calculateWeeklyHours(workPattern) {
  if (!workPattern) return 0;
  const { monday=0, tuesday=0, wednesday=0, thursday=0, friday=0, saturday=0, sunday=0 } = workPattern;
  return monday + tuesday + wednesday + thursday + friday + saturday + sunday;
}

function getDailyHoursForDay(workPattern, dayOfWeek) {
  const dayMap = { 0:'sunday',1:'monday',2:'tuesday',3:'wednesday',4:'thursday',5:'friday',6:'saturday' };
  return (workPattern && workPattern[dayMap[dayOfWeek]]) || 0;
}

function formatHours(hours) {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes === 0 ? `${whole}h` : `${whole}h ${minutes}m`;
}

// Expected hours from a work_schedules row
function calculateExpectedHoursForSchedule(schedule) {
  if (!schedule || !schedule.start_time || !schedule.end_time) return 0;
  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  const breakDuration = schedule.break_duration || 60; // minutes
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const workMinutes = totalMinutes - breakDuration;
  return workMinutes / 60;
}

/**
 * FUNZIONE CENTRALIZZATA per calcolare le ore effettive real-time
 * Questa funzione deve essere usata ovunque per garantire coerenza
 * 
 * @param {Object} schedule - Lo schedule di lavoro con start_time, end_time, break_duration, break_start_time
 * @param {Date|string} currentTime - Il tempo corrente (Date object o string 'HH:MM')
 * @param {Object} permissionData - Opzionale: dati permessi (early_exit/late_entry) con exit_time/entry_time
 * @returns {Object} { actualHours, expectedHours, balanceHours, status }
 */
function calculateRealTimeHours(schedule, currentTime, permissionData = null) {
  if (!schedule || !schedule.start_time || !schedule.end_time) {
    return { actualHours: 0, expectedHours: 0, balanceHours: 0, status: 'not_started' };
  }

  const { start_time, end_time, break_duration, break_start_time } = schedule;
  
  // Converti currentTime in Date object se è string
  let now;
  if (typeof currentTime === 'string') {
    const [hour, minute] = currentTime.split(':').map(Number);
    now = new Date();
    now.setHours(hour, minute, 0, 0);
  } else {
    now = new Date(currentTime);
  }
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  // Calcola ore attese (ORE CONTRATTUALI - sempre fisse!)
  const expectedHours = calculateExpectedHoursForSchedule({ start_time, end_time, break_duration });
  
  // Calcola orari effettivi considerando i permessi
  let effectiveStartTime = start_time;
  let effectiveEndTime = end_time;
  
  // PERMESSO USCITA ANTICIPATA: crea debito, non riduce expectedHours
  if (permissionData?.permission_type === 'early_exit' && permissionData.exit_time) {
    effectiveEndTime = permissionData.exit_time;
  }
  
  // PERMESSO ENTRATA POSTICIPATA: crea debito, non riduce expectedHours
  if (permissionData?.permission_type === 'late_entry' && permissionData.entry_time) {
    effectiveStartTime = permissionData.entry_time;
  }
  
  // Calcola ore effettive basate sull'orario corrente
  let actualHours = 0;
  let status = 'not_started';
  
  const [startHour, startMin] = effectiveStartTime.split(':').map(Number);
  const [endHour, endMin] = effectiveEndTime.split(':').map(Number);
  
  const effectiveStartTimeObj = new Date(`2000-01-01T${effectiveStartTime}`);
  const effectiveEndTimeObj = new Date(`2000-01-01T${effectiveEndTime}`);
  const currentTimeObj = new Date(`2000-01-01T${currentTimeStr}`);
  
  if (currentTimeObj >= effectiveStartTimeObj) {
    if (currentTimeObj <= effectiveEndTimeObj) {
      // Durante l'orario di lavoro
      
      // Calcola pausa pranzo dallo schedule o usa default
      let breakStartTimeStr, breakEndTimeStr;
      if (break_start_time) {
        // Usa break_start_time configurato
        const [breakStartHour, breakStartMin] = break_start_time.split(':').map(Number);
        breakStartTimeStr = break_start_time;
        const breakEndTimeMinutes = (breakStartHour * 60 + breakStartMin) + (break_duration || 60);
        const breakEndHour = Math.floor(breakEndTimeMinutes / 60);
        const breakEndMin = breakEndTimeMinutes % 60;
        breakEndTimeStr = `${breakEndHour.toString().padStart(2, '0')}:${breakEndMin.toString().padStart(2, '0')}`;
      } else {
        // Calcola pausa pranzo come metà dell'orario meno metà della durata
        const [startHourCalc, startMinCalc] = effectiveStartTime.split(':').map(Number);
        const [endHourCalc, endMinCalc] = effectiveEndTime.split(':').map(Number);
        const breakDurationMins = break_duration || 60;
        
        const startTotalMinutes = startHourCalc * 60 + startMinCalc;
        const endTotalMinutes = endHourCalc * 60 + endMinCalc;
        const totalMinutes = endTotalMinutes - startTotalMinutes;
        
        // Pausa pranzo a metà dell'orario
        const halfPointMinutes = startTotalMinutes + (totalMinutes / 2);
        const breakStartMinutes = halfPointMinutes - (breakDurationMins / 2);
        const breakEndMinutes = breakStartMinutes + breakDurationMins;
        
        const breakStartHour = Math.floor(breakStartMinutes / 60) % 24;
        const breakStartMin = Math.floor(breakStartMinutes % 60);
        const breakEndHour = Math.floor(breakEndMinutes / 60) % 24;
        const breakEndMin = Math.floor(breakEndMinutes % 60);
        
        breakStartTimeStr = `${breakStartHour.toString().padStart(2, '0')}:${breakStartMin.toString().padStart(2, '0')}`;
        breakEndTimeStr = `${breakEndHour.toString().padStart(2, '0')}:${breakEndMin.toString().padStart(2, '0')}`;
      }
      
      const breakStartTime = new Date(`2000-01-01T${breakStartTimeStr}`);
      const breakEndTime = new Date(`2000-01-01T${breakEndTimeStr}`);
      
      if (currentTimeObj >= breakStartTime && currentTimeObj < breakEndTime) {
        // Durante la pausa pranzo
        actualHours = (breakStartTime - effectiveStartTimeObj) / (1000 * 60) / 60;
        status = 'on_break';
      } else if (currentTimeObj >= breakEndTime) {
        // Dopo la pausa pranzo
        const morningMinutes = (breakStartTime - effectiveStartTimeObj) / (1000 * 60);
        const afternoonMinutes = (currentTimeObj - breakEndTime) / (1000 * 60);
        actualHours = (morningMinutes + afternoonMinutes) / 60;
        status = 'working';
      } else {
        // Prima della pausa pranzo
        const workedMinutes = (currentTimeObj - effectiveStartTimeObj) / (1000 * 60);
        actualHours = workedMinutes / 60;
        status = 'working';
      }
    } else {
      // Dopo l'orario effettivo: calcola le ore REALMENTE lavorate (non expectedHours!)
      const effectiveWorkMinutes = (effectiveEndTimeObj - effectiveStartTimeObj) / (1000 * 60) - (break_duration || 60);
      actualHours = effectiveWorkMinutes / 60;
      status = 'completed';
    }
  }

  // Calcola saldo ore
  const balanceHours = actualHours - expectedHours;
  
  return {
    actualHours: Math.round(actualHours * 10) / 10,
    expectedHours: Math.round(expectedHours * 10) / 10,
    balanceHours: Math.round(balanceHours * 10) / 10,
    status
  };
}

module.exports = {
  CONTRACT_TYPES,
  calculateWeeklyHours,
  getDailyHoursForDay,
  formatHours,
  calculateExpectedHoursForSchedule,
  calculateRealTimeHours, // NUOVA FUNZIONE CENTRALIZZATA
};


