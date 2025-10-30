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

module.exports = {
  CONTRACT_TYPES,
  calculateWeeklyHours,
  getDailyHoursForDay,
  formatHours,
};


