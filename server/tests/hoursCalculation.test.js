const { calculateRealTimeHours, calculateExpectedHoursForSchedule } = require('../utils/hoursCalculation');

// Mock schedule
const standardSchedule = {
    start_time: '09:00',
    end_time: '18:00',
    break_duration: 60,
    break_start_time: '13:00'
};

const shortBreakSchedule = {
    start_time: '09:00',
    end_time: '18:00',
    break_duration: 30,
    break_start_time: '13:00'
};

const noBreakSchedule = {
    start_time: '09:00',
    end_time: '13:00',
    break_duration: 0
};

// Helper to create date for today at specific time
const time = (timeStr) => {
    const d = new Date();
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
};

describe('Hours Calculation Utility', () => {

    test('calculateExpectedHoursForSchedule - Standard Day', () => {
        const hours = calculateExpectedHoursForSchedule(standardSchedule);
        // 9 to 18 = 9 hours. Minus 1h break = 8 hours.
        if (hours !== 8) throw new Error(`Expected 8 hours, got ${hours}`);
        console.log('✅ Standard Day Expected Hours: Passed');
    });

    test('calculateExpectedHoursForSchedule - 0 Minute Break', () => {
        const hours = calculateExpectedHoursForSchedule(noBreakSchedule);
        // 9 to 13 = 4 hours. Minus 0 break = 4 hours.
        if (hours !== 4) throw new Error(`Expected 4 hours, got ${hours}`);
        console.log('✅ 0 Minute Break Expected Hours: Passed');
    });

    test('calculateRealTimeHours - Not Started', () => {
        const result = calculateRealTimeHours(standardSchedule, time('08:00'));
        if (result.status !== 'not_started') throw new Error(`Expected status not_started, got ${result.status}`);
        if (result.actualHours !== 0) throw new Error(`Expected 0 actualHours, got ${result.actualHours}`);
        console.log('✅ Real Time - Not Started: Passed');
    });

    test('calculateRealTimeHours - Working Morning', () => {
        // 11:00 -> 2 hours worked
        const result = calculateRealTimeHours(standardSchedule, time('11:00'));
        if (result.status !== 'working') throw new Error(`Expected status working, got ${result.status}`);
        if (result.actualHours !== 2) throw new Error(`Expected 2 actualHours, got ${result.actualHours}`);
        console.log('✅ Real Time - Working Morning: Passed');
    });

    test('calculateRealTimeHours - On Break', () => {
        // 13:30 -> Break is 13:00-14:00. Worked 9-13 = 4 hours.
        const result = calculateRealTimeHours(standardSchedule, time('13:30'));
        if (result.status !== 'on_break') throw new Error(`Expected status on_break, got ${result.status}`);
        if (result.actualHours !== 4) throw new Error(`Expected 4 actualHours, got ${result.actualHours}`);
        console.log('✅ Real Time - On Break: Passed');
    });

    test('calculateRealTimeHours - Working Afternoon', () => {
        // 15:00 -> Worked 9-13 (4h) + 14-15 (1h) = 5 hours.
        const result = calculateRealTimeHours(standardSchedule, time('15:00'));
        if (result.status !== 'working') throw new Error(`Expected status working, got ${result.status}`);
        if (result.actualHours !== 5) throw new Error(`Expected 5 actualHours, got ${result.actualHours}`);
        console.log('✅ Real Time - Working Afternoon: Passed');
    });

    test('calculateRealTimeHours - Completed Day', () => {
        // 19:00 -> Completed. 8 hours total.
        const result = calculateRealTimeHours(standardSchedule, time('19:00'));
        if (result.status !== 'completed') throw new Error(`Expected status completed, got ${result.status}`);
        if (result.actualHours !== 8) throw new Error(`Expected 8 actualHours, got ${result.actualHours}`);
        console.log('✅ Real Time - Completed Day: Passed');
    });

    test('calculateRealTimeHours - Early Exit Permission', () => {
        // Exit at 16:00. 
        // Worked 9-13 (4h) + 14-16 (2h) = 6 hours.
        const permissionData = { exit_time: '16:00' };
        const result = calculateRealTimeHours(standardSchedule, time('17:00'), permissionData);

        // Should be completed because it's past exit time
        if (result.status !== 'completed') throw new Error(`Expected status completed, got ${result.status}`);
        if (result.actualHours !== 6) throw new Error(`Expected 6 actualHours, got ${result.actualHours}`);
        console.log('✅ Real Time - Early Exit: Passed');
    });

    test('calculateRealTimeHours - Late Entry Permission', () => {
        // Enter at 11:00.
        // At 12:00 -> Worked 11-12 = 1 hour.
        const permissionData = { entry_time: '11:00' };
        const result = calculateRealTimeHours(standardSchedule, time('12:00'), permissionData);

        if (result.status !== 'working') throw new Error(`Expected status working, got ${result.status}`);
        if (result.actualHours !== 1) throw new Error(`Expected 1 actualHours, got ${result.actualHours}`);
        console.log('✅ Real Time - Late Entry: Passed');
    });

});

// Simple test runner
function describe(name, fn) {
    console.log(`\n🧪 Testing: ${name}`);
    try {
        fn();
    } catch (e) {
        console.error(`❌ Test Suite Failed: ${e.message}`);
        process.exit(1);
    }
}

function test(name, fn) {
    try {
        fn();
    } catch (e) {
        console.error(`❌ Test Failed: ${name} - ${e.message}`);
        throw e;
    }
}
