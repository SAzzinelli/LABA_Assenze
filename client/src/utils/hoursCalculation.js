/**
 * UTILITY PER CALCOLI BASATI SU ORE
 * Implementa le linee guida per gestione contratti, ferie, permessi, monte ore e trasferte
 */

// =====================================================
// 1. TIPI DI CONTRATTO E CONFIGURAZIONI
// =====================================================

export const CONTRACT_TYPES = {
  FULL_TIME: {
    name: 'full_time',
    description: 'Tempo pieno indeterminato',
    annualVacationDays: 30, // 30 giorni ferie per tutti i dipendenti
    annualPermissionDays: 13, // giorni permessi annui
    maxCarryoverDays: 13, // max giorni riportabili anno successivo
    defaultWeeklyHours: 40,
    defaultDailyHours: 8
  },
  PART_TIME_HORIZONTAL: {
    name: 'part_time_horizontal',
    description: 'Part-time orizzontale',
    annualVacationDays: 13, // giorni ferie annue
    annualPermissionDays: 6.5, // giorni permessi annui
    maxCarryoverDays: 6.5, // max giorni riportabili anno successivo
    defaultWeeklyHours: 20,
    defaultDailyHours: 4
  },
  PART_TIME_VERTICAL: {
    name: 'part_time_vertical',
    description: 'Part-time verticale',
    annualVacationDays: 13, // giorni ferie annue
    annualPermissionDays: 6.5, // giorni permessi annui
    maxCarryoverDays: 6.5, // max giorni riportabili anno successivo
    defaultWeeklyHours: 20,
    defaultDailyHours: 8 // stessi orari del FT ma meno giorni
  },
  APPRENTICESHIP: {
    name: 'apprenticeship',
    description: 'Apprendistato',
    annualVacationDays: 30, // 30 giorni ferie per tutti i dipendenti
    annualPermissionDays: 13, // giorni permessi annui
    maxCarryoverDays: 13, // max giorni riportabili anno successivo
    defaultWeeklyHours: 40,
    defaultDailyHours: 8,
    hasTrainingHours: true,
    trainingHoursPerMonth: 8
  },
  COCOCO: {
    name: 'cococo',
    description: 'Collaborazione coordinata e continuativa',
    annualVacationDays: 0, // giorni ferie annue
    annualPermissionDays: 0, // giorni permessi annui
    maxCarryoverDays: 0, // max giorni riportabili anno successivo
    defaultWeeklyHours: 0,
    defaultDailyHours: 0
  },
  INTERNSHIP: {
    name: 'internship',
    description: 'Tirocinio',
    annualVacationDays: 0, // giorni ferie annue
    annualPermissionDays: 0, // giorni permessi annui
    maxCarryoverDays: 0, // max giorni riportabili anno successivo
    defaultWeeklyHours: 0,
    defaultDailyHours: 0
  }
};

// =====================================================
// 2. CALCOLI PATTERN DI LAVORO
// =====================================================

/**
 * Calcola le ore settimanali totali da un pattern di lavoro
 */
export function calculateWeeklyHours(workPattern) {
  const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = workPattern;
  return monday + tuesday + wednesday + thursday + friday + saturday + sunday;
}

/**
 * Calcola le ore giornaliere medie da un pattern di lavoro
 */
export function calculateDailyHours(workPattern) {
  const weeklyHours = calculateWeeklyHours(workPattern);
  const workingDays = [workPattern.monday, workPattern.tuesday, workPattern.wednesday,
  workPattern.thursday, workPattern.friday, workPattern.saturday, workPattern.sunday]
    .filter(hours => hours > 0).length;

  return workingDays > 0 ? weeklyHours / workingDays : 0;
}

/**
 * Calcola le ore ferie annuali basate sui giorni e sull'orario del dipendente
 */
export function calculateAnnualVacationHours(contractType, workPattern) {
  const contract = CONTRACT_TYPES[contractType.toUpperCase()];
  if (!contract || !contract.annualVacationDays) return 0;

  const dailyHours = calculateDailyHours(workPattern);
  return contract.annualVacationDays * dailyHours;
}

/**
 * Calcola le ore permessi annuali basate sui giorni e sull'orario del dipendente
 */
export function calculateAnnualPermissionHours(contractType, workPattern) {
  const contract = CONTRACT_TYPES[contractType.toUpperCase()];
  if (!contract || !contract.annualPermissionDays) return 0;

  const dailyHours = calculateDailyHours(workPattern);
  return contract.annualPermissionDays * dailyHours;
}

