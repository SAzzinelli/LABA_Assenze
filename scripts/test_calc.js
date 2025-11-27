
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

function calculateExpectedHoursForSchedule(schedule) {
    if (!schedule || !schedule.start_time || !schedule.end_time) return 0;
    const [startHour, startMin] = schedule.start_time.split(':').map(Number);
    const [endHour, endMin] = schedule.end_time.split(':').map(Number);
    // IMPORTANTE: usa break_duration dal database, non default 60 (se è 0, è 0!)
    const breakDuration = schedule.break_duration !== null && schedule.break_duration !== undefined ? schedule.break_duration : 60;
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const workMinutes = Math.max(totalMinutes - breakDuration, 0);
    return workMinutes / 60;
}

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
        status,
        debug: {
            shiftMinutes,
            breakMinutesInShift,
            effectiveExpectedHoursRaw,
            workedIntervalMinutes,
            breakMinutesElapsed,
            breakStartTimeStr,
            breakEndTimeStr
        }
    };
}

// TEST CASE
const schedule = { start_time: '09:00', end_time: '17:00', break_duration: "60" };
const currentTime = '10:20';

console.log('Testing with:', schedule, currentTime);
const result = calculateRealTimeHours(schedule, currentTime);
console.log('Result:', JSON.stringify(result, null, 2));
