import React, { useState, useEffect } from 'react';
import { PresenzeSkeleton } from '../components/Skeleton';
import {
  calculateMonthlyHours,
  calculateRealTimeHours
} from '../utils/hoursCalculation';
import { useAuthStore } from '../utils/store';
import { Clock, Calendar, CheckCircle, XCircle, TrendingUp, TrendingDown, Users, AlertCircle, Eye, RefreshCcw, Filter, Accessibility, Minus } from 'lucide-react';

const Attendance = () => {
  const { user, apiCall } = useAuthStore();
  const [attendance, setAttendance] = useState([]);
  const [hoursBalance, setHoursBalance] = useState({
    total_worked: 0,
    monte_ore: 0,
    working_days: 0,
    absent_days: 0
  });
  const [remainingDays, setRemainingDays] = useState(0);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [permissions104, setPermissions104] = useState([]); // Permessi 104 approvati
  const [permissionsMap, setPermissionsMap] = useState({}); // Permessi approvati per date (per badge blu)
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAttendanceDetails, setShowAttendanceDetails] = useState(false);
  const [selectedAttendanceDetails, setSelectedAttendanceDetails] = useState(null);

  const [currentHours, setCurrentHours] = useState({
    isWorkingDay: false,
    schedule: { start_time: '09:00', end_time: '18:00', break_duration: 60 },
    currentTime: '00:00',
    expectedHours: 0, // ore effettive (dopo permessi)
    contractHours: 0, // ore contrattuali della giornata
    remainingHours: 0,
    actualHours: 0,
    balanceHours: 0,
    status: 'not_started',
    progress: 0
  });

  // Cache locale per sistema ibrido
  const [localCache, setLocalCache] = useState({
    lastHourlySave: null,
    lastCalculation: null,
    pendingSave: false
  });
  const [updatingHours, setUpdatingHours] = useState(false);
  const [kpiData, setKpiData] = useState({
    monthlyHours: 0,
    overtime: 0,
    deficit: 0,
    workingDays: 0
  });

  const [totalBalance, setTotalBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(true);

  // Filtri per mese/anno
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    // Carica i dati e calcola le ore in tempo reale
    const initializeData = async () => {
      setRefreshing(true);
      console.log('🔄 Initializing with real-time calculation...');

      try {
        // 1. Carica i dati di base (incluso fetchCurrentHours per popolare i KPI)
        const attendanceData = await Promise.all([
          fetchAttendance(),
          fetchHoursBalance(),
          fetchTotalBalance(),
          fetchWorkSchedules(),
          fetchUserStats(),
          fetchPermissions104()
        ]);

        // 2. Carica i dati real-time dall'endpoint PRIMA di calcolare localmente
        await fetchCurrentHours();

        // 3. Recupera permessi per tutte le date visualizzate
        if (attendanceData[0] && attendanceData[0].length > 0) {
          await fetchPermissionsForDates(attendanceData[0]);
        }

        // 3. Calcola IMMEDIATAMENTE le ore in tempo reale (come backup/aggiornamento)
        // Solo se workSchedules è disponibile, altrimenti usa i dati dall'endpoint
        if (workSchedules.length > 0) {
          console.log('🔄 Forcing immediate real-time calculation...');
          performRealTimeCalculation();
        }

        console.log('✅ Data loaded with real-time calculation');
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    };

    initializeData();

    // Timer per calcoli real-time ogni minuto
    const realTimeTimer = setInterval(() => {
      setCurrentTime(new Date());
      // Chiama performRealTimeCalculation solo se workSchedules è disponibile
      // Altrimenti ricarica dall'endpoint per evitare di resettare i valori a 0
      if (workSchedules && workSchedules.length > 0) {
        performRealTimeCalculation();
      } else {
        // Se workSchedules non è disponibile, ricarica dall'endpoint
        console.log('🔄 Work schedules not available, fetching from endpoint...');
        fetchCurrentHours();
      }
    }, 60000); // Ogni minuto

    // Timer per salvataggio orario ogni ora
    const hourlySaveTimer = setInterval(() => {
      if (currentHours.actualHours > 0) {
        saveHourlyAttendance();
      }
    }, 3600000); // Ogni ora (3600000 ms)

    // Timer per salvataggio giornaliero alla fine della giornata
    const dailySaveTimer = setInterval(() => {
      const todaySchedule = workSchedules.find(schedule =>
        schedule.day_of_week === new Date().getDay() &&
        schedule.is_working_day
      );

      if (todaySchedule && todaySchedule.is_working_day) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const [endHour, endMin] = todaySchedule.end_time.split(':').map(Number);

        // Salva 5 minuti dopo la fine dell'orario di lavoro
        if (currentHour === endHour && currentMinute >= endMin + 5) {
          saveDailyAttendance();
        }
      }
    }, 60000); // Controlla ogni minuto

    // RIMOSSO: Aggiornamento database automatico (causa errori 403)
    // Il calcolo è ora completamente lato frontend

    // Polling ogni 60s per sincronizzazione con admin (ridotto carico)
    const performSync = async () => {
      console.log('🔄 Employee sync polling...');
      setRefreshing(true);
      try {
        await Promise.all([
          fetchAttendance(),
          fetchHoursBalance(),
          fetchTotalBalance(),
          fetchUserStats()
        ]);
        await performRealTimeCalculation();
      } finally {
        setRefreshing(false);
      }
    };

    const syncInterval = setInterval(() => {
      performSync();
    }, 60000); // 60 secondi

    // Aggiorna quando la finestra torna in focus (navigazione o dopo salvataggio orari)
    const handleFocus = () => {
      console.log('🔄 Window focused - recalculating hours and reloading work schedules...');

      // Ricarica anche i work schedules (potrebbero essere stati aggiornati dal Profilo)
      fetchWorkSchedules();

      // Ricalcola immediatamente le ore in tempo reale
      performSync();

      console.log('✅ Hours recalculated and work schedules reloaded on focus');
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(realTimeTimer);
      clearInterval(hourlySaveTimer);
      clearInterval(dailySaveTimer);
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Calcola KPI quando cambiano i dati di attendance o currentHours
  useEffect(() => {
    // Calcola sempre i KPI, anche se non ci sono record (per il sistema ibrido)
    calculateKPIs(attendance);
  }, [attendance, currentHours]);

  // Ricalcola le ore real-time quando cambiano i work schedules
  useEffect(() => {
    if (workSchedules.length > 0) {
      performRealTimeCalculation();
    }
  }, [workSchedules]);

  const fetchAttendance = async () => {
    try {
      const response = await apiCall('/api/attendance');
      if (response.ok) {
        const data = await response.json();
        const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
        setAttendance(sortedData);
        // Recupera permessi per tutte le date visualizzate
        if (sortedData.length > 0) {
          await fetchPermissionsForDates(sortedData);
        }
        return sortedData;
      } else {
        console.error('Attendance fetch failed:', response.status);
        setAttendance([]);
        return [];
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
      return [];
    }
  };

  const fetchHoursBalance = async () => {
    try {
      const currentDate = new Date();
      const response = await apiCall(`/api/attendance/hours-balance?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`);
      if (response.ok) {
        const data = await response.json();
        setHoursBalance(data);
      }
    } catch (error) {
      console.error('Error fetching hours balance:', error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await apiCall('/api/attendance/user-stats');
      if (response.ok) {
        const data = await response.json();
        console.log('📊 User Stats received:', {
          monthlyPresences: data.monthlyPresences,
          expectedMonthlyPresences: data.expectedMonthlyPresences,
          remainingDays: data.remainingDays
        });
        // IMPORTANTE: remainingDays = expectedMonthlyPresences - monthlyPresences (RIMANENTI, NON TOTALE!)
        // Verifica che non sia il totale
        const calculatedRemaining = Math.max(0, (data.expectedMonthlyPresences || 0) - (data.monthlyPresences || 0));
        console.log(`✅ Verifica calcolo: ${data.expectedMonthlyPresences} (totale) - ${data.monthlyPresences} (lavorati) = ${calculatedRemaining} (rimanenti)`);
        console.log(`✅ Valore da backend: remainingDays=${data.remainingDays}, calcolato=${calculatedRemaining}`);

        // FORZA il calcolo: usa sempre TOTALE - LAVORATI, mai il totale!
        // Se remainingDays dal backend non è definito o è uguale al totale (BUG), usa il calcolo
        const backendRemaining = data.remainingDays !== undefined ? data.remainingDays : calculatedRemaining;
        const finalRemainingDays = (backendRemaining === data.expectedMonthlyPresences)
          ? calculatedRemaining  // Se per caso backend ha restituito il totale, usa il calcolo
          : backendRemaining;

        console.log(`✅ Imposto remainingDays=${finalRemainingDays} (NON ${data.expectedMonthlyPresences} che è il TOTALE)`);

        // VERIFICA FINALE: deve essere < expectedMonthlyPresences
        if (finalRemainingDays >= data.expectedMonthlyPresences) {
          console.error(`❌ ERRORE: remainingDays (${finalRemainingDays}) >= expectedMonthlyPresences (${data.expectedMonthlyPresences}). Usando calcolo corretto.`);
          setRemainingDays(calculatedRemaining);
        } else {
          setRemainingDays(finalRemainingDays);
        }
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchTotalBalance = async () => {
    try {
      const response = await apiCall('/api/attendance/total-balance');
      if (response.ok) {
        const data = await response.json();
        let balance = data.totalBalanceHours || 0;
        if (data.realTime && typeof data.realTime.balanceHours === 'number') {
          balance = Math.round(data.realTime.balanceHours * 100) / 100;
        }
        setTotalBalance(balance);
        console.log('💰 Total balance loaded:', data.totalBalanceHours, ' (real-time:', data.realTime?.balanceHours, ')');
      }
    } catch (error) {
      console.error('Error fetching total balance:', error);
    }
  };


  const fetchWorkSchedules = async () => {
    try {
      console.log('🔄 [Presenze] Fetching work schedules...');
      const response = await apiCall('/api/work-schedules');
      if (response && response.ok) {
        const data = await response.json();
        console.log('📅 [Presenze] Work schedules caricati:', data.length, 'schedule totali');

        // Sanitize data: ensure break_duration is an integer
        const sanitizedData = data.map(s => ({
          ...s,
          break_duration: s.break_duration ? parseInt(s.break_duration, 10) : 0
        }));

        // Filter for current user if user_id is present (fixes issue where admin gets all schedules)
        const userSchedules = user?.id
          ? sanitizedData.filter(s => !s.user_id || s.user_id === user.id)
          : sanitizedData;

        console.log('📅 [Presenze] Work schedules dati (sanitized & filtered):', userSchedules);

        // Verifica specificamente lo schedule del giovedì (day_of_week = 4)
        const thursdaySchedule = userSchedules.find(s => Number(s.day_of_week) === 4 && s.is_working_day);
        if (thursdaySchedule) {
          console.log('✅ [Presenze] Schedule GIOVEDÌ trovato:', {
            day_of_week: thursdaySchedule.day_of_week,
            is_working_day: thursdaySchedule.is_working_day,
            start_time: thursdaySchedule.start_time,
            end_time: thursdaySchedule.end_time,
            break_duration: thursdaySchedule.break_duration,
            work_type: thursdaySchedule.work_type
          });
        } else {
          console.warn('⚠️ [Presenze] Schedule GIOVEDÌ NON trovato!');
          console.warn('⚠️ [Presenze] Schedule disponibili:', userSchedules.map(s => ({
            day: s.day_of_week,
            working: s.is_working_day,
            time: s.start_time && s.end_time ? `${s.start_time}-${s.end_time}` : 'N/A'
          })));
        }
        setWorkSchedules(userSchedules || []);
      } else {
        console.error('❌ [Presenze] Errore nel caricamento work schedules:', response?.status || 'No response');
      }
    } catch (error) {
      console.error('❌ [Presenze] Error fetching work schedules:', error);
    }
  };

  const fetchPermissions104 = async () => {
    try {
      if (user?.has104 || user?.has_104) {
        const response = await apiCall('/api/leave-requests?type=permission_104&status=approved');
        if (response.ok) {
          const data = await response.json();
          setPermissions104(data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching permissions 104:', error);
    }
  };

  // Helper per verificare se una data ha un permesso 104 approvato
  const hasPermission104 = (date) => {
    if (!permissions104 || permissions104.length === 0) return false;
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return permissions104.some(perm => {
      const start = new Date(perm.start_date);
      const end = new Date(perm.end_date);
      const checkDate = new Date(dateStr);
      return checkDate >= start && checkDate <= end;
    });
  };

  // Recupera permessi approvati per tutte le date visualizzate
  const fetchPermissionsForDates = async (attendanceRecords) => {
    try {
      if (!attendanceRecords || attendanceRecords.length === 0) {
        setPermissionsMap({});
        return;
      }

      // Estrai tutte le date uniche
      const dates = [...new Set(attendanceRecords.map(r => r.date))];

      // Recupera permessi per ogni data
      const permissionsMapNew = {};
      
      for (const date of dates) {
        try {
          const response = await apiCall(`/api/leave-requests/permission-hours?userId=${user?.id}&date=${date}`);
          if (response.ok) {
            const data = await response.json();
            // L'endpoint restituisce solo permessi normali (non 104), quindi se totalPermissionHours > 0, c'è un permesso
            if (data.totalPermissionHours > 0) {
              permissionsMapNew[date] = true;
            }
          }
        } catch (err) {
          console.error(`Error fetching permission for ${date}:`, err);
        }
      }

      setPermissionsMap(permissionsMapNew);
      console.log('📋 Permissions map updated:', Object.keys(permissionsMapNew).length, 'permessi trovati');
    } catch (error) {
      console.error('Error fetching permissions for dates:', error);
    }
  };

  const calculateKPIs = (attendanceData = attendance) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];

    console.log('🔄 Calculating KPIs with data:', attendanceData?.length || 0, 'records');

    // Filtra i record del mese corrente
    const monthlyRecords = (attendanceData || []).filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });

    // Calcola ore totali del mese, includendo le ore real-time di oggi se disponibili
    let totalMonthlyHours = monthlyRecords.reduce((sum, record) => {
      // Se è oggi e abbiamo dati real-time, usa quelli invece del record del database
      if (record.date === today && currentHours?.actualHours !== undefined && currentHours?.isWorkingDay) {
        return sum + (currentHours.actualHours || 0);
      }
      return sum + (record.actual_hours || 0);
    }, 0);

    // Calcola straordinari (ore positive)
    const overtime = monthlyRecords.reduce((sum, record) => {
      const balance = record.balance_hours || 0;
      return balance > 0 ? sum + balance : sum;
    }, 0);

    // Calcola deficit (ore negative)
    const deficit = monthlyRecords.reduce((sum, record) => {
      const balance = record.balance_hours || 0;
      return balance < 0 ? sum + Math.abs(balance) : sum;
    }, 0);

    // Calcola giorni lavorativi (giorni con ore effettive > 0)
    const workingDays = monthlyRecords.filter(record => (record.actual_hours || 0) > 0).length;

    console.log('📊 KPIs calculated:', {
      monthlyHours: totalMonthlyHours,
      overtime,
      deficit,
      workingDays
    });

    setKpiData({
      monthlyHours: totalMonthlyHours,
      overtime: overtime,
      deficit: deficit,
      workingDays: workingDays
    });
  };

  // Calcolo DINAMICO delle ore in tempo reale usando la utility condivisa
  const performRealTimeCalculation = async () => {
    console.log('🔄 performRealTimeCalculation called (using shared utility)');

    try {
      // Se workSchedules non è disponibile, ricarica dall'endpoint invece di resettare
      if (!workSchedules || workSchedules.length === 0) {
        console.log('⚠️ Work schedules not available, fetching from endpoint instead...');
        await fetchCurrentHours();
        return;
      }

      const now = new Date();
      const dayOfWeek = now.getDay();

      // Trova l'orario di lavoro per oggi
      const todaySchedule = workSchedules.find(schedule =>
        Number(schedule.day_of_week) === Number(dayOfWeek) &&
        schedule.is_working_day
      );

      if (!todaySchedule) {
        // Non sovrascrivere i valori esistenti se non troviamo lo schedule
        // Potrebbe essere un problema temporaneo, meglio mantenere i dati dall'endpoint
        console.warn('⚠️ No schedule found for today, keeping existing currentHours values');
        // Se currentHours non è ancora popolato, ricarica dall'endpoint
        if (!currentHours?.isWorkingDay && (!currentHours?.actualHours || currentHours.actualHours === 0)) {
          console.log('🔄 No schedule and no existing data, fetching from endpoint...');
          await fetchCurrentHours();
        }
        return;
      }

      // Recupera permessi per oggi
      let utilityPermissionData = null;
      try {
        const todayStr = now.toISOString().split('T')[0];
        // Usa l'endpoint esistente per recuperare i permessi del giorno
        const response = await apiCall(`/api/permissions/day/${todayStr}?userId=${user.id}`);

        if (response.ok) {
          const data = await response.json();
          if (data.permissions && data.permissions.length > 0) {
            console.log('🎟️ Permissions found for today:', data.permissions);

            const earlyExitPerm = data.permissions.find(p => p.type === 'early_exit' && p.exitTime);
            const lateEntryPerm = data.permissions.find(p => p.type === 'late_entry' && p.entryTime);

            if (earlyExitPerm || lateEntryPerm) {
              utilityPermissionData = {};
              if (earlyExitPerm) {
                utilityPermissionData.exit_time = earlyExitPerm.exitTime;
                console.log(`🚪 Early exit permission: ${earlyExitPerm.exitTime}`);
              }
              if (lateEntryPerm) {
                utilityPermissionData.entry_time = lateEntryPerm.entryTime;
                console.log(`🚪 Late entry permission: ${lateEntryPerm.entryTime}`);
              }
            }
          }
        }
      } catch (err) {
        console.error('❌ Error fetching permissions for real-time calc:', err);
      }

      const result = calculateRealTimeHours(todaySchedule, now, utilityPermissionData);

      console.log(`📊 Shared Utility calculation: ${result.actualHours}h actual, ${result.balanceHours}h balance`);

      // Aggiorna la cache locale
      setLocalCache(prev => ({
        ...prev,
        lastCalculation: now,
        pendingSave: prev.pendingSave || (now.getMinutes() === 0 && result.actualHours > 0) // Salva ogni ora in punto
      }));

      // Aggiorna lo stato
      setCurrentHours({
        isWorkingDay: true,
        schedule: {
          start_time: todaySchedule.start_time,
          end_time: todaySchedule.end_time,
          break_duration: todaySchedule.break_duration !== null && todaySchedule.break_duration !== undefined ? todaySchedule.break_duration : 60
        },
        currentTime: now.toTimeString().substring(0, 5),
        expectedHours: result.expectedHours,
        contractHours: result.contractHours,
        remainingHours: result.remainingHours,
        actualHours: result.actualHours,
        balanceHours: result.balanceHours,
        status: result.status,
        progress: result.expectedHours > 0 ? Math.min((result.actualHours / result.expectedHours) * 100, 100) : 100
      });

      // Aggiorna anche i dati di attendance per oggi
      const today = now.toISOString().split('T')[0];
      let latestAttendance = [];
      setAttendance(prevAttendance => {
        let updatedAttendance = [];
        if (prevAttendance.length > 0) {
          updatedAttendance = prevAttendance.some(record => record.date === today)
            ? prevAttendance.map(record =>
              record.date === today
                ? {
                  ...record,
                  actual_hours: result.actualHours,
                  balance_hours: result.balanceHours
                }
                : record
            )
            : [
              {
                id: `virtual-${today}`,
                user_id: user?.id,
                date: today,
                expected_hours: result.contractHours,
                actual_hours: result.actualHours,
                balance_hours: result.balanceHours,
                notes: 'Presenza automatica per orario',
                created_at: now.toISOString(),
                updated_at: now.toISOString()
              },
              ...prevAttendance
            ];
        } else {
          updatedAttendance = [
            {
              id: `virtual-${today}`,
              user_id: user?.id,
              date: today,
              expected_hours: result.contractHours,
              actual_hours: result.actualHours,
              balance_hours: result.balanceHours,
              notes: 'Presenza automatica per orario',
              created_at: now.toISOString(),
              updated_at: now.toISOString()
            }
          ];
        }
        latestAttendance = updatedAttendance;
        return updatedAttendance;
      });

      if (latestAttendance.length > 0) {
        calculateKPIs(latestAttendance);
      }

      // Controlla se è il momento di salvare (ogni ora in punto)
      if (now.getMinutes() === 0 && result.actualHours > 0) {
        const lastSave = localCache.lastHourlySave;
        if (!lastSave || (now.getTime() - lastSave.getTime()) >= 3600000) {
          console.log('⏰ Time for hourly save:', result.actualHours, 'hours');
          saveHourlyAttendance(); // Nota: saveHourlyAttendance usa currentHours, che abbiamo appena settato. 
          // React state update è asincrono, quindi potrebbe usare valori vecchi.
          // Meglio passare i valori espliciti se possibile, o fidarsi del prossimo ciclo.
          // Per sicurezza, qui ci fidiamo che al prossimo render sarà aggiornato o che saveHourly legga dallo stato.
          // FIX: saveHourlyAttendance legge currentHours.actualHours. 
          // Dato che setState è async, questo potrebbe fallire nel ciclo corrente.
          // Tuttavia, il timer originale chiamava saveHourlyAttendance separatamente.
        }
      }
    } catch (error) {
      console.error('❌ Error calculating real-time hours:', error);
    }
  };

  const fetchCurrentHours = async () => {
    try {
      console.log('🔄 Fetching current hours with real-time calculation...');
      const response = await apiCall('/api/attendance/current-hours');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Current hours fetched:', data);
        setCurrentHours(data);
      } else {
        console.error('❌ Failed to fetch current hours:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching current hours:', error);
    }
  };

  const updateCurrentAttendance = async () => {
    setUpdatingHours(true);
    try {
      console.log('🔄 Updating current attendance...');
      const response = await apiCall('/api/attendance/update-current', {
        method: 'PUT'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Attendance updated:', data);
        setCurrentHours(data.hours);

        // Aggiorna tutti i dati in parallelo
        await Promise.all([
          fetchAttendance(),
          fetchHoursBalance(),
          fetchCurrentHours()
        ]);

        console.log('✅ All data refreshed after update');
        return true;
      } else {
        const error = await response.json();
        console.error('❌ Update failed:', response.status, error);
        return false;
      }
    } catch (error) {
      console.error('❌ Update error:', error);
      return false;
    } finally {
      setUpdatingHours(false);
    }
  };

  // Salvataggio orario ogni ora (sistema ibrido)
  const saveHourlyAttendance = async () => {
    try {
      const todaySchedule = workSchedules.find(schedule =>
        schedule.day_of_week === new Date().getDay() &&
        schedule.is_working_day
      );

      if (!todaySchedule || !currentHours.actualHours || currentHours.actualHours <= 0) {
        return;
      }

      const now = new Date();
      const lastSave = localCache.lastHourlySave;

      // Evita salvataggi duplicati nella stessa ora
      if (lastSave && (now.getTime() - lastSave.getTime()) < 3600000) {
        console.log('⏰ Hourly save skipped - already saved this hour');
        return;
      }

      console.log('💾 Saving hourly attendance:', currentHours.actualHours, 'hours');

      const response = await apiCall('/api/attendance/save-hourly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          actualHours: currentHours.actualHours,
          expectedHours: currentHours.contractHours ?? currentHours.expectedHours,
          balanceHours: currentHours.balanceHours,
          notes: `Salvataggio orario alle ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
        })
      });

      if (response.ok) {
        console.log('✅ Hourly attendance saved successfully');
        setLocalCache(prev => ({
          ...prev,
          lastHourlySave: now,
          pendingSave: false
        }));
      } else {
        console.error('❌ Hourly save failed:', response.status, await response.json());
        setLocalCache(prev => ({ ...prev, pendingSave: true }));
      }
    } catch (error) {
      console.error('❌ Hourly save error:', error);
      setLocalCache(prev => ({ ...prev, pendingSave: true }));
    }
  };

  // Salvataggio giornaliero finale
  const saveDailyAttendance = async () => {
    try {
      const todaySchedule = workSchedules.find(schedule =>
        schedule.day_of_week === new Date().getDay() &&
        schedule.is_working_day
      );

      if (!todaySchedule) {
        return;
      }

      const now = new Date();

      console.log('💾 Saving final daily attendance:', currentHours.actualHours, 'hours');

      const response = await apiCall('/api/attendance/save-daily', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          actualHours: currentHours.actualHours,
          expectedHours: currentHours.contractHours ?? currentHours.expectedHours,
          balanceHours: currentHours.balanceHours,
          notes: `Presenza salvata automaticamente alle ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
        })
      });

      if (response.ok) {
        console.log('✅ Final daily attendance saved successfully');
        // Ricarica i dati dopo il salvataggio
        await Promise.all([
          fetchAttendance(),
          fetchHoursBalance()
        ]);
      } else {
        console.error('❌ Final save failed:', response.status, await response.json());
      }
    } catch (error) {
      console.error('❌ Final save error:', error);
    }
  };

  const handleViewAttendanceDetails = (record) => {
    // Calcola i dati real-time al momento dell'apertura del modal
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();

    // Trova l'orario di lavoro per oggi
    // IMPORTANTE: usa Number() per confronto robusto (evita problemi string vs number)
    const todaySchedule = workSchedules.find(schedule =>
      Number(schedule.day_of_week) === Number(dayOfWeek) && schedule.is_working_day
    );

    let realTimeActualHours = 0;
    let realTimeBalanceHours = 0;
    let scheduleExpectedHours = null;
    let expectedHours = typeof record.expected_hours === 'number' ? record.expected_hours : null;
    const dbActualHours = typeof record.actual_hours === 'number' ? record.actual_hours : null;
    const dbBalanceHours = typeof record.balance_hours === 'number' ? record.balance_hours : null;

    if (todaySchedule) {
      const { start_time, end_time, break_duration } = todaySchedule;
      const [startHour, startMin] = start_time.split(':').map(Number);
      const [endHour, endMin] = end_time.split(':').map(Number);
      // IMPORTANTE: usa break_duration dal database, non default 60 (se è 0, è 0)
      const breakDuration = break_duration !== null && break_duration !== undefined ? break_duration : 0;

      // Calcola ore attese totali correttamente
      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const workMinutes = Math.max(0, totalMinutes - breakDuration);
      scheduleExpectedHours = workMinutes / 60;

      // Se il record ha un permesso 104, usa sempre lo schedule per expectedHours (non il DB)
      // Per permessi 104, usa sempre lo schedule corretto, non il valore salvato nel DB
      if (record.status === 'permission_104' || record.status === 'Assente (Giustificato)') {
        expectedHours = scheduleExpectedHours; // Forza il ricalcolo dallo schedule
      } else if (expectedHours === null) {
        expectedHours = scheduleExpectedHours;
      }

      // Se c'è un permesso 104, actualHours è sempre 0 (non ha lavorato)
      if (record.status === 'permission_104' || record.status === 'Assente (Giustificato)') {
        realTimeActualHours = 0;
        realTimeBalanceHours = 0;
      } else {
        // Calcola ore effettive real-time
        if (currentHour >= startHour && currentHour <= endHour) {
          // Durante l'orario di lavoro
          const workedMinutes = (currentHour * 60 + currentMinute) - (startHour * 60 + startMin);
          // Sottrai la pausa se c'è e siamo dopo l'inizio della pausa
          if (breakDuration > 0 && todaySchedule.break_start_time) {
            const [breakStartHour, breakStartMin] = todaySchedule.break_start_time.split(':').map(Number);
            if (currentHour > breakStartHour || (currentHour === breakStartHour && currentMinute >= breakStartMin)) {
              realTimeActualHours = Math.max(0, (workedMinutes - breakDuration) / 60);
            } else {
              realTimeActualHours = workedMinutes / 60;
            }
          } else {
            realTimeActualHours = workedMinutes / 60;
          }
          realTimeBalanceHours = realTimeActualHours - expectedHours;
        } else if (currentHour > endHour) {
          // Dopo l'orario di lavoro
          realTimeActualHours = expectedHours;
          realTimeBalanceHours = 0;
        }
      }
    }

    const actualHoursForSummary = dbActualHours ?? realTimeActualHours;
    const expectedHoursForSummary = expectedHours ?? scheduleExpectedHours ?? 0;
    const balanceHoursForSummary = dbBalanceHours ?? (actualHoursForSummary - expectedHoursForSummary);

    const statusInfo = computeStatusInfo({
      ...record,
      actual_hours: actualHoursForSummary,
      expected_hours: expectedHoursForSummary
    });

    const realTimeData = {
      attendance: record,
      schedule: todaySchedule,
      summary: {
        date: record.date,
        employee: user && user.first_name && user.last_name ?
          `${user.first_name} ${user.last_name}` :
          (user && user.email ? user.email.split('@')[0] : 'Dipendente'),
        expectedHours: expectedHoursForSummary,
        actualHours: actualHoursForSummary,
        balanceHours: balanceHoursForSummary,
        status: statusInfo.text,
        statusBadgeClass: statusInfo.badgeClass,
        notes: ''
      }
    };

    setSelectedAttendanceDetails(realTimeData);
    setShowAttendanceDetails(true);
  };

  const formatTime = (time) => {
    return time ? new Date(time).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    }) : '--:--';
  };

  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return '0h 0m';
    const h = Math.floor(Math.abs(hours));
    const m = Math.floor((Math.abs(hours) - h) * 60);
    return `${hours < 0 ? '-' : ''}${h}h ${m}m`;
  };

  const formatHoursWithSign = (hours) => {
    if (hours === null || hours === undefined) return '0h 0m';
    const sign = hours < 0 ? '-' : hours > 0 ? '+' : '';
    const absValue = Math.abs(hours);
    const h = Math.floor(absValue);
    const m = Math.floor((absValue - h) * 60);
    return `${sign}${h}h ${m}m`;
  };

  const normalizeDateToISO = (date) => {
    if (!date) return '';
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized.toISOString().split('T')[0];
  };


  // Funzione per ottenere l'icona dello status (stesso stile di Admin)
  const getStatusIcon = (status) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'working': return <Clock className="h-4 w-4" />;
      case 'not_started': return <Clock className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'sick_leave': return <AlertCircle className="h-4 w-4" />;
      case 'permission_104': return <Accessibility className="h-4 w-4" />;
      case 'holiday': return <Calendar className="h-4 w-4" />;
      case 'non_working_day': return <Minus className="h-4 w-4" />;
      case 'on_break': return <Clock className="h-4 w-4 text-orange-500" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Funzione per ottenere il testo dello status (stesso stile di Admin)
  const getStatusTextFromStatus = (status) => {
    switch (status) {
      case 'present': return 'Presente';
      case 'completed': return 'Giornata terminata';
      case 'working': return 'Al lavoro';
      case 'not_started': return 'Non iniziato';
      case 'absent': return 'Assente';
      case 'sick_leave': return 'In malattia';
      case 'permission_104': return 'Permesso 104';
      case 'holiday': return 'Festivo';
      case 'non_working_day': return 'Non lavorativo';
      case 'on_break': return 'In Pausa';
      default: return 'Sconosciuto';
    }
  };

  function computeStatusInfo(record = {}, hasPermission = false) {
    const { actual_hours = 0, is_justified_absence, leave_type, is_absent, expected_hours = 0, is_vacation, status } = record;
    const hasWorked = actual_hours > 0;

    // Se c'è uno status esplicito (da real-time), usalo
    if (status) {
      const statusText = getStatusTextFromStatus(status);
      const statusColor = getStatusColorFromStatus(status, hasPermission);
      return {
        text: statusText,
        colorClass: statusColor.split(' ')[1], // Estrai solo la classe text-*
        badgeClass: statusColor,
        icon: getStatusIcon(status)
      };
    }

    const badgeClasses = {
      green: 'bg-green-900 text-green-100 border-green-700',
      yellow: 'bg-yellow-900 text-yellow-100 border-yellow-700',
      red: 'bg-red-900 text-red-100 border-red-700',
      gray: 'bg-gray-900 text-gray-100 border-gray-700',
      purple: 'bg-purple-900 text-purple-100 border-purple-700',
      blue: 'bg-blue-900 text-blue-100 border-blue-700'
    };

    // Controlla prima se è in ferie (is_vacation o leave_type === 'vacation')
    if (is_vacation || leave_type === 'vacation') {
      return {
        text: 'In Ferie',
        colorClass: 'text-purple-100',
        badgeClass: badgeClasses.purple,
        icon: getStatusIcon('holiday')
      };
    }

    if (is_justified_absence && leave_type === 'permission' && hasWorked) {
      return {
        text: 'Presente (con permesso)',
        colorClass: hasPermission ? 'text-blue-100' : 'text-green-100',
        badgeClass: hasPermission ? badgeClasses.blue : badgeClasses.green,
        icon: getStatusIcon('present')
      };
    }

    if (is_justified_absence) {
      const leaveTypeText = {
        sick_leave: 'Malattia',
        vacation: 'Ferie',
        permission: 'Permesso'
      }[leave_type] || 'Giustificato';

      return {
        text: `Assente (${leaveTypeText})`,
        colorClass: 'text-yellow-100',
        badgeClass: leave_type === 'sick_leave' ? badgeClasses.red : badgeClasses.yellow,
        icon: leave_type === 'sick_leave' ? getStatusIcon('sick_leave') : getStatusIcon('absent')
      };
    }

    if (is_absent) {
      return {
        text: 'Assente',
        colorClass: 'text-red-100',
        badgeClass: badgeClasses.red,
        icon: getStatusIcon('absent')
      };
    }

    // Se ha lavorato (actual_hours > 0), è presente anche se expected_hours === 0
    if (hasWorked) {
      return {
        text: 'Presente',
        colorClass: hasPermission ? 'text-blue-100' : 'text-green-100',
        badgeClass: hasPermission ? badgeClasses.blue : badgeClasses.green,
        icon: getStatusIcon('present')
      };
    }

    // Solo se expected_hours === 0 E actual_hours === 0, allora è non lavorativo
    if (expected_hours === 0) {
      return {
        text: 'Non lavorativo',
        colorClass: 'text-gray-100',
        badgeClass: badgeClasses.gray,
        icon: getStatusIcon('non_working_day')
      };
    }

    return {
      text: 'Presente',
      colorClass: 'text-green-100',
      badgeClass: badgeClasses.green,
      icon: getStatusIcon('present')
    };
  }

  // Funzione helper per ottenere il colore dello status (stesso stile di Admin)
  const getStatusColorFromStatus = (status, hasPermission = false) => {
    // Se c'è un permesso e lo status è 'present' o 'completed', usa blu
    if (hasPermission && (status === 'present' || status === 'completed')) {
      return 'bg-blue-900 text-blue-100 border-blue-700';
    }
    
    switch (status) {
      case 'present': return 'bg-green-900 text-green-100 border-green-700';
      case 'completed': return 'bg-green-800 text-green-200 border-green-600';
      case 'working': return 'bg-yellow-900 text-yellow-100 border-yellow-700';
      case 'not_started': return 'bg-yellow-900 text-yellow-100 border-yellow-700';
      case 'absent': return 'bg-red-900 text-red-100 border-red-700';
      case 'sick_leave': return 'bg-red-900 text-red-100 border-red-700';
      case 'vacation': return 'bg-purple-900 text-purple-100 border-purple-700';
      case 'permission_104': return 'bg-blue-900 text-blue-100 border-blue-700';
      case 'holiday': return 'bg-blue-900 text-blue-100 border-blue-700';
      case 'non_working_day': return 'bg-gray-900 text-gray-100 border-gray-700';
      case 'on_break': return 'bg-orange-900 text-orange-100 border-orange-700';
      default: return 'bg-gray-900 text-gray-100 border-gray-700';
    }
  };

  const getStatusColor = (record) => {
    const hasPermission = record.date ? permissionsMap[record.date] || false : false;
    return computeStatusInfo(record, hasPermission).colorClass;
  };

  const getStatusText = (record) => {
    return computeStatusInfo(record).text;
  };

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'text-green-400';
    if (balance < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getBalanceIcon = (balance) => {
    if (balance > 0) return <TrendingUp className="h-4 w-4" />;
    if (balance < 0) return <TrendingDown className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getDisplayedDeficit = (record) => {
    if (!record) return 0;
    const todayISO = new Date().toISOString().split('T')[0];
    const recordISO = normalizeDateToISO(record.date);
    const isToday = recordISO === todayISO;

    // Se c'è un permesso 104, le ore mancanti sono SEMPRE 0 (è un'assenza giustificata)
    const isPermission104 = hasPermission104(record.date) || record.status === 'permission_104' || record.status === 'Assente (Giustificato)' || getStatusText(record).includes('104');
    if (isPermission104) {
      return 0; // Permesso 104: assenza giustificata, nessuna ora mancante
    }

    // Calcola expected usando la stessa logica delle "Ore Attese"
    let expected = record.expected_hours ?? 0;
    if (isToday && currentHours?.contractHours !== undefined) {
      expected = currentHours.contractHours;
    } else if (isToday && currentHours?.expectedHours !== undefined) {
      expected = currentHours.expectedHours;
    }

    const actual = isToday ? (currentHours.actualHours ?? 0) : (record.actual_hours ?? 0);

    let deficit = Math.max(0, expected - actual);

    if (isToday) {
      const remaining = currentHours?.remainingHours ?? 0;
      deficit = Math.max(0, deficit - remaining);
    }

    return deficit;
  };

  const getTodaySchedule = () => {
    const today = new Date().getDay();
    // IMPORTANTE: usa Number() per confronto robusto (evita problemi string vs number)
    return workSchedules.find(schedule => Number(schedule.day_of_week) === Number(today));
  };

  const todaySchedule = getTodaySchedule();
  const todayAttendance = attendance.find(record =>
    new Date(record.date).toDateString() === new Date().toDateString()
  );


  if (loading) {
    return <PresenzeSkeleton />;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Presenze</h1>
          <p className="text-slate-400">
            Sistema automatico basato su orari di lavoro
          </p>
        </div>

        {refreshing && (
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Aggiornamento dati in corso...
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {/* TOTALE ORE LAVORATE */}
          <div className="bg-zinc-900 rounded-lg p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-xs sm:text-sm uppercase mb-1">Ore Lavorate</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-400">
                  {currentHours?.status === 'permission_104'
                    ? 'Permesso 104'
                    : formatHours(currentHours?.actualHours || 0)}
                </p>
              </div>
              <div className="hidden sm:block p-3 rounded-full text-blue-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* DA LAVORARE OGGI */}
          <div className="bg-zinc-900 rounded-lg p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-xs sm:text-sm uppercase mb-1">Da lavorare oggi</p>
                <p className="text-xl sm:text-2xl font-bold text-green-400">
                  {formatHours(currentHours?.remainingHours ?? Math.max(0, (currentHours?.expectedHours || 0) - (currentHours?.actualHours || 0)))}
                </p>
              </div>
              <div className="hidden sm:block p-3 rounded-full text-green-400">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* GIORNI LAVORATI */}
          <div className="bg-zinc-900 rounded-lg p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-xs sm:text-sm uppercase mb-1">Giorni Lavorati</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-400">
                  {hoursBalance.working_days || 0}
                </p>
              </div>
              <div className="hidden sm:block p-3 rounded-full text-purple-400">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* GIORNI RIMANENTI */}
          <div className="bg-zinc-900 rounded-lg p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-xs sm:text-sm uppercase mb-1">Giorni Rimanenti</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-400">
                  {remainingDays}
                </p>
              </div>
              <div className="hidden sm:block p-3 rounded-full text-orange-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Today's Status */}
        <div className="bg-slate-800 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Stato Oggi
          </h2>

          {(() => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const isWorkingDay = todaySchedule && todaySchedule.is_working_day;

            if (!isWorkingDay) {
              return (
                <div className="text-center py-8">
                  <div className="text-slate-400 text-lg">
                    <p>Giorno non lavorativo</p>
                  </div>
                </div>
              );
            }

            // Check if workday is concluded
            const [endHour, endMin] = todaySchedule.end_time.split(':').map(Number);
            const isWorkdayConcluded = currentHour > endHour || (currentHour === endHour && currentMinute >= endMin);

            if (isWorkdayConcluded) {
              return (
                <div className="text-center py-8">
                  <div className="text-slate-300 text-lg">
                    <p className="mb-2">🎯 <strong>Giornata lavorativa conclusa</strong></p>
                    <p className="text-slate-400">
                      Controlla la cronologia di oggi per presenza e dettagli completi
                    </p>
                  </div>
                </div>
              );
            }

            // Active workday - show current status
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Orario di Lavoro */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Orario di Lavoro</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Inizio:</span>
                      <span className="font-mono">{todaySchedule.start_time.substring(0, 5)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fine:</span>
                      <span className="font-mono">{todaySchedule.end_time.substring(0, 5)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pausa:</span>
                      <span className="font-mono">{todaySchedule.break_duration} min</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-700 pt-2">
                      <span className="text-slate-400">Ore Attese:</span>
                      <span className="font-bold text-green-400">
                        {formatHours(currentHours?.contractHours || currentHours?.expectedHours || todaySchedule.expected_hours || 8)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stato Presenza */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Stato Presenza</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Stato:</span>
                      <span className="font-semibold text-green-400">
                        Presente
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ore Correnti:</span>
                      <span className="font-bold text-blue-400">
                        {formatHours(currentHours?.actualHours || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ore Mancanti:</span>
                      <span className={`font-bold ${(currentHours?.balanceHours || 0) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatHours(Math.abs(currentHours?.balanceHours || 0))}
                      </span>
                    </div>
                    {(currentHours?.balanceHours || 0) < 0 && (
                      <div className="text-xs text-slate-400 mt-2 p-2 bg-slate-800 rounded">
                        💡 Mancano {formatHours(Math.abs(currentHours?.balanceHours || 0))} per completare la giornata
                      </div>
                    )}
                    <div className="flex justify-center gap-3 pt-3">
                      <button
                        onClick={() => handleViewAttendanceDetails(todayAttendance)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Visualizza Dettagli
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Attendance History - Responsive: cards on mobile, table on lg+ */}
        <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
            <h2 className="text-xl font-bold flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Cronologia Presenze
            </h2>

            {/* Filtri Mese/Anno */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <label className="text-sm text-slate-400 whitespace-nowrap">Mese:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full h-[42px] bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleDateString('it-IT', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400 whitespace-nowrap">Anno:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full h-[42px] bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setSelectedMonth(new Date().getMonth() + 1);
                  setSelectedYear(new Date().getFullYear());
                }}
                disabled={selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear()}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear()
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white cursor-pointer'
                  }`}
              >
                Oggi
              </button>
            </div>
          </div>

          {/* Mobile Cards - Responsive: 1 colonna su mobile, 2 su tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:hidden">
            {(() => {
              // Filtra per mese/anno selezionato
              const filteredAttendance = attendance.filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() + 1 === selectedMonth && recordDate.getFullYear() === selectedYear;
              });

              const today = new Date().toISOString().split('T')[0];
              const todayDate = new Date();
              const isCurrentMonth = selectedMonth === todayDate.getMonth() + 1 && selectedYear === todayDate.getFullYear();
              const todayExists = filteredAttendance.some(record => record.date === today);

              let combined = [...filteredAttendance];

              // Aggiungi oggi solo se siamo nel mese/anno corrente
              if (isCurrentMonth && !todayExists) {
                combined = [{
                  id: 'today-realtime',
                  date: today,
                  actual_hours: currentHours.actualHours,
                  expected_hours: currentHours.contractHours || currentHours.expectedHours,
                  balance_hours: currentHours.balanceHours,
                  status: currentHours.status
                }, ...combined];
              }

              // Se esiste già un record per oggi nel database, aggiorna sempre con i dati real-time
              if (isCurrentMonth && todayExists) {
                combined = combined.map(record => {
                  if (record.date === today && currentHours?.isWorkingDay) {
                    return {
                      ...record,
                      expected_hours: currentHours.contractHours || currentHours.expectedHours || 0,
                      actual_hours: currentHours.actualHours || 0,
                      balance_hours: currentHours.balanceHours || 0,
                      status: currentHours.status || 'not_started'
                    };
                  }
                  return record;
                });
              }

              if (combined.length === 0) {
                return (
                  <div className="col-span-2 text-center py-8 text-slate-400">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun record per {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</p>
                  </div>
                );
              }

              return combined.map((record) => (
                <div key={record.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 sm:p-4 hover:bg-slate-800 hover:border-slate-500 transition-all">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="font-semibold text-white text-sm sm:text-base">
                      {new Date(record.date).toLocaleDateString('it-IT')}
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${(() => {
                      const today = new Date().toISOString().split('T')[0];
                      const isToday = record.date === today;
                      const hasPermission = permissionsMap[record.date] || false;
                      
                      // Per oggi, usa direttamente currentHours.status se disponibile
                      if (isToday && currentHours?.status && currentHours?.isWorkingDay) {
                        return getStatusColorFromStatus(currentHours.status, hasPermission);
                      }
                      
                      // Per altri giorni, calcola lo status
                      const statusInfo = computeStatusInfo(record, hasPermission);
                      return statusInfo.badgeClass;
                    })()}`}>
                      {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const isToday = record.date === today;
                        const hasPermission = permissionsMap[record.date] || false;
                        
                        // Per oggi, usa direttamente currentHours.status se disponibile
                        if (isToday && currentHours?.status && currentHours?.isWorkingDay) {
                          return (
                            <>
                              {getStatusIcon(currentHours.status)}
                              <span className="ml-1">{getStatusTextFromStatus(currentHours.status)}</span>
                            </>
                          );
                        }
                        
                        // Per altri giorni, calcola lo status
                        const statusInfo = computeStatusInfo(record, hasPermission);
                        return (
                          <>
                            {statusInfo.icon}
                            <span className="ml-1">{statusInfo.text}</span>
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-slate-400 text-[10px] sm:text-xs mb-1">Attese</div>
                      <div className="font-mono text-white text-xs sm:text-sm font-semibold">
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          const isToday = record.date === today;
                          const isPermission104 = hasPermission104(record.date) || record.status === 'permission_104' || record.status === 'Assente (Giustificato)' || getStatusText(record).includes('104');

                          // PRIORITÀ 1: Se c'è un permesso 104 (oggi o passato), ricalcola SEMPRE dallo schedule (non usare DB o real-time)
                          if (isPermission104) {
                            const recordDate = new Date(record.date);
                            const dayOfWeek = recordDate.getDay();
                            // IMPORTANTE: usa Number() per confronto robusto (evita problemi string vs number)
                            const daySchedule = workSchedules.find(schedule =>
                              Number(schedule.day_of_week) === Number(dayOfWeek) && schedule.is_working_day
                            );

                            if (daySchedule && daySchedule.start_time && daySchedule.end_time) {
                              const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
                              const [endHour, endMin] = daySchedule.end_time.split(':').map(Number);
                              // IMPORTANTE: usa break_duration dal database, non default (0 se è 0!)
                              const breakDuration = daySchedule.break_duration !== null && daySchedule.break_duration !== undefined ? daySchedule.break_duration : 0;
                              const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                              const workMinutes = Math.max(0, totalMinutes - breakDuration);
                              const expectedHoursFromSchedule = workMinutes / 60;
                              console.log(`🔵 [Presenze MOBILE] Permesso 104 ${isToday ? '(OGGI)' : '(PASSATO)'} - Data: ${record.date}, Giorno: ${dayOfWeek}`);
                              console.log(`🔵 [Presenze MOBILE] Schedule: ${daySchedule.start_time}-${daySchedule.end_time}, break: ${breakDuration}min = ${expectedHoursFromSchedule.toFixed(2)}h`);
                              return formatHours(expectedHoursFromSchedule);
                            } else {
                              // Se non trovi lo schedule, usa i dati real-time o dal database come fallback
                              console.warn(`⚠️ [Presenze MOBILE] Permesso 104 ma schedule non trovato per giorno ${dayOfWeek} (data: ${record.date})`);
                            }
                          }

                          // PRIORITÀ 2: Se è oggi (senza permesso 104), usa SEMPRE i dati real-time
                          if (isToday && currentHours?.isWorkingDay) {
                            // Usa contractHours se disponibile, altrimenti expectedHours, altrimenti dal record
                            const expectedHours = currentHours.contractHours ?? currentHours.expectedHours ?? record.expected_hours ?? 0;
                            return formatHours(expectedHours);
                          }

                          // PRIORITÀ 3: Altrimenti usa i dati dal database
                          return formatHours(record.expected_hours || 0);
                        })()}
                      </div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-slate-400 text-[10px] sm:text-xs mb-1">Effettive</div>
                      <div className="font-mono text-white text-xs sm:text-sm font-semibold">{formatHours(record.date === today && currentHours?.isWorkingDay ? (currentHours.actualHours || 0) : (record.actual_hours || 0))}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-slate-400 text-[10px] sm:text-xs mb-1">Mancanti</div>
                      {(() => {
                        const deficit = getDisplayedDeficit(record);
                        return (
                          <div className={`font-bold text-xs sm:text-sm ${deficit > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                            {deficit > 0 ? formatHours(deficit) : '0h 0m'}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => handleViewAttendanceDetails(record)}
                      className="w-full py-2 px-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 text-xs sm:text-sm rounded-lg transition-colors border border-green-500/30 touch-manipulation min-h-[44px] flex items-center justify-center"
                    >
                      Dettagli
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Desktop Table */}
          <div className="overflow-x-auto hidden lg:block mt-2">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 whitespace-nowrap">Data</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Stato</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Ore Attese</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Ore Effettive</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Ore Mancanti</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Filtra per mese/anno selezionato
                  const filteredAttendance = attendance.filter(record => {
                    const recordDate = new Date(record.date);
                    return recordDate.getMonth() + 1 === selectedMonth && recordDate.getFullYear() === selectedYear;
                  });

                  const today = new Date().toISOString().split('T')[0];
                  const todayDate = new Date();
                  const isCurrentMonth = selectedMonth === todayDate.getMonth() + 1 && selectedYear === todayDate.getFullYear();
                  const todayExists = filteredAttendance.some(record => record.date === today);

                  let combinedAttendance = [...filteredAttendance];

                  // Aggiungi oggi solo se siamo nel mese/anno corrente
                  if (isCurrentMonth && !todayExists) {
                    const todayRecord = {
                      id: 'today-realtime',
                      date: today,
                      actual_hours: currentHours.actualHours,
                      expected_hours: currentHours.contractHours || currentHours.expectedHours,
                      balance_hours: currentHours.balanceHours,
                      status: currentHours.status
                    };
                    combinedAttendance = [todayRecord, ...combinedAttendance];
                  }

                  // Se esiste già un record per oggi nel database, aggiorna sempre con i dati real-time
                  if (isCurrentMonth && todayExists) {
                    combinedAttendance = combinedAttendance.map(record => {
                      if (record.date === today && currentHours?.isWorkingDay) {
                        return {
                          ...record,
                          expected_hours: currentHours.contractHours || currentHours.expectedHours || 0,
                          actual_hours: currentHours.actualHours || 0,
                          balance_hours: currentHours.balanceHours || 0,
                          status: currentHours.status || 'not_started'
                        };
                      }
                      return record;
                    });
                  }

                  if (combinedAttendance.length === 0) {
                    return (
                      <tr>
                        <td colSpan="6" className="text-center py-8 text-slate-400">
                          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nessun record per {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</p>
                        </td>
                      </tr>
                    );
                  }

                  return combinedAttendance.map((record) => (
                    <tr key={record.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-4">
                        {new Date(record.date).toLocaleDateString('it-IT')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${(() => {
                          const today = new Date().toISOString().split('T')[0];
                          const isToday = record.date === today;
                          const hasPermission = permissionsMap[record.date] || false;
                          
                          // Per oggi, usa direttamente currentHours.status se disponibile
                          if (isToday && currentHours?.status && currentHours?.isWorkingDay) {
                            return getStatusColorFromStatus(currentHours.status, hasPermission);
                          }
                          
                          // Per altri giorni, calcola lo status
                          const statusInfo = computeStatusInfo(record, hasPermission);
                          return statusInfo.badgeClass;
                        })()}`}>
                          {(() => {
                            const today = new Date().toISOString().split('T')[0];
                            const isToday = record.date === today;
                            const hasPermission = permissionsMap[record.date] || false;
                            
                            // Per oggi, usa direttamente currentHours.status se disponibile
                            if (isToday && currentHours?.status && currentHours?.isWorkingDay) {
                              return (
                                <>
                                  {getStatusIcon(currentHours.status)}
                                  <span className="ml-1">{getStatusTextFromStatus(currentHours.status)}</span>
                                </>
                              );
                            }
                            
                            // Per altri giorni, calcola lo status
                            const statusInfo = computeStatusInfo(record, hasPermission);
                            return (
                              <>
                                {statusInfo.icon}
                                <span className="ml-1">{statusInfo.text}</span>
                              </>
                            );
                          })()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          const isToday = record.date === today;
                          const isPermission104 = hasPermission104(record.date) || record.status === 'permission_104' || record.status === 'Assente (Giustificato)' || getStatusText(record).includes('104');

                          // PRIORITÀ 1: Se c'è un permesso 104 (oggi o passato), ricalcola SEMPRE dallo schedule (non usare DB o real-time)
                          if (isPermission104) {
                            const recordDate = new Date(record.date);
                            const dayOfWeek = recordDate.getDay();
                            // IMPORTANTE: usa Number() per confronto robusto (evita problemi string vs number)
                            const daySchedule = workSchedules.find(schedule =>
                              Number(schedule.day_of_week) === Number(dayOfWeek) && schedule.is_working_day
                            );

                            if (daySchedule && daySchedule.start_time && daySchedule.end_time) {
                              const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
                              const [endHour, endMin] = daySchedule.end_time.split(':').map(Number);
                              // IMPORTANTE: usa break_duration dal database, non default (0 se è 0!)
                              const breakDuration = daySchedule.break_duration !== null && daySchedule.break_duration !== undefined ? daySchedule.break_duration : 0;
                              const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                              const workMinutes = Math.max(0, totalMinutes - breakDuration);
                              const expectedHoursFromSchedule = workMinutes / 60;
                              console.log(`🔵 [Presenze] Permesso 104 ${isToday ? '(OGGI)' : '(PASSATO)'} - Data: ${record.date}, Giorno: ${dayOfWeek} (${dayOfWeek === 1 ? 'LUN' : dayOfWeek === 2 ? 'MAR' : dayOfWeek === 3 ? 'MER' : dayOfWeek === 4 ? 'GIO' : dayOfWeek === 5 ? 'VEN' : dayOfWeek === 6 ? 'SAB' : 'DOM'})`);
                              console.log(`🔵 [Presenze] Schedule trovato: ${daySchedule.start_time}-${daySchedule.end_time}, break: ${breakDuration}min, work_type: ${daySchedule.work_type}`);
                              console.log(`🔵 [Presenze] Calcolo: (${endHour * 60 + endMin} - ${startHour * 60 + startMin}) - ${breakDuration} = ${workMinutes} min = ${expectedHoursFromSchedule.toFixed(2)}h`);
                              return formatHours(expectedHoursFromSchedule);
                            } else {
                              // Se non trovi lo schedule, usa i dati real-time o dal database come fallback
                              console.warn(`⚠️ [Presenze] Permesso 104 ma schedule non trovato per giorno ${dayOfWeek} (data: ${record.date})`);
                              console.warn(`⚠️ [Presenze] Work schedules disponibili:`, workSchedules.map(s => ({ day: s.day_of_week, working: s.is_working_day, start: s.start_time, end: s.end_time })));
                            }
                          }

                          // PRIORITÀ 2: Se è oggi (senza permesso 104), usa SEMPRE i dati real-time
                          if (isToday && currentHours?.isWorkingDay) {
                            // Usa contractHours se disponibile, altrimenti expectedHours, altrimenti dal record
                            const expectedHours = currentHours.contractHours ?? currentHours.expectedHours ?? record.expected_hours ?? 0;
                            return formatHours(expectedHours);
                          }

                          // PRIORITÀ 3: Altrimenti usa i dati dal database
                          return formatHours(record.expected_hours || 0);
                        })()}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {(() => {
                          // Se è oggi, usa SEMPRE i dati real-time
                          const today = new Date().toISOString().split('T')[0];
                          if (record.date === today && currentHours?.isWorkingDay && currentHours?.actualHours !== undefined) {
                            return formatHours(currentHours.actualHours);
                          }
                          // Altrimenti usa i dati dal database
                          return formatHours(record.actual_hours || 0);
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const deficit = getDisplayedDeficit(record);
                          return (
                            <span className={`font-bold ${deficit > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                              {deficit > 0 ? formatHours(deficit) : '0h 0m'}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleViewAttendanceDetails(record)}
                          className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Visualizza dettagli presenze"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-300 mb-3 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Come Funziona il Sistema
          </h3>
          <div className="text-slate-300 space-y-2">
            <p>• <strong>Presenza Automatica:</strong> Sei considerato presente in base al tuo orario di lavoro</p>
            <p>• <strong>Monte Ore:</strong> Parti da 0 ore e accumuli ore positive (straordinari) o negative (deficit)</p>
            <p>• <strong>Assenze:</strong> Solo quando hai richieste di permesso/malattia/ferie approvate</p>
            <p>• <strong>Gestione Admin:</strong> Gli amministratori possono modificare ore effettive e contrassegnare straordinari</p>
          </div>
        </div>

        {/* Modal Dettagli Presenze */}
        {showAttendanceDetails && selectedAttendanceDetails && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAttendanceDetails(false);
                setSelectedAttendanceDetails(null);
              }
            }}
          >
            <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Dettagli Presenze - {new Date(selectedAttendanceDetails.summary.date).toLocaleDateString('it-IT')}
                </h2>
                <button
                  onClick={() => {
                    setShowAttendanceDetails(false);
                    setSelectedAttendanceDetails(null);
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              {selectedAttendanceDetails.summary ? (
                <div className="space-y-4">
                  {/* Riepilogo principale */}
                  <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                    <h3 className="text-xl font-semibold text-white mb-4">Riepilogo Giornata</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-sm text-slate-400">Dipendente</p>
                        <p className="text-lg font-bold text-white">
                          {selectedAttendanceDetails.summary.employee}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-400">Ore Attese</p>
                        <p className="text-lg font-bold text-blue-400">
                          {selectedAttendanceDetails.summary.expectedHours}h
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-400">Ore Effettive</p>
                        <p className="text-lg font-bold text-green-400">
                          {selectedAttendanceDetails.summary.actualHours}h
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-400">Saldo Ore</p>
                        <p className={`text-lg font-bold ${selectedAttendanceDetails.summary.balanceHours >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedAttendanceDetails.summary.balanceHours >= 0 ? '+' : ''}{selectedAttendanceDetails.summary.balanceHours}h
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-600 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-slate-400">Stato:</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedAttendanceDetails.summary.statusBadgeClass
                            || computeStatusInfo(selectedAttendanceDetails.attendance).badgeClass
                            }`}>
                            {selectedAttendanceDetails.summary.status}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400">
                          Data: {new Date(selectedAttendanceDetails.summary.date).toLocaleDateString('it-IT')}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Orario di lavoro */}
                  {selectedAttendanceDetails.schedule && (
                    <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                      <h3 className="text-lg font-semibold text-white mb-3">Orario di Lavoro</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-slate-400">Inizio</p>
                          <p className="text-lg font-bold text-white">
                            {selectedAttendanceDetails.schedule.start_time.substring(0, 5)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-slate-400">Fine</p>
                          <p className="text-lg font-bold text-white">
                            {selectedAttendanceDetails.schedule.end_time.substring(0, 5)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-slate-400">Pausa</p>
                          <p className="text-lg font-bold text-white">
                            {selectedAttendanceDetails.schedule.break_duration} min
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">Nessun dettaglio disponibile per questa data</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;