/**
 * Calcola le ore massime riportabili basate sui giorni e sull'orario del dipendente
 */
export function calculateMaxCarryoverHours(contractType, workPattern) {
  const contract = CONTRACT_TYPES[contractType.toUpperCase()];
  if (!contract || !contract.maxCarryoverDays) return 0;

  const dailyHours = calculateDailyHours(workPattern);
  return contract.maxCarryoverDays * dailyHours;
}

/**
 * Calcola le ore mensili da un pattern di lavoro
 */
export function calculateMonthlyHours(workPattern) {
  return calculateWeeklyHours(workPattern) * 4.33; // 4.33 settimane al mese
}

/**
 * Calcola le ore per un giorno specifico della settimana
 */
export function getDailyHoursForDay(workPattern, dayOfWeek) {
  const dayMap = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  };

  return workPattern[dayMap[dayOfWeek]] || 0;
}

/**
 * Calcola le ore ferie per un giorno specifico
 */
export function calculateVacationHoursForDay(workPattern, date) {
  const dayOfWeek = new Date(date).getDay();
  return getDailyHoursForDay(workPattern, dayOfWeek);
}

// =====================================================
// 3. CALCOLI MATURAZIONE MENSILE
// =====================================================

/**
 * Calcola le ore di maturazione mensile per ferie
 */
export function calculateMonthlyVacationAccrual(workPattern, contractType) {
  const monthlyHours = calculateMonthlyHours(workPattern);
  const contractConfig = CONTRACT_TYPES[contractType.toUpperCase()];

  if (!contractConfig) return 0;

  // Proporzionale alle ore mensili del pattern rispetto al full-time
  const fullTimeMonthlyHours = 40 * 4.33; // 173.33 ore mensili FT
  const ratio = monthlyHours / fullTimeMonthlyHours;

  return (contractConfig.annualVacationHours / 12) * ratio;
}

/**
 * Calcola le ore di maturazione mensile per permessi ROL
 */
export function calculateMonthlyPermissionAccrual(workPattern, contractType) {
  const monthlyHours = calculateMonthlyHours(workPattern);
  const contractConfig = CONTRACT_TYPES[contractType.toUpperCase()];

  if (!contractConfig) return 0;

  const fullTimeMonthlyHours = 40 * 4.33;
  const ratio = monthlyHours / fullTimeMonthlyHours;

  return (contractConfig.annualPermissionHours / 12) * ratio;
}

// =====================================================
// 4. GESTIONE MONTE ORE E STRAORDINARI
// =====================================================

/**
 * Calcola se le ore lavorate generano straordinari da mettere in monte ore
 */
export function calculateOvertimeHours(workPattern, date, hoursWorked) {
  const expectedHours = getDailyHoursForDay(workPattern, new Date(date).getDay());
  return Math.max(0, hoursWorked - expectedHours);
}

/**
 * Verifica se si può utilizzare ore dal monte ore
 */
export function canUseOvertimeHours(currentBalance, requestedHours) {
  return currentBalance >= requestedHours;
}

// =====================================================
// 5. GESTIONE TRASFERTE E VIAGGI
// =====================================================

/**
 * Calcola le ore totali di una trasferta
 */
export function calculateBusinessTripHours(tripData) {
  const { travelHours, eventHours, waitingHours } = tripData;
  return travelHours + eventHours + waitingHours;
}

/**
 * Determina se una trasferta genera ore aggiuntive per il monte ore
 */
export function calculateBusinessTripOvertime(workPattern, tripData, tripDate) {
  const expectedDailyHours = getDailyHoursForDay(workPattern, new Date(tripDate).getDay());
  const totalTripHours = calculateBusinessTripHours(tripData);

  return Math.max(0, totalTripHours - expectedDailyHours);
}

/**
 * Applica policy per ore di viaggio
 */
export function applyTravelPolicy(travelHours, policy) {
  switch (policy) {
    case 'full_travel':
      return travelHours;
    case 'excess_travel':
      // Solo la parte oltre il normale tragitto casa-sede
      return Math.max(0, travelHours - 1); // Assumendo 1h tragitto normale
    case 'none':
      return 0;
    default:
      return travelHours;
  }
}

// =====================================================
// 6. CALCOLI PRO-RATA PER INGRESSI/USCITE
// =====================================================

/**
 * Calcola maturazione pro-rata per ingresso a metà mese
 */
