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
    annualVacationHours: 208, // 26 giorni * 8h
    annualPermissionHours: 104, // 13 giorni * 8h
    maxCarryoverHours: 104, // 13 giorni * 8h
    defaultWeeklyHours: 40,
    defaultDailyHours: 8
  },
  PART_TIME_HORIZONTAL: {
    name: 'part_time_horizontal',
    description: 'Part-time orizzontale',
    annualVacationHours: 104, // proporzionale
    annualPermissionHours: 52,
    maxCarryoverHours: 52,
    defaultWeeklyHours: 20,
    defaultDailyHours: 4
  },
  PART_TIME_VERTICAL: {
    name: 'part_time_vertical',
    description: 'Part-time verticale',
    annualVacationHours: 104, // proporzionale ai giorni lavorati
    annualPermissionHours: 52,
    maxCarryoverHours: 52,
    defaultWeeklyHours: 20,
    defaultDailyHours: 8 // stessi orari del FT ma meno giorni
  },
  APPRENTICESHIP: {
    name: 'apprenticeship',
    description: 'Apprendistato',
    annualVacationHours: 208,
    annualPermissionHours: 104,
    maxCarryoverHours: 104,
    defaultWeeklyHours: 40,
    defaultDailyHours: 8,
    hasTrainingHours: true,
    trainingHoursPerMonth: 8
  },
  COCOCO: {
    name: 'cococo',
    description: 'Collaborazione coordinata e continuativa',
    annualVacationHours: 0,
    annualPermissionHours: 0,
    maxCarryoverHours: 0,
    defaultWeeklyHours: 0,
    defaultDailyHours: 0
  },
  INTERNSHIP: {
    name: 'internship',
    description: 'Tirocinio',
    annualVacationHours: 0,
    annualPermissionHours: 0,
    maxCarryoverHours: 0,
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
 * Formatta ore in formato leggibile (es. "8h 30m")
 */
export function formatHours(hours) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  return `${wholeHours}h ${minutes}m`;
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
  formatHours
};
