import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { Clock, Calendar, CheckCircle, XCircle, TrendingUp, TrendingDown, Users, AlertCircle, Eye } from 'lucide-react';

const Attendance = () => {
  const { user, apiCall } = useAuthStore();
  const [attendance, setAttendance] = useState([]);
  const [hoursBalance, setHoursBalance] = useState({
    total_worked: 0,
    monte_ore: 0,
    working_days: 0,
    absent_days: 0
  });
  const [workSchedules, setWorkSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAttendanceDetails, setShowAttendanceDetails] = useState(false);
  const [selectedAttendanceDetails, setSelectedAttendanceDetails] = useState(null);

  const [currentHours, setCurrentHours] = useState({
    isWorkingDay: false,
    schedule: { start_time: '09:00', end_time: '18:00', break_duration: 60 },
    currentTime: '00:00',
    expectedHours: 0,
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
  
  // Test mode state
  const [testMode, setTestMode] = useState(false);
  const [testTime, setTestTime] = useState('17:00');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    // Carica i dati e calcola le ore in tempo reale
    const initializeData = async () => {
      console.log('🔄 Initializing with real-time calculation...');
      
      // 1. Carica i dati di base
      await Promise.all([
        fetchAttendance(),
        fetchHoursBalance(),
        fetchTotalBalance(),
        fetchWorkSchedules()
      ]);
      
      // 2. Calcola IMMEDIATAMENTE le ore in tempo reale
      console.log('🔄 Forcing immediate real-time calculation...');
      calculateRealTimeHours();
      
      // 3. Ricalcola anche dopo un breve delay per sicurezza
      setTimeout(() => {
        console.log('🔄 Secondary real-time calculation...');
        calculateRealTimeHours();
      }, 500);
      
      console.log('✅ Data loaded with real-time calculation');
    };
    
    initializeData();
    
    // Timer per calcoli real-time ogni minuto
    const realTimeTimer = setInterval(() => {
      setCurrentTime(new Date());
      calculateRealTimeHours();
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
    const syncInterval = setInterval(() => {
      console.log('🔄 Employee sync polling...');
      fetchAttendance();
      fetchHoursBalance();
      // Evita reload continuo degli orari (statici)
      // fetchWorkSchedules();
      calculateRealTimeHours();
    }, 60000); // 60 secondi
    
    // Aggiorna quando la finestra torna in focus (navigazione)
    const handleFocus = () => {
      console.log('🔄 Window focused - recalculating hours...');
      
      // Ricalcola immediatamente le ore in tempo reale
      calculateRealTimeHours();
      
      console.log('✅ Hours recalculated on focus');
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

  // Calcola KPI quando cambiano i dati di attendance
  useEffect(() => {
    // Calcola sempre i KPI, anche se non ci sono record (per il sistema ibrido)
    calculateKPIs(attendance);
  }, [attendance]);

  // Ricalcola le ore real-time quando cambiano i work schedules
  useEffect(() => {
    if (workSchedules.length > 0) {
      calculateRealTimeHours();
    }
  }, [workSchedules]);

  const fetchAttendance = async () => {
    try {
      const response = await apiCall('/api/attendance');
      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      } else {
        console.error('Attendance fetch failed:', response.status);
        setAttendance([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
    } finally {
      setLoading(false);
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

  const fetchTotalBalance = async () => {
    try {
      const response = await apiCall('/api/attendance/total-balance');
      if (response.ok) {
        const data = await response.json();
        setTotalBalance(data.totalBalanceHours || 0);
        console.log('💰 Total balance loaded:', data.totalBalanceHours);
      }
    } catch (error) {
      console.error('Error fetching total balance:', error);
    }
  };


  const fetchWorkSchedules = async () => {
    try {
      const response = await apiCall('/api/work-schedules');
      if (response.ok) {
        const data = await response.json();
        setWorkSchedules(data);
      }
    } catch (error) {
      console.error('Error fetching work schedules:', error);
    }
  };

  const calculateKPIs = (attendanceData = attendance) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    console.log('🔄 Calculating KPIs with data:', attendanceData?.length || 0, 'records');
    
    // Filtra i record del mese corrente
    const monthlyRecords = (attendanceData || []).filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });

    // Calcola ore totali del mese
    const totalMonthlyHours = monthlyRecords.reduce((sum, record) => sum + (record.actual_hours || 0), 0);
    
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

  // Calcolo DINAMICO delle ore in tempo reale usando l'endpoint backend
  const calculateRealTimeHours = async () => {
    console.log('🔄 calculateRealTimeHours called (using API endpoint)');
    
    try {
      const response = await apiCall('/api/attendance/current-hours');
      
      if (response.ok) {
        const data = await response.json();
        
        if (!data.isWorkingDay) {
          setCurrentHours({
            isWorkingDay: false,
            schedule: { start_time: '09:00', end_time: '18:00', break_duration: 60 },
            currentTime: data.currentTime || '00:00',
            expectedHours: 0,
            actualHours: 0,
            balanceHours: 0,
            status: 'not_started',
            progress: 0
          });
          return;
        }
        
        // Calcola ore rimanenti
        const remainingHours = Math.max(0, data.expectedHours - data.actualHours);
        
        console.log(`📊 API calculation: ${data.actualHours.toFixed(2)}h lavorate, ${remainingHours.toFixed(2)}h rimanenti, status: ${data.status}`);
        
        // Calcola i dati finali
        const finalActualHours = Math.round(data.actualHours * 10) / 10;
        const finalExpectedHours = Math.round(data.expectedHours * 10) / 10;
        const finalBalanceHours = Math.round(data.balanceHours * 10) / 10;

        const now = new Date();
        
        // Aggiorna la cache locale
        setLocalCache(prev => ({
          ...prev,
          lastCalculation: now,
          pendingSave: prev.pendingSave || (now.getMinutes() === 0 && finalActualHours > 0) // Salva ogni ora in punto
        }));

        // Aggiorna lo stato con cache
        setCurrentHours({
          isWorkingDay: true,
          schedule: {
            start_time: data.schedule?.start_time || '09:00',
            end_time: data.schedule?.end_time || '18:00',
            break_duration: data.schedule?.break_duration || 60
          },
          currentTime: data.currentTime || now.toTimeString().substring(0, 5),
          expectedHours: finalExpectedHours,
          actualHours: finalActualHours,
          balanceHours: finalBalanceHours,
          status: data.status || 'working',
          progress: Math.min((finalActualHours / finalExpectedHours) * 100, 100)
        });

        // Aggiorna anche i dati di attendance per oggi
        const today = now.toISOString().split('T')[0];
        let updatedAttendance;
        
        if (attendance.length > 0) {
          // Se ci sono già record, aggiorna quello di oggi
          updatedAttendance = attendance.map(record => 
            record.date === today 
              ? { 
                  ...record, 
                  actual_hours: finalActualHours, 
                  balance_hours: finalBalanceHours 
                }
              : record
          );
        } else {
          // Se non ci sono record, crea un record virtuale per oggi
          updatedAttendance = [{
            id: `virtual-${today}`,
            user_id: user?.id,
            date: today,
            expected_hours: finalExpectedHours,
            actual_hours: finalActualHours,
            balance_hours: finalBalanceHours,
            notes: 'Presenza automatica per orario',
            created_at: now.toISOString(),
            updated_at: now.toISOString()
          }];
        }
        
        setAttendance(updatedAttendance);
        
        // Ricalcola i KPI dopo aver aggiornato le ore
        console.log('🔄 Recalculating KPIs after hour update...');
        calculateKPIs(updatedAttendance);

        // Controlla se è il momento di salvare (ogni ora in punto)
        if (now.getMinutes() === 0 && finalActualHours > 0) {
          const lastSave = localCache.lastHourlySave;
          if (!lastSave || (now.getTime() - lastSave.getTime()) >= 3600000) {
            console.log('⏰ Time for hourly save:', finalActualHours, 'hours');
            saveHourlyAttendance();
          }
        }
      } else {
        console.error('❌ Failed to fetch current hours:', response.status);
      }
    } catch (error) {
      console.error('❌ Error calculating real-time hours:', error);
      // Se l'API fallisce, non fare nulla (mantieni i dati esistenti)
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
          expectedHours: currentHours.expectedHours,
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
          expectedHours: currentHours.expectedHours,
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
    const todaySchedule = workSchedules.find(schedule => 
      schedule.day_of_week === dayOfWeek && schedule.is_working_day
    );
    
    let realTimeActualHours = 0;
    let realTimeBalanceHours = 0;
    
    if (todaySchedule) {
      const { start_time, end_time, break_duration } = todaySchedule;
      const [startHour, startMin] = start_time.split(':').map(Number);
      const [endHour, endMin] = end_time.split(':').map(Number);
      const breakDuration = break_duration || 60;
      
      // Calcola ore attese totali
      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const workMinutes = totalMinutes - breakDuration;
      const expectedHours = workMinutes / 60;
      
      // Calcola ore effettive real-time
      if (currentHour >= startHour && currentHour <= endHour) {
        // Durante l'orario di lavoro
        const workedMinutes = (currentHour * 60 + currentMinute) - (startHour * 60 + startMin);
        // Sottrai la pausa se siamo dopo le 13:00
        if (currentHour >= 13) {
          realTimeActualHours = Math.max(0, (workedMinutes - breakDuration) / 60);
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
    
    const realTimeData = {
      attendance: record,
      schedule: todaySchedule,
      summary: {
        date: record.date,
        employee: user && user.first_name && user.last_name ? 
          `${user.first_name} ${user.last_name}` : 
          (user && user.email ? user.email.split('@')[0] : 'Dipendente'),
        expectedHours: todaySchedule ? (() => {
          const { start_time, end_time, break_duration } = todaySchedule;
          const [startHour, startMin] = start_time.split(':').map(Number);
          const [endHour, endMin] = end_time.split(':').map(Number);
          const breakDuration = break_duration || 60;
          const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          const workMinutes = totalMinutes - breakDuration;
          return workMinutes / 60;
        })() : 8,
        actualHours: realTimeActualHours,
        balanceHours: realTimeBalanceHours,
        status: realTimeActualHours > 0 ? 'Presente' : 'Assente',
        notes: ''
      }
    };
    
    setSelectedAttendanceDetails(realTimeData);
    setShowAttendanceDetails(true);
  };

  // Test function
  const runTest = async () => {
    setTesting(true);
    try {
      const response = await apiCall(`/api/attendance/test-hours?time=${testTime}&date=${testDate}`);
      if (response.ok) {
        const data = await response.json();
        setTestResult(data);
        console.log('🧪 Test result:', data);
      } else {
        const error = await response.json();
        setTestResult({ error: error.error || 'Errore nel test' });
      }
    } catch (error) {
      console.error('❌ Test error:', error);
      setTestResult({ error: 'Errore nella chiamata API' });
    } finally {
      setTesting(false);
    }
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
    const m = Math.round((Math.abs(hours) - h) * 60);
    return `${hours < 0 ? '-' : ''}${h}h ${m}m`;
  };

  const getStatusColor = (record) => {
    // Assenza giustificata (malattia, ferie, permessi approvati)
    if (record.is_justified_absence) return 'text-yellow-400';
    // Assenza non giustificata
    if (record.is_absent) return 'text-red-400';
    // Giorno non lavorativo
    if (record.expected_hours === 0) return 'text-gray-400';
    // Presente
    return 'text-green-400';
  };

  const getStatusText = (record) => {
    // Assenza giustificata
    if (record.is_justified_absence) {
      const leaveTypeText = {
        'sick_leave': 'Malattia',
        'vacation': 'Ferie',
        'permission': 'Permesso'
      }[record.leave_type] || 'Assente (Giustificato)';
      return `Assente (${leaveTypeText})`;
    }
    // Assenza non giustificata
    if (record.is_absent) return 'Assente';
    // Giorno non lavorativo
    if (record.expected_hours === 0) return 'Non lavorativo';
    // Presente
    return 'Presente';
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

  const getTodaySchedule = () => {
    const today = new Date().getDay();
    return workSchedules.find(schedule => schedule.day_of_week === today);
  };

  const todaySchedule = getTodaySchedule();
  const todayAttendance = attendance.find(record => 
    new Date(record.date).toDateString() === new Date().toDateString()
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Presenze</h1>
          <p className="text-slate-400">
            Sistema automatico basato su orari di lavoro - Monte ore: {formatHours(currentHours?.balanceHours || 0)}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {/* TOTALE ORE LAVORATE */}
          <div className="bg-slate-800 rounded-lg p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-xs sm:text-sm uppercase mb-1">Ore Lavorate</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-400">
                  {formatHours(currentHours?.actualHours || 0)}
                </p>
              </div>
              <div className="hidden sm:block p-3 rounded-full text-blue-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* DA LAVORARE OGGI */}
          <div className="bg-slate-800 rounded-lg p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-xs sm:text-sm uppercase mb-1">Da lavorare oggi</p>
                <p className="text-xl sm:text-2xl font-bold text-green-400">
                  {formatHours(Math.max(0, (currentHours?.expectedHours || 0) - (currentHours?.actualHours || 0)))}
                </p>
              </div>
              <div className="hidden sm:block p-3 rounded-full text-green-400">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* GIORNI LAVORATI */}
          <div className="bg-slate-800 rounded-lg p-3 sm:p-6">
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

          {/* BANCA ORE TOTALE */}
          <div className="bg-slate-800 rounded-lg p-3 sm:p-6 border-2 border-indigo-500/30 col-span-2 sm:col-span-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-xs sm:text-sm font-semibold uppercase mb-1">💰 Banca Ore</p>
                <p className={`text-2xl sm:text-3xl font-bold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalBalance >= 0 ? '+' : ''}{formatHours(totalBalance)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  {totalBalance >= 0 ? 'Credito' : 'Debito'}
                </p>
              </div>
              <div className={`hidden sm:block p-3 rounded-full ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalBalance >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
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
                        {formatHours(todaySchedule.expected_hours || 8)}
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
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
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
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Cronologia Presenze
          </h2>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const todayExists = attendance.some(record => record.date === today);
              let combined = [...attendance];
              if (!todayExists) {
                combined = [{
                  id: 'today-realtime',
                  date: today,
                  actual_hours: currentHours.actualHours,
                  expected_hours: currentHours.expectedHours,
                  balance_hours: currentHours.balanceHours,
                  status: currentHours.status
                }, ...attendance];
              }
              return combined.slice(0, 10).map((record) => (
                <div key={record.id} className="rounded-xl border border-slate-700 p-4 hover:border-slate-500 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">
                      {new Date(record.date).toLocaleDateString('it-IT')}
                    </div>
                    <div className={`text-xs font-bold ${getStatusColor(record)}`}>{getStatusText(record)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-slate-400">Attese</div>
                      <div className="font-mono">{formatHours(record.expected_hours)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Effettive</div>
                      <div className="font-mono">{formatHours(record.date === today ? currentHours.actualHours : (record.actual_hours || 0))}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Mancanti</div>
                      <div className={`font-bold ${getBalanceColor(record.date === today ? currentHours.balanceHours : record.balance_hours)}`}>
                        {(record.date === today ? currentHours.balanceHours : record.balance_hours) < 0
                          ? formatHours(Math.abs(record.date === today ? currentHours.balanceHours : record.balance_hours))
                          : '0h 0m'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-right">
                    <button onClick={() => handleViewAttendanceDetails(record)} className="text-green-400 hover:text-green-300 text-sm">
                      Dettagli
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Desktop Table */}
          <div className="overflow-x-auto hidden lg:block mt-2">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4">Data</th>
                  <th className="text-left py-3 px-4">Stato</th>
                  <th className="text-left py-3 px-4">Ore Attese</th>
                  <th className="text-left py-3 px-4">Ore Effettive</th>
                  <th className="text-left py-3 px-4">Ore Mancanti</th>
                  <th className="text-left py-3 px-4">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Crea un array combinato con i dati del database + oggi (se non esiste)
                  const today = new Date().toISOString().split('T')[0];
                  const todayExists = attendance.some(record => record.date === today);
                  
                  let combinedAttendance = [...attendance];
                  
                  // Se oggi non esiste nel database, aggiungilo usando i dati real-time
                  // Aggiungi sempre oggi se non esiste, anche con 0 ore
                  if (!todayExists) {
                    const todayRecord = {
                      id: 'today-realtime',
                      date: today,
                      actual_hours: currentHours.actualHours,
                      expected_hours: currentHours.expectedHours,
                      balance_hours: currentHours.balanceHours,
                      status: currentHours.status
                    };
                    combinedAttendance = [todayRecord, ...attendance];
                  }
                  
                  return combinedAttendance.slice(0, 10).map((record) => (
                  <tr key={record.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4">
                      {new Date(record.date).toLocaleDateString('it-IT')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${getStatusColor(record)}`}>
                        {getStatusText(record)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {formatHours(record.expected_hours)}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {(() => {
                        // Se è oggi, usa i dati real-time
                        const today = new Date().toISOString().split('T')[0];
                        if (record.date === today && currentHours?.actualHours !== undefined) {
                          return formatHours(currentHours.actualHours);
                        }
                        // Altrimenti usa i dati dal database
                        return formatHours(record.actual_hours || 0);
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${(() => {
                        const today = new Date().toISOString().split('T')[0];
                        if (record.date === today && currentHours?.balanceHours !== undefined) {
                          return getBalanceColor(currentHours.balanceHours);
                        }
                        return getBalanceColor(record.balance_hours);
                      })()}`}>
                        {(() => {
                          // Se è oggi, usa i dati real-time
                          const today = new Date().toISOString().split('T')[0];
                          if (record.date === today && currentHours?.balanceHours !== undefined) {
                            return currentHours.balanceHours < 0 ? formatHours(Math.abs(currentHours.balanceHours)) : '0h 0m';
                          }
                          // Altrimenti usa i dati dal database
                          return record.balance_hours < 0 ? formatHours(Math.abs(record.balance_hours)) : '0h 0m';
                        })()}
                      </span>
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
          
          {attendance.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun record di presenza trovato</p>
            </div>
          )}
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

        {/* Test Mode - Simula orario */}
        <div className="mt-8 bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center">
              <Clock className="h-6 w-6 mr-3 text-indigo-400" />
              Test Calcolo Ore
            </h3>
            <button
              onClick={() => {
                setTestMode(!testMode);
                if (testMode) {
                  setTestResult(null);
                }
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm"
            >
              {testMode ? 'Nascondi' : 'Mostra'}
            </button>
          </div>
          
          {testMode && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Simula un orario specifico per verificare il calcolo delle ore anche fuori dall'orario di lavoro.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Orario Simulato (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={testTime}
                    onChange={(e) => setTestTime(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data (opzionale)
                  </label>
                  <input
                    type="date"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <button
                onClick={runTest}
                disabled={testing}
                className="w-full md:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                {testing ? 'Calcolo...' : 'Calcola Ore'}
              </button>
              
              {testResult && (
                <div className="mt-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
                  {testResult.error ? (
                    <div className="text-red-400">
                      <strong>Errore:</strong> {testResult.error}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-slate-400 text-sm">Ore Attese</p>
                          <p className="text-xl font-bold text-white">{testResult.expectedHours}h</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Ore Lavorate</p>
                          <p className="text-xl font-bold text-blue-400">{testResult.actualHours.toFixed(1)}h</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Saldo</p>
                          <p className={`text-xl font-bold ${testResult.balanceHours >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {testResult.balanceHours >= 0 ? '+' : ''}{testResult.balanceHours.toFixed(1)}h
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-sm">Stato</p>
                          <p className="text-xl font-bold text-indigo-400">{testResult.status}</p>
                        </div>
                      </div>
                      
                      <div className="border-t border-slate-700 pt-4 mt-4">
                        <p className="text-slate-400 text-sm mb-2">
                          <strong>Orario:</strong> {testResult.schedule.start_time} - {testResult.schedule.end_time}
                        </p>
                        <p className="text-slate-400 text-sm mb-2">
                          <strong>Pausa:</strong> {testResult.schedule.break_duration} min
                          {testResult.schedule.break_start_time && ` (${testResult.schedule.break_start_time})`}
                        </p>
                        {testResult.manualCalculation && (
                          <div className="mt-3 p-3 bg-slate-800 rounded">
                            <p className="text-slate-300 text-sm mb-2"><strong>Calcolo Manuale:</strong></p>
                            <p className="text-slate-400 text-xs">Mattina: {testResult.manualCalculation.morning}</p>
                            <p className="text-slate-400 text-xs">Pausa: {testResult.manualCalculation.break}</p>
                            <p className="text-slate-400 text-xs">Pomeriggio: {testResult.manualCalculation.afternoon}</p>
                            <p className="text-slate-300 text-sm mt-2">
                              <strong>Totale Manuale:</strong> {testResult.manualCalculation.manualHours}h
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Dettagli Presenze */}
        {showAttendanceDetails && selectedAttendanceDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            selectedAttendanceDetails.summary.status === 'Presente' 
                              ? 'bg-green-500/20 text-green-300 border border-green-400/30' 
                              : 'bg-red-500/20 text-red-300 border border-red-400/30'
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