export function calculateProRataAccrual(contractType, startDate, endDate = null) {
  const contractConfig = CONTRACT_TYPES[contractType.toUpperCase()];
  if (!contractConfig) return 0;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  // Calcola giorni lavorati nel mese
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = endDate ?
    new Date(end.getFullYear(), end.getMonth() + 1, 0) :
    new Date(start.getFullYear(), start.getMonth() + 1, 0);

  const workingDaysInMonth = getWorkingDaysInMonth(start.getFullYear(), start.getMonth());
  const workingDaysWorked = getWorkingDaysBetween(start, end);

  const ratio = workingDaysWorked / workingDaysInMonth;

  return {
    vacationHours: (contractConfig.annualVacationHours / 12) * ratio,
    permissionHours: (contractConfig.annualPermissionHours / 12) * ratio
  };
}

/**
 * Conta i giorni lavorativi in un mese (esclude weekend)
 */
function getWorkingDaysInMonth(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let workingDays = 0;

  for (let day = firstDay; day <= lastDay; day.setDate(day.getDate() + 1)) {
    const dayOfWeek = day.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Non domenica e non sabato
      workingDays++;
    }
  }

  return workingDays;
}

/**
 * Conta i giorni lavorativi tra due date
 */
function getWorkingDaysBetween(startDate, endDate) {
  let workingDays = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

// =====================================================
// 7. VALIDAZIONI E CONTROLLI
// =====================================================

/**
 * Verifica se si può richiedere ferie
 */
export function canRequestVacation(currentBalance, requestedHours, maxCarryover) {
  return currentBalance >= requestedHours &&
    (currentBalance - requestedHours) <= maxCarryover;
}

/**
 * Verifica se si può richiedere permessi
 */
export function canRequestPermission(currentBalance, requestedHours) {
  return currentBalance >= requestedHours;
}

/**
 * Calcola ore rimanenti dopo una richiesta
 */
export function calculateRemainingHours(currentBalance, requestedHours) {
  return Math.max(0, currentBalance - requestedHours);
}

// =====================================================
// 8. UTILITY PER CONVERSIONI
// =====================================================

/**
 * Converte ore in giorni (basato su pattern di lavoro)
 */
export function hoursToDays(hours, workPattern) {
  const averageDailyHours = calculateWeeklyHours(workPattern) / 5; // Assumendo 5 giorni lavorativi
  return hours / averageDailyHours;
}

/**
 * Converte giorni in ore (basato su pattern di lavoro)
 */
export function daysToHours(days, workPattern) {
  const averageDailyHours = calculateWeeklyHours(workPattern) / 5;
  return days * averageDailyHours;
}

/**
 * Formatta ore in formato leggibile (es. "8h 30min" o "0h 30min")
 * Sempre mostra ore e minuti separati, anche per valori decimali (es. 0.5h -> "0h 30min")
 */
export function formatHours(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) {
    return '0h';
  }

  const wholeHours = Math.floor(Math.abs(hours));
  const minutes = Math.round((Math.abs(hours) - wholeHours) * 60);
  const sign = hours < 0 ? '-' : '';

  // Se ci sono minuti, mostra sempre le ore (anche se 0)
  if (minutes > 0) {
    return `${sign}${wholeHours}h ${minutes}min`;
  }

  // Se non ci sono minuti, mostra solo le ore
  return `${sign}${wholeHours}h`;
}

/**
 * Formatta ore arrotondate ai quarti d'ora (15 min) per una visualizzazione più pulita.
 * Evita valori tipo "3h 57min" -> mostra "4h" o "3h 45min"
 */
export function formatHoursRounded(hours) {
  if (hours === null || hours === undefined || isNaN(hours)) {
    return '0h';
  }
  const sign = hours < 0 ? '-' : '';
  const abs = Math.abs(hours);
  // Arrotonda ai quarti d'ora: 0, 0.25, 0.5, 0.75
  const rounded = Math.round(abs * 4) / 4;
  const wholeHours = Math.floor(rounded);
  const quarterHours = Math.round((rounded - wholeHours) * 4);
  const minutes = quarterHours * 15;

  if (minutes > 0) {
    return `${sign}${wholeHours}h ${minutes}min`;
  }
  return `${sign}${wholeHours}h`;
}

// =====================================================
// 9. ESPORTI PRINCIPALI
// =====================================================

export default {
  CONTRACT_TYPES,
  calculateWeeklyHours,
  calculateMonthlyHours,
  calculateVacationHoursForDay,
  calculateMonthlyVacationAccrual,
  calculateMonthlyPermissionAccrual,
  calculateOvertimeHours,
  calculateBusinessTripHours,
  calculateBusinessTripOvertime,
  calculateProRataAccrual,
  canRequestVacation,
  canRequestPermission,
  hoursToDays,
  daysToHours,
  formatHours,
  formatHoursRounded,
  calculateExpectedHoursForSchedule,
  calculateRealTimeHours
};

