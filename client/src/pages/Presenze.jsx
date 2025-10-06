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
  const [updatingHours, setUpdatingHours] = useState(false);
  const [kpiData, setKpiData] = useState({
    monthlyHours: 0,
    overtime: 0,
    deficit: 0,
    workingDays: 0
  });

  useEffect(() => {
    // Carica i dati e calcola le ore in tempo reale
    const initializeData = async () => {
      console.log('🔄 Initializing with real-time calculation...');
      
      // 1. Carica i dati di base
      await Promise.all([
        fetchAttendance(),
        fetchHoursBalance(),
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
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      // Ricalcola le ore ogni minuto
      calculateRealTimeHours();
    }, 60000); // Ogni minuto
    
    // RIMOSSO: Aggiornamento database automatico (causa errori 403)
    // Il calcolo è ora completamente lato frontend
    
    // Aggiorna tutti i dati ogni 5 minuti per evitare problemi di refresh
    const refreshTimer = setInterval(() => {
      fetchAttendance();
      fetchHoursBalance();
    }, 300000); // 5 minuti
    
    // Aggiorna quando la finestra torna in focus (navigazione)
    const handleFocus = () => {
      console.log('🔄 Window focused - recalculating hours...');
      
      // Ricalcola immediatamente le ore in tempo reale
      calculateRealTimeHours();
      
      console.log('✅ Hours recalculated on focus');
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Calcola KPI quando cambiano i dati di attendance
  useEffect(() => {
    if (attendance.length > 0) {
      calculateKPIs();
    }
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

  const calculateKPIs = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Filtra i record del mese corrente
    const monthlyRecords = attendance.filter(record => {
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

    setKpiData({
      monthlyHours: totalMonthlyHours,
      overtime: overtime,
      deficit: deficit,
      workingDays: workingDays
    });
  };

  // Calcolo DINAMICO delle ore in tempo reale per ogni dipendente
  const calculateRealTimeHours = () => {
    console.log('🔄 calculateRealTimeHours called');
    console.log('📋 workSchedules:', workSchedules);
    
    if (!workSchedules || workSchedules.length === 0) {
      console.log('⚠️ No work schedules available');
      return;
    }

    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
    console.log(`🕐 Calcolo dinamico: ora attuale ${currentTime}, giorno ${dayOfWeek}`);

    // Trova l'orario di lavoro per oggi
    const todaySchedule = workSchedules.find(schedule => 
      schedule.day_of_week === dayOfWeek && schedule.is_working_day
    );

    if (!todaySchedule) {
      console.log('⚠️ No working schedule for today');
      return;
    }

    const { start_time, end_time, break_duration } = todaySchedule;
    console.log(`📋 Orario dipendente: ${start_time} - ${end_time}, pausa: ${break_duration}min`);

    // Converte orari in numeri per calcoli
    const [startHour, startMin] = start_time.split(':').map(Number);
    const [endHour, endMin] = end_time.split(':').map(Number);
    const breakDuration = break_duration || 60; // minuti

    // Calcola ore attese totali
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const workMinutes = totalMinutes - breakDuration;
    const expectedHours = workMinutes / 60;

    let actualHours = 0;
    let status = 'not_started';
    let remainingHours = 0;

    // Se è prima dell'inizio
    if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
      actualHours = 0;
      status = 'not_started';
      remainingHours = expectedHours;
    }
    // Se è dopo la fine
    else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
      actualHours = expectedHours;
      status = 'completed';
      remainingHours = 0;
    }
    // Se è durante l'orario di lavoro
    else {
      // Calcola ore lavorate fino ad ora
      let totalMinutesWorked = 0;
      
      // Calcola minuti dall'inizio
      const minutesFromStart = (currentHour - startHour) * 60 + (currentMinute - startMin);
      
      // Calcola l'orario di pausa (metà giornata)
      const halfDayMinutes = workMinutes / 2;
      const breakStartMinutes = halfDayMinutes;
      const breakEndMinutes = halfDayMinutes + breakDuration;
      
      if (minutesFromStart < breakStartMinutes) {
        // Prima della pausa
        totalMinutesWorked = minutesFromStart;
        status = 'working';
      } else if (minutesFromStart >= breakStartMinutes && minutesFromStart < breakEndMinutes) {
        // Durante la pausa
        totalMinutesWorked = breakStartMinutes;
        status = 'on_break';
      } else {
        // Dopo la pausa
        const morningMinutes = breakStartMinutes;
        const afternoonMinutes = minutesFromStart - breakEndMinutes;
        totalMinutesWorked = morningMinutes + afternoonMinutes;
        status = 'working';
      }
      
      actualHours = totalMinutesWorked / 60;
      remainingHours = expectedHours - actualHours;
    }

    console.log(`📊 Calcolo dipendente: ${actualHours.toFixed(1)}h lavorate, ${remainingHours.toFixed(1)}h rimanenti, status: ${status}`);

    // Aggiorna lo stato
    setCurrentHours({
      isWorkingDay: true,
      schedule: {
        start_time,
        end_time,
        break_duration: breakDuration
      },
      currentTime,
      expectedHours: Math.round(expectedHours * 10) / 10,
      actualHours: Math.round(actualHours * 10) / 10,
      balanceHours: Math.round((actualHours - expectedHours) * 10) / 10,
      status,
      progress: Math.min((actualHours / expectedHours) * 100, 100)
    });

    // Aggiorna anche i dati di attendance per oggi
    const today = now.toISOString().split('T')[0];
    if (attendance.length > 0) {
      const updatedAttendance = attendance.map(record => 
        record.date === today 
          ? { 
              ...record, 
              actual_hours: Math.round(actualHours * 10) / 10, 
              balance_hours: Math.round((actualHours - expectedHours) * 10) / 10 
            }
          : record
      );
      setAttendance(updatedAttendance);
      
      // Ricalcola i KPI dopo aver aggiornato le ore
      console.log('🔄 Recalculating KPIs after hour update...');
      calculateKPIs(updatedAttendance);
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
        employee: `${user.first_name} ${user.last_name}`,
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
        notes: `Aggiornato alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - Sistema real-time`
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
    const m = Math.round((Math.abs(hours) - h) * 60);
    return `${hours < 0 ? '-' : ''}${h}h ${m}m`;
  };

  const getStatusColor = (record) => {
    if (record.is_absent) return 'text-red-400';
    if (record.expected_hours === 0) return 'text-gray-400';
    return 'text-green-400';
  };

  const getStatusText = (record) => {
    if (record.is_absent) return 'Assente';
    if (record.expected_hours === 0) return 'Non lavorativo';
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* TOTALE ORE LAVORATE */}
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">TOTALE ORE LAVORATE</p>
                <p className="text-2xl font-bold text-blue-400">
                  {formatHours(currentHours?.actualHours || 0)}
                </p>
              </div>
              <div className="p-3 rounded-full text-blue-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* MONTE ORE */}
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">MONTE ORE</p>
                <p className={`text-2xl font-bold ${(currentHours?.balanceHours || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(currentHours?.balanceHours || 0) >= 0 ? '+' : ''}{formatHours(currentHours?.balanceHours || 0)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {(currentHours?.balanceHours || 0) >= 0 ? 'Credito' : 'Debito'}
                </p>
              </div>
              <div className={`p-3 rounded-full ${(currentHours?.balanceHours || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(currentHours?.balanceHours || 0) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
            </div>
          </div>

          {/* Giorni Lavorativi */}
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Giorni Lavorativi</p>
                <p className="text-2xl font-bold text-purple-400">
                  {attendance.filter(record => (record.actual_hours || 0) > 0).length}
                </p>
              </div>
              <div className="p-3 rounded-full text-purple-400">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Today's Status */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Stato Oggi
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Orario di Lavoro */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Orario di Lavoro</h3>
              {todaySchedule && todaySchedule.is_working_day ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inizio:</span>
                    <span className="font-mono">{todaySchedule.start_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fine:</span>
                    <span className="font-mono">{todaySchedule.end_time}</span>
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
                  {currentHours && (
                    <div className="flex justify-between border-t border-slate-700 pt-2">
                      <span className="text-slate-400">Ore Correnti:</span>
                      <span className="font-bold text-blue-400">
                        {formatHours(currentHours?.actualHours || 0)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-400">
                  <p>Giorno non lavorativo</p>
                </div>
              )}
            </div>

            {/* Stato Presenza */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Stato Presenza</h3>
              {todayAttendance ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Stato:</span>
                    <span className={`font-semibold ${getStatusColor(todayAttendance)}`}>
                      {getStatusText(todayAttendance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ore Attese:</span>
                    <span className="font-mono">{formatHours(todayAttendance.expected_hours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ore Effettive:</span>
                    <span className="font-mono">{formatHours(todayAttendance.actual_hours)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-700 pt-2">
                    <span className="text-slate-400">Ore Mancanti:</span>
                    <span className={`font-bold ${getBalanceColor(todayAttendance.balance_hours)}`}>
                      {todayAttendance.balance_hours < 0 ? formatHours(Math.abs(todayAttendance.balance_hours)) : '0h 0m'}
                    </span>
                  </div>
                  {todayAttendance.balance_hours < 0 && (
                    <div className="text-xs text-slate-400 mt-2 p-2 bg-slate-800 rounded">
                      💡 Mancano {formatHours(Math.abs(todayAttendance.balance_hours))} per completare la giornata
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
              ) : (
                <div className="text-slate-400">
                  <p>Nessun record per oggi</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance History */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Cronologia Presenze
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4">Data</th>
                  <th className="text-left py-3 px-4">Stato</th>
                  <th className="text-left py-3 px-4">Ore Attese</th>
                  <th className="text-left py-3 px-4">Ore Effettive</th>
                  <th className="text-left py-3 px-4">Ore Mancanti</th>
                  <th className="text-left py-3 px-4">Note</th>
                  <th className="text-left py-3 px-4">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {attendance.slice(0, 10).map((record) => (
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
                      {formatHours(record.actual_hours)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${getBalanceColor(record.balance_hours)}`}>
                        {record.balance_hours < 0 ? formatHours(Math.abs(record.balance_hours)) : '0h 0m'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {record.notes || '-'}
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
                ))}
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
                      
                      {selectedAttendanceDetails.summary.notes && (
                        <div className="mt-3 p-3 bg-slate-800 rounded border border-slate-600">
                          <p className="text-sm text-slate-300">
                            <strong>Note:</strong> {selectedAttendanceDetails.summary.notes}
                          </p>
                        </div>
                      )}
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
                            {selectedAttendanceDetails.schedule.start_time}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-slate-400">Fine</p>
                          <p className="text-lg font-bold text-white">
                            {selectedAttendanceDetails.schedule.end_time}
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