// =====================================================
// 10. HELPER FUNCTIONS FOR REAL-TIME CALCULATION
// =====================================================

function parseTimeToDate(timeStr) {
  return new Date(`2000-01-01T${timeStr}`);
}

function addMinutesToTimeString(timeStr, minutesToAdd) {
  const baseDate = parseTimeToDate(timeStr);
  baseDate.setMinutes(baseDate.getMinutes() + parseInt(minutesToAdd, 10));
  return `${baseDate.getHours().toString().padStart(2, '0')}:${baseDate.getMinutes().toString().padStart(2, '0')}`;
}

function calculateOverlapMinutes(intervalStart, intervalEnd, windowStart, windowEnd) {
  if (!windowStart || !windowEnd) return 0;
  const start = Math.max(intervalStart.getTime(), windowStart.getTime());
  const end = Math.min(intervalEnd.getTime(), windowEnd.getTime());
  if (end <= start) return 0;
  return (end - start) / (1000 * 60);
}

/**
 * Expected hours from a work_schedules row
 */
export function calculateExpectedHoursForSchedule(schedule) {
  if (!schedule || !schedule.start_time || !schedule.end_time) return 0;
  const [startHour, startMin] = schedule.start_time.split(':').map(Number);
  const [endHour, endMin] = schedule.end_time.split(':').map(Number);
  // IMPORTANTE: usa break_duration dal database, non default 60 (se è 0, è 0!)
  const breakDuration = schedule.break_duration !== null && schedule.break_duration !== undefined ? schedule.break_duration : 60;
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const workMinutes = Math.max(totalMinutes - breakDuration, 0);
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
export function calculateRealTimeHours(schedule, currentTime, permissionData = null) {
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

  // Ore contrattuali (restano fisse per la banca ore)
  const contractExpectedHours = calculateExpectedHoursForSchedule({ start_time, end_time, break_duration });

  // Calcola orari effettivi considerando i permessi
  let effectiveStartTime = start_time;
  let effectiveEndTime = end_time;

  if (permissionData?.entry_time) {
    effectiveStartTime = permissionData.entry_time;
  }

  if (permissionData?.exit_time) {
    effectiveEndTime = permissionData.exit_time;
  }

  const effectiveStartTimeObj = parseTimeToDate(effectiveStartTime);
  const effectiveEndTimeObj = parseTimeToDate(effectiveEndTime);
  const currentTimeObj = parseTimeToDate(currentTimeStr);

  if (effectiveEndTimeObj <= effectiveStartTimeObj) {
    const roundedContract = Math.round(contractExpectedHours * 10) / 10;
    return {
      actualHours: 0,
      expectedHours: 0,
      contractHours: roundedContract,
      balanceHours: -roundedContract,
      remainingHours: roundedContract,
      status: 'not_started'
    };
  }

  // IMPORTANTE: usa break_duration dal database, non default 60 (se è 0, è 0!)
  // FIX: Parse as integer to avoid string concatenation issues
  const breakDurationRaw = (break_duration !== null && break_duration !== undefined) ? break_duration : 60;
  const breakDurationMinutes = parseInt(breakDurationRaw, 10);
  let breakStartTimeStr = null;
  let breakEndTimeStr = null;

  if (breakDurationMinutes > 0) {
    if (break_start_time) {
      breakStartTimeStr = break_start_time;
      breakEndTimeStr = addMinutesToTimeString(break_start_time, breakDurationMinutes);
    } else {
      const startTotalMinutes = effectiveStartTimeObj.getHours() * 60 + effectiveStartTimeObj.getMinutes();
      const endTotalMinutes = effectiveEndTimeObj.getHours() * 60 + effectiveEndTimeObj.getMinutes();
      const totalMinutes = endTotalMinutes - startTotalMinutes;

      if (totalMinutes > breakDurationMinutes) {
        const halfPointMinutes = startTotalMinutes + (totalMinutes / 2);
        const rawBreakStart = halfPointMinutes - (breakDurationMinutes / 2);
        const rawBreakEnd = rawBreakStart + breakDurationMinutes;

        const clampedBreakStart = Math.max(rawBreakStart, startTotalMinutes);
        const clampedBreakEnd = Math.min(rawBreakEnd, endTotalMinutes);

        if (clampedBreakEnd - clampedBreakStart > 0) {
          const breakStartHour = Math.floor(clampedBreakStart / 60);
          const breakStartMin = Math.round(clampedBreakStart % 60);
          const breakEndHour = Math.floor(clampedBreakEnd / 60);
          const breakEndMin = Math.round(clampedBreakEnd % 60);
          breakStartTimeStr = `${breakStartHour.toString().padStart(2, '0')}:${breakStartMin.toString().padStart(2, '0')}`;
          breakEndTimeStr = `${breakEndHour.toString().padStart(2, '0')}:${breakEndMin.toString().padStart(2, '0')}`;
        }
      }
    }
  }

  const breakStartTimeObj = breakStartTimeStr ? parseTimeToDate(breakStartTimeStr) : null;
  const breakEndTimeObj = breakEndTimeStr ? parseTimeToDate(breakEndTimeStr) : null;

  const shiftMinutes = Math.max((effectiveEndTimeObj - effectiveStartTimeObj) / (1000 * 60), 0);
  const breakMinutesInShift = Math.min(
    calculateOverlapMinutes(
      effectiveStartTimeObj,
      effectiveEndTimeObj,
      breakStartTimeObj,
      breakEndTimeObj
    ),
    shiftMinutes
  );
  const effectiveExpectedHoursRaw = shiftMinutes > 0 ? Math.max(0, (shiftMinutes - breakMinutesInShift) / 60) : 0;

  const cappedCurrentTime = currentTimeObj <= effectiveEndTimeObj ? currentTimeObj : effectiveEndTimeObj;
  const workedIntervalMinutes = cappedCurrentTime > effectiveStartTimeObj
    ? (cappedCurrentTime - effectiveStartTimeObj) / (1000 * 60)
    : 0;
  const breakMinutesElapsed = calculateOverlapMinutes(
    effectiveStartTimeObj,
    cappedCurrentTime,
    breakStartTimeObj,
    breakEndTimeObj
  );

  let actualHours = 0;
  let status = 'not_started';

  if (currentTimeObj < effectiveStartTimeObj) {
    actualHours = 0;
    status = 'not_started';
  } else if (currentTimeObj <= effectiveEndTimeObj) {
    actualHours = Math.max(0, (workedIntervalMinutes - breakMinutesElapsed) / 60);
    const breakOverlapsShift = breakStartTimeObj && breakEndTimeObj
      ? calculateOverlapMinutes(
        effectiveStartTimeObj,
        effectiveEndTimeObj,
        breakStartTimeObj,
        breakEndTimeObj
      ) > 0
      : false;
    const isOnBreak = breakOverlapsShift && breakStartTimeObj && breakEndTimeObj
      ? currentTimeObj >= breakStartTimeObj && currentTimeObj < breakEndTimeObj
      : false;
    status = isOnBreak ? 'on_break' : 'working';
  } else {
    const totalWorkedMinutes = (effectiveEndTimeObj - effectiveStartTimeObj) / (1000 * 60);
    const totalBreakMinutes = breakMinutesInShift;
    actualHours = Math.max(0, (totalWorkedMinutes - totalBreakMinutes) / 60);
    status = 'completed';
  }

  // Calcola saldo ore
  const roundedActualHours = Math.round(actualHours * 10) / 10;
  const roundedEffectiveExpectedHours = Math.round(effectiveExpectedHoursRaw * 10) / 10;
  const roundedContractHours = Math.round(contractExpectedHours * 10) / 10;
  const balanceHours = Math.round((roundedActualHours - roundedContractHours) * 10) / 10;
  const remainingHours = Math.max(0, Math.round((effectiveExpectedHoursRaw - actualHours) * 10) / 10);

  return {
    actualHours: roundedActualHours,
    expectedHours: roundedEffectiveExpectedHours,
    contractHours: roundedContractHours,
    balanceHours,
    remainingHours,
    status
  };
}
/**
 * Calcola le ore nette di lavoro sottraendo la pausa se presente
 */
export function calculateNetWorkHours(startTime, endTime, breakStart = '13:00', breakDuration = 60) {
  if (!startTime || !endTime) return 0;

  const parseTime = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const bStart = parseTime(breakStart);
  const bDuration = parseInt(breakDuration, 10) || 0;
  const bEnd = bStart + bDuration;

  if (end <= start) return 0;

  // Calcola l'intervallo della pausa che cade all'interno dell'intervallo lavorativo
  const overlapStart = Math.max(start, bStart);
  const overlapEnd = Math.min(end, bEnd);

  const overlapMinutes = bDuration > 0 ? Math.max(0, overlapEnd - overlapStart) : 0;

  return (end - start - overlapMinutes) / 60;
}
