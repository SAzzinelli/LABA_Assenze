import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import AttendanceDetails from '../components/AttendanceDetails';
import { 
  Users, 
  AlertCircle, 
  RefreshCw, 
  Edit3, 
  Save, 
  X, 
  Calendar,
  Filter,
  Search,
  Download,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  User,
  CalendarDays,
  BarChart3,
  Settings,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock
} from 'lucide-react';

const AdminAttendance = () => {
  const { user, apiCall } = useAuthStore();
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('currently');
  
  // Stati per cronologia
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stati per modali
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAttendanceDetails, setShowAttendanceDetails] = useState(false);
  const [selectedAttendanceDetails, setSelectedAttendanceDetails] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Stati per editing
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    actual_hours: 0,
    is_overtime: false,
    is_early_departure: false,
    is_late_arrival: false,
    notes: ''
  });

  // Stati per generazione presenze
  const [generateForm, setGenerateForm] = useState({
    startDate: '',
    endDate: '',
    employeeId: ''
  });
  const [generateStep, setGenerateStep] = useState(1); // 1: selezione dipendente, 2: selezione date

  // Statistiche
  const [stats, setStats] = useState({
    workedToday: 0, // Chi ha lavorato oggi
    currentlyPresent: 0, // Chi è fisicamente presente ora
    absentToday: 0 // Chi doveva lavorare ma non ha lavorato
  });

  // Malattie di oggi
  const [sickToday, setSickToday] = useState([]);

  // Real-time updates
  const { emitUpdate } = useRealTimeUpdates({
    onAttendanceUpdate: (data) => {
      console.log('📊 Aggiornamento presenze ricevuto:', data);
      fetchAttendanceData();
      fetchStats();
    },
    onEmployeeUpdate: (data) => {
      console.log('👤 Aggiornamento dipendenti ricevuto:', data);
      fetchEmployees();
      fetchStats();
    }
  });

  useEffect(() => {
    const initializeData = async () => {
      await fetchAttendanceData();
      await fetchEmployees();
      await fetchAllEmployees();
      await fetchWorkSchedules();
      await fetchSickToday();
      await fetchStats();
      
      // Forza un secondo aggiornamento dopo 1 secondo per sicurezza
      setTimeout(() => {
        console.log('🔄 Secondary admin data update...');
        fetchStats();
      }, 1000);
    };
    
    initializeData();
    
    // Polling ogni 30s per sincronizzazione con dipendenti
    const syncInterval = setInterval(() => {
      console.log('🔄 Admin sync polling...');
    fetchAttendanceData();
    fetchEmployees();
      fetchAllEmployees();
      fetchWorkSchedules();
      fetchSickToday();
      calculateRealTimeStats();
    }, 30000);
    
    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAttendanceHistory();
    }
  }, [activeTab, selectedMonth, selectedYear, selectedEmployee]);

  // Ricalcola le statistiche quando cambiano i workSchedules
  useEffect(() => {
    if (workSchedules.length > 0) {
      calculateRealTimeStats();
    }
  }, [workSchedules]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      console.log('🔍 Fetching attendance data for today:', today);
      const response = await apiCall(`/api/attendance?date=${today}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Attendance data for today:', data);
        setAttendance(data);
      }
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttendanceDetails = (record) => {
    setSelectedAttendanceDetails({
      userId: record.user_id,
      date: record.date,
      employeeName: record.users?.first_name + ' ' + record.users?.last_name
    });
    setShowAttendanceDetails(true);
  };

  const fetchEmployees = async () => {
    try {
      const response = await apiCall('/api/attendance/current');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
        console.log('📊 Current attendance loaded for admin:', data.length, 'employees currently working');
      }
    } catch (error) {
      console.error('Error fetching current attendance:', error);
    }
  };

  const fetchAllEmployees = async () => {
    try {
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setAllEmployees(data);
        console.log('👥 All employees loaded for admin:', data.length, 'total employees');
      }
    } catch (error) {
      console.error('Error fetching all employees:', error);
    }
  };

  const fetchWorkSchedules = async () => {
    try {
      console.log('🔄 Fetching work schedules...');
      const response = await apiCall('/api/work-schedules');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Work schedules fetched:', data);
        setWorkSchedules(data);
      } else {
        console.error('❌ Failed to fetch work schedules:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching work schedules:', error);
    }
  };

  const fetchSickToday = async () => {
    try {
      console.log('🔄 Fetching sick leave requests for today...');
      const response = await apiCall('/api/attendance/sick-today');
      if (response.ok) {
        const data = await response.json();
        console.log('🏥 Sick leave requests for today:', data);
        setSickToday(data);
      } else {
        console.error('❌ Failed to fetch sick leave requests:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching sick leave requests:', error);
    }
  };

  // Calcolo real-time unificato (stesso sistema del dipendente)
  const calculateRealTimeStats = () => {
    console.log('🔄 Admin calculating real-time stats...');
    
    if (!workSchedules || workSchedules.length === 0) {
      console.log('⚠️ No work schedules available for admin stats');
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM
    
    let workedToday = 0; // Chi ha lavorato oggi
    let currentlyPresent = 0; // Chi è fisicamente presente ora
    let absentToday = 0; // Chi doveva lavorare ma non ha lavorato
    
    // Usa i workSchedules già caricati invece di fare chiamate API
    const todaySchedules = workSchedules.filter(schedule => 
      schedule.day_of_week === dayOfWeek && schedule.is_working_day
    );
    
    console.log(`📊 Admin stats: ${todaySchedules.length} working schedules today`);
    
    todaySchedules.forEach(schedule => {
      const { start_time, end_time, break_duration } = schedule;
      const [startHour, startMin] = start_time.split(':').map(Number);
      const [endHour, endMin] = end_time.split(':').map(Number);
      const breakDuration = break_duration || 60;
      
      // Calcola ore attese totali
      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const workMinutes = totalMinutes - breakDuration;
      const expectedHours = workMinutes / 60;
      
      // Calcola ore effettive real-time (stesso calcolo del dipendente)
      let actualHours = 0;
      let status = 'not_started';
      
      // Se è prima dell'inizio
      if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
        actualHours = 0;
        status = 'not_started';
      }
      // Se è dopo la fine
      else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
        actualHours = expectedHours;
        status = 'completed';
      }
      // Se è durante l'orario di lavoro
      else {
        // Calcola ore lavorate fino ad ora
        let totalMinutesWorked = 0;
        
        // Calcola minuti dall'inizio
        const minutesFromStart = (currentHour - startHour) * 60 + (currentMinute - startMin);
        
        // Determina se è una giornata completa (ha pausa pranzo) o mezza giornata
        const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const hasLunchBreak = totalWorkMinutes > 300; // Più di 5 ore = giornata completa
        
        if (hasLunchBreak) {
          // GIORNATA COMPLETA: ha pausa pranzo (es. 9:00-18:00)
          const morningEndMinutes = (totalWorkMinutes - breakDuration) / 2; // Fine mattina
          const breakStartMinutes = morningEndMinutes;
          const breakEndMinutes = morningEndMinutes + breakDuration;
          
          if (minutesFromStart < breakStartMinutes) {
            // Prima della pausa pranzo
            totalMinutesWorked = minutesFromStart;
            status = 'working';
          } else if (minutesFromStart >= breakStartMinutes && minutesFromStart < breakEndMinutes) {
            // Durante la pausa pranzo
            totalMinutesWorked = breakStartMinutes;
            status = 'on_break';
          } else {
            // Dopo la pausa pranzo
            const morningMinutes = breakStartMinutes;
            const afternoonMinutes = minutesFromStart - breakEndMinutes;
            totalMinutesWorked = morningMinutes + afternoonMinutes;
            status = 'working';
          }
        } else {
          // MEZZA GIORNATA: non ha pausa pranzo (es. 9:00-13:00)
          totalMinutesWorked = minutesFromStart;
          status = 'working';
        }
        
        actualHours = totalMinutesWorked / 60;
      }
      
      // Aggiorna le statistiche
      if (actualHours > 0) {
        workedToday++;
      }
      
      if (currentTime >= start_time && currentTime <= end_time) {
        currentlyPresent++;
      }
      
      // Se dovrebbe lavorare ma non ha ore effettive
      if (actualHours <= 0 && status !== 'not_started') {
        absentToday++;
      }
    });
    
    console.log(`📊 Admin real-time stats: worked=${workedToday}, present=${currentlyPresent}, absent=${absentToday}`);
    setStats({ workedToday, currentlyPresent, absentToday });
  };

  const fetchStats = () => {
    calculateRealTimeStats();
  };

  const fetchAttendanceHistory = async () => {
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedYear) params.append('year', selectedYear);
      if (selectedEmployee) params.append('userId', selectedEmployee);
      
      const response = await apiCall(`/api/attendance?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAttendanceHistory(data);
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    const date = new Date(timeString);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return '0h 0m';
    const h = Math.floor(Math.abs(hours));
    const m = Math.round((Math.abs(hours) - h) * 60);
    return `${hours < 0 ? '-' : ''}${h}h ${m}m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-900 text-green-100 border-green-700';
      case 'completed': return 'bg-green-800 text-green-200 border-green-600';
      case 'working': return 'bg-orange-900 text-orange-100 border-orange-700';
      case 'not_started': return 'bg-yellow-900 text-yellow-100 border-yellow-700';
      case 'absent': return 'bg-red-900 text-red-100 border-red-700';
      case 'sick_leave': return 'bg-red-900 text-red-100 border-red-700';
      case 'holiday': return 'bg-blue-900 text-blue-100 border-blue-700';
      case 'non_working_day': return 'bg-gray-900 text-gray-100 border-gray-700';
      default: return 'bg-gray-900 text-gray-100 border-gray-700';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'present': return 'Presente';
      case 'working': return 'Al lavoro';
      case 'completed': return 'Giornata terminata';
      case 'not_started': return 'Non iniziato';
      case 'absent': return 'Assente';
      case 'sick_leave': return 'In malattia';
      case 'holiday': return 'Festivo';
      case 'non_working_day': return 'Non lavorativo';
      default: return 'Sconosciuto';
    }
  };

  // Calcola le ore real-time per un employee ID
  const calculateRealTimeHoursForEmployee = (employeeId) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
    // Trova l'orario di lavoro per questo dipendente
    const workSchedule = workSchedules.find(schedule => 
      schedule.user_id === employeeId && 
      schedule.day_of_week === dayOfWeek && 
      schedule.is_working_day === true
    );
    
    if (!workSchedule) {
      return {
        actualHours: 0,
        expectedHours: 0,
        balanceHours: 0,
        status: 'not_working',
        isPresent: false
      };
    }
    
    const startHour = parseInt(workSchedule.start_time.split(':')[0]);
    const startMin = parseInt(workSchedule.start_time.split(':')[1]);
    const endHour = parseInt(workSchedule.end_time.split(':')[0]);
    const endMin = parseInt(workSchedule.end_time.split(':')[1]);
    
    const totalWorkMinutes = (endHour * 60 + endMin - startHour * 60 - startMin);
    const hasLunchBreak = totalWorkMinutes > 300; // 5 ore = 300 minuti
    const expectedHours = hasLunchBreak ? (totalWorkMinutes - 60) / 60 : totalWorkMinutes / 60; // Sottrai 1 ora di pausa pranzo
    let actualHours = 0;
    let status = 'not_started';
    
    if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
      actualHours = 0;
      status = 'not_started';
    } else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
      actualHours = expectedHours;
      status = 'completed';
    } else {
      // Durante l'orario di lavoro - calcola con logica pausa pranzo
      const minutesFromStart = (currentHour - startHour) * 60 + (currentMinute - startMin);
      const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const hasLunchBreak = totalWorkMinutes > 300; // 5 ore = 300 minuti
      
      if (hasLunchBreak) {
        const lunchBreakMinutes = 60; // 1 ora di pausa
        const effectiveWorkMinutes = totalWorkMinutes - lunchBreakMinutes;
        
        if (minutesFromStart <= effectiveWorkMinutes) {
          actualHours = minutesFromStart / 60;
          status = 'working';
        } else {
          actualHours = effectiveWorkMinutes / 60;
          status = 'on_break';
        }
      } else {
        actualHours = minutesFromStart / 60;
        status = 'working';
      }
    }
    
    const balanceHours = actualHours - expectedHours;
    
    return {
      actualHours: Math.round(actualHours * 100) / 100,
      expectedHours: Math.round(expectedHours * 100) / 100,
      balanceHours: Math.round(balanceHours * 100) / 100,
      status: status,
      isPresent: status === 'working' || status === 'on_break'
    };
  };

  // Calcola le ore real-time per un record
  const calculateRealTimeHoursForRecord = (record) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const recordDate = record.date;
    
    // Converti le date in oggetti Date per confronto corretto
    const todayDate = new Date(today);
    const recordDateObj = new Date(recordDate);
    const isPast = recordDateObj < todayDate;
    const isToday = recordDate === today;
    const isFuture = recordDateObj > todayDate;
    
    // Se è oggi, controlla prima se è in malattia (PRIORITÀ MASSIMA)
    if (isToday) {
      console.log('🔍 Checking sick leave for user:', record.user_id);
      console.log('🔍 Sick today data:', sickToday);
      
      const isSickToday = sickToday.some(sickRequest => 
        sickRequest.user_id === record.user_id &&
        new Date(sickRequest.start_date) <= new Date(today) &&
        new Date(sickRequest.end_date) >= new Date(today)
      );
      
      console.log('🔍 Is sick today result:', isSickToday);
      
      if (isSickToday) {
        console.log('🏥 User is sick today:', record.user_id);
        return {
          expectedHours: 0,
          actualHours: 0,
          balanceHours: 0,
          status: 'sick_leave',
          isPresent: false
        };
      }
    }
    
    console.log('🔍 Debug calculateRealTimeHoursForRecord:', {
      recordUserId: record.user_id,
      recordDate,
      today,
      recordDateObj: recordDateObj.toISOString().split('T')[0],
      todayDate: todayDate.toISOString().split('T')[0],
      isToday,
      isPast,
      isFuture,
      recordActualHours: record.actual_hours,
      recordExpectedHours: record.expected_hours
    });
    
    // PER GIORNI PASSATI: usa i dati del database
    if (isPast) {
      console.log('📅 Giorno passato - uso dati DB:', {
        actualHours: record.actual_hours,
        expectedHours: record.expected_hours,
        balanceHours: record.balance_hours
      });
      
      return {
        expectedHours: record.expected_hours || 0,
        actualHours: record.actual_hours || 0,
        balanceHours: record.balance_hours || 0,
        status: record.actual_hours > 0 ? 'present' : 'absent',
        isPresent: (record.actual_hours || 0) > 0
      };
    }
    
    // PER GIORNI FUTURI: non dovrebbero mai arrivare qui (filtrati nella cronologia)
    if (isFuture) {
      console.log('⚠️ Giorno futuro non dovrebbe essere qui - usando dati DB');
      return {
        expectedHours: record.expected_hours || 0,
        actualHours: record.actual_hours || 0,
        balanceHours: record.balance_hours || 0,
        status: 'not_started',
        isPresent: false
      };
    }
    
    // PER OGGI: calcolo real-time
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
    // Trova l'orario di lavoro per questo dipendente
    const workSchedule = workSchedules.find(schedule => 
      schedule.user_id === record.user_id && 
      schedule.day_of_week === dayOfWeek && 
      schedule.is_working_day
    );
    
    console.log('📋 Found work schedule for today:', workSchedule);
    
    if (!workSchedule) {
      console.log('❌ No work schedule found for user', record.user_id, 'day', dayOfWeek);
      return {
        expectedHours: record.expected_hours || 0,
        actualHours: record.actual_hours || 0,
        balanceHours: record.balance_hours || 0,
        status: 'non_working_day',
        isPresent: false
      };
    }
    
    const { start_time, end_time, break_duration } = workSchedule;
    const [startHour, startMin] = start_time.split(':').map(Number);
    const [endHour, endMin] = end_time.split(':').map(Number);
    const breakDuration = break_duration || 60;
    
    // Calcola ore attese totali
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const workMinutes = totalMinutes - breakDuration;
    const expectedHours = workMinutes / 60;
    
    // Calcola ore effettive real-time (stessa logica del dipendente)
    let actualHours = 0;
    
    // Se è prima dell'inizio
    if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
      actualHours = 0;
    }
    // Se è dopo la fine
    else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
      actualHours = expectedHours;
    }
    // Se è durante l'orario di lavoro
    else {
      const minutesFromStart = (currentHour - startHour) * 60 + (currentMinute - startMin);
      
      // Determina se è una giornata completa (ha pausa pranzo) o mezza giornata
      const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const hasLunchBreak = totalWorkMinutes > 300; // Più di 5 ore = giornata completa
      
      if (hasLunchBreak) {
        // GIORNATA COMPLETA: ha pausa pranzo (es. 9:00-18:00)
        const morningEndMinutes = (totalWorkMinutes - breakDuration) / 2; // Fine mattina
        const breakStartMinutes = morningEndMinutes;
        const breakEndMinutes = morningEndMinutes + breakDuration;
        
        if (minutesFromStart < breakStartMinutes) {
          // Prima della pausa pranzo
          actualHours = minutesFromStart / 60;
        } else if (minutesFromStart >= breakStartMinutes && minutesFromStart < breakEndMinutes) {
          // Durante la pausa pranzo
          actualHours = breakStartMinutes / 60;
        } else {
          // Dopo la pausa pranzo
          const morningMinutes = breakStartMinutes;
          const afternoonMinutes = minutesFromStart - breakEndMinutes;
          actualHours = (morningMinutes + afternoonMinutes) / 60;
        }
      } else {
        // MEZZA GIORNATA: non ha pausa pranzo (es. 9:00-13:00)
        actualHours = minutesFromStart / 60;
      }
    }
    
    const balanceHours = actualHours - expectedHours;
    const isPresent = actualHours > 0;
    
    // Determina lo status finale
    let finalStatus = 'absent';
    
    // Prima controlla se è un giorno lavorativo
    if (expectedHours === 0) {
      finalStatus = 'non_working_day';
    }
    // Se è prima dell'inizio dell'orario di lavoro
    else if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
      finalStatus = 'not_started';
    }
    // Se è dopo la fine dell'orario di lavoro
    else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
      finalStatus = actualHours > 0 ? 'completed' : 'absent';
    }
    // Se è durante l'orario di lavoro
    else {
      finalStatus = actualHours > 0 ? 'working' : 'absent';
    }
    
    const result = {
      expectedHours: Math.round(expectedHours * 10) / 10,
      actualHours: Math.round(actualHours * 10) / 10,
      balanceHours: Math.round(balanceHours * 10) / 10,
      status: finalStatus,
      isPresent
    };
    
    console.log('✅ Calculated real-time hours for today:', result);
    
    return result;
  };


  const getStatusIcon = (status) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'working': return <Clock className="h-4 w-4" />;
      case 'not_started': return <Clock className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'sick_leave': return <AlertCircle className="h-4 w-4" />;
      case 'holiday': return <Calendar className="h-4 w-4" />;
      case 'non_working_day': return <Minus className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'text-green-600 bg-green-50 border-green-200';
    if (balance < 0) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setEditForm({
      actual_hours: record.actual_hours || record.expected_hours || 0,
      is_overtime: record.is_overtime || false,
      is_early_departure: record.is_early_departure || false,
      is_late_arrival: record.is_late_arrival || false,
      notes: record.notes || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await apiCall(`/api/attendance/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Record aggiornato con successo!');
        setShowEditModal(false);
        setEditingRecord(null);
        fetchAttendanceData();
        fetchStats();
        if (activeTab === 'history') {
          fetchAttendanceHistory();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Errore durante l\'aggiornamento');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Errore durante l\'aggiornamento');
    }
  };


  const handleGenerateAttendance = async () => {
    try {
      const response = await apiCall('/api/attendance/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: generateForm.employeeId,
          startDate: generateForm.startDate,
          endDate: generateForm.endDate
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Presenze generate con successo!');
        setShowGenerateModal(false);
        setGenerateForm({
          startDate: '',
          endDate: '',
          employeeId: ''
        });
        setGenerateStep(1);
        fetchAttendanceData();
        fetchStats();
        if (activeTab === 'history') {
          fetchAttendanceHistory();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Errore durante la generazione');
      }
    } catch (error) {
      console.error('Error generating attendance:', error);
      alert('Errore durante la generazione');
    }
  };

  const filteredData = (() => {
    let data = [];
    if (activeTab === 'currently') {
      // Per "Attualmente a lavoro" usa i dati real-time da employees
      data = employees;
    } else if (activeTab === 'today') {
      // Per "Oggi" combina dati database + real-time
      data = attendance;
      
      // Aggiungi dati real-time se non ci sono record per oggi nel database
      const today = new Date().toISOString().split('T')[0];
      const hasTodayInDatabase = attendance.some(record => record.date === today);
      
      if (!hasTodayInDatabase && allEmployees.length > 0) {
        // Calcola dati real-time per tutti i dipendenti che hanno lavorato oggi
        const todayRealTimeData = allEmployees
          .filter(emp => emp.role !== 'admin') // Escludi admin
          .map(emp => {
            // Calcola ore real-time per questo dipendente
            const realTimeHours = calculateRealTimeHoursForEmployee(emp.id);
            if (realTimeHours && realTimeHours.actualHours > 0) {
              return {
                id: `realtime-${emp.id}`,
                user_id: emp.id,
                date: today,
                actual_hours: realTimeHours.actualHours,
                expected_hours: realTimeHours.expectedHours,
                balance_hours: realTimeHours.balanceHours,
                status: realTimeHours.status,
                users: { first_name: emp.firstName, last_name: emp.lastName },
                is_realtime: true // Flag per identificare dati real-time
              };
            }
            return null;
          })
          .filter(Boolean); // Rimuovi null values
        
        data = [...data, ...todayRealTimeData];
      }
    } else {
      // Per "Cronologia" usa attendanceHistory - SOLO giorni passati e oggi
      const today = new Date().toISOString().split('T')[0];
      data = attendanceHistory.filter(record => record.date <= today);
      
      // Aggiungi dati real-time per oggi se non ci sono record nel database
      const hasTodayInHistory = attendanceHistory.some(record => record.date === today);
      
      if (!hasTodayInHistory && allEmployees.length > 0) {
        // Calcola dati real-time per tutti i dipendenti che hanno lavorato oggi
        const todayRealTimeData = allEmployees
          .filter(emp => emp.role !== 'admin') // Escludi admin
          .map(emp => {
            // Calcola ore real-time per questo dipendente
            const realTimeHours = calculateRealTimeHoursForEmployee(emp.id);
            if (realTimeHours && realTimeHours.actualHours > 0) {
              return {
                id: `realtime-${emp.id}`,
                user_id: emp.id,
                date: today,
                actual_hours: realTimeHours.actualHours,
                expected_hours: realTimeHours.expectedHours,
                balance_hours: realTimeHours.balanceHours,
                status: realTimeHours.status,
                users: { first_name: emp.firstName, last_name: emp.lastName },
                is_realtime: true // Flag per identificare dati real-time
              };
            }
            return null;
          })
          .filter(Boolean); // Rimuovi null values
        
        data = [...data, ...todayRealTimeData];
      }
    }
    
    return data.filter(record => {
      // Filtro per ricerca
      if (searchTerm) {
        let employeeName = '';
        if (activeTab === 'currently') {
          // Per employees (current attendance), usa la struttura diversa
          employeeName = record.name ? record.name.toLowerCase() : '';
        } else {
          // Per attendance records, usa la struttura normale
          employeeName = record.users ? 
            `${record.users.first_name} ${record.users.last_name}`.toLowerCase() : '';
        }
        if (!employeeName.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }
      
      // Logica specifica per ogni tab
      if (activeTab === 'currently') {
        // Per employees, mostra solo chi è attualmente working o on_break
        return record.status === 'working' || record.status === 'on_break';
      } else if (activeTab === 'today') {
        // Mostra chi ha lavorato oggi O è in malattia/ferie/permesso
        const realTimeData = calculateRealTimeHoursForRecord(record);
        return realTimeData.actualHours > 0 || realTimeData.status === 'sick_leave' || realTimeData.status === 'holiday';
      }
      
      return true;
    });
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <div className="text-white text-xl">Caricamento presenze...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Gestione Presenze</h1>
              <p className="text-slate-400">
                Sistema di gestione presenze avanzato per amministratori
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowGenerateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Aggiungi presenza
              </button>
            </div>
          </div>
        </div>

        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-slate-400 text-sm">Hanno Lavorato Oggi</p>
                <p className="text-2xl font-bold text-white">{stats.workedToday}</p>
                <p className="text-xs text-slate-500 mt-1">Ore effettive &gt; 0</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-slate-400 text-sm">Attualmente Presenti</p>
                <p className="text-2xl font-bold text-white">{stats.currentlyPresent}</p>
                <p className="text-xs text-slate-500 mt-1">Nell'orario di lavoro</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-slate-400 text-sm">Assenti Oggi</p>
                <p className="text-2xl font-bold text-white">{stats.absentToday}</p>
                <p className="text-xs text-slate-500 mt-1">Dovevano lavorare</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab('currently')}
              className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'currently' 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Clock className="h-4 w-4" />
              Attualmente a lavoro
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'today' 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Oggi
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'history' 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Cronologia
            </button>
          </div>
        </div>

        {/* Filtri */}
        {activeTab === 'history' && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Cerca Dipendente</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nome o cognome..."
                    className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleDateString('it-IT', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
                  
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
                  
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dipendente</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                      <option value="">Tutti i dipendenti</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tabella Presenze */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              {activeTab === 'currently' ? 'Attualmente a lavoro' : 
               activeTab === 'today' ? 'Chi ha lavorato oggi' : 'Cronologia Presenze'}
          </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Dipendente</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Data</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Stato</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Ore Attese</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Ore Effettive</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((record) => {
                  // Per il tab "currently" usa i dati direttamente, per gli altri calcola real-time
                  let displayData;
                  if (activeTab === 'currently') {
                    // Usa i dati direttamente da employees
                    displayData = {
                      name: record.name,
                      email: '', // Non disponibile nei dati employees
                      date: new Date().toISOString().split('T')[0],
                      status: record.status,
                      expectedHours: record.expected_hours,
                      actualHours: record.actual_hours,
                      balanceHours: record.balance_hours,
                      department: record.department
                    };
                  } else if (record.is_realtime) {
                    // Per dati real-time, usa direttamente i valori calcolati
                    displayData = {
                      name: record.users ? `${record.users.first_name} ${record.users.last_name}` : 'N/A',
                      email: record.users?.email || '',
                      date: record.date,
                      status: record.status,
                      expectedHours: record.expected_hours,
                      actualHours: record.actual_hours,
                      balanceHours: record.balance_hours,
                      department: record.users?.department || 'N/A'
                    };
                  } else {
                    // Per dati database, calcola le ore real-time
                    const realTimeData = calculateRealTimeHoursForRecord(record);
                    console.log('🔍 DisplayData creation for', record.date, ':', {
                      realTimeData: {
                        actualHours: realTimeData.actualHours,
                        expectedHours: realTimeData.expectedHours,
                        status: realTimeData.status
                      },
                      recordActualHours: record.actual_hours,
                      recordExpectedHours: record.expected_hours
                    });
                    
                    // Usa i dati del database per giorni passati, real-time per oggi
                    const now = new Date();
                    const today = now.toISOString().split('T')[0];
                    const recordDate = record.date;
                    
                    // Converti le date in oggetti Date per confronto corretto
                    const todayDate = new Date(today);
                    const recordDateObj = new Date(recordDate);
                    const isPast = recordDateObj < todayDate;
                    const isToday = recordDate === today;
                    
                    // Determina status in base ai dati: 
                    // - Se il DB ha actual_hours > 0, usa sempre quelli (dati salvati dal cron)
                    // - Altrimenti se è oggi, usa real-time
                    // - Altrimenti usa DB (anche se 0)
                    let finalStatus;
                    let finalActualHours;
                    let finalExpectedHours;
                    let finalBalanceHours;
                    
                    const hasActualData = (record.actual_hours || 0) > 0;
                    
                    // IMPORTANTE: Usa sempre realTimeData.status perché include il controllo malattie
                    if (isToday) {
                      // Oggi: usa sempre real-time (include controllo malattie)
                      finalStatus = realTimeData.status;
                      finalActualHours = realTimeData.actualHours;
                      finalExpectedHours = realTimeData.expectedHours;
                      finalBalanceHours = realTimeData.balanceHours;
                      console.log(`🔍 Final status for TODAY (${recordDate}):`, {
                        realTimeDataStatus: realTimeData.status,
                        finalStatus,
                        finalActualHours,
                        finalExpectedHours
                      });
                    } else if (hasActualData || isPast) {
                      // Giorno passato con dati: usa DB
                      finalActualHours = record.actual_hours || 0;
                      finalExpectedHours = record.expected_hours || 0;
                      finalBalanceHours = record.balance_hours || 0;
                      finalStatus = finalActualHours > 0 ? 'present' : 'absent';
                      console.log(`🔍 Final status for PAST (${recordDate}):`, {
                        finalStatus,
                        finalActualHours,
                        finalExpectedHours
                      });
                    } else {
                      // Fallback
                      finalStatus = realTimeData.status;
                      finalActualHours = realTimeData.actualHours;
                      finalExpectedHours = realTimeData.expectedHours;
                      finalBalanceHours = realTimeData.balanceHours;
                      console.log(`🔍 Final status for FALLBACK (${recordDate}):`, {
                        finalStatus,
                        finalActualHours,
                        finalExpectedHours
                      });
                    }
                    
                    displayData = {
                      name: record.users ? `${record.users.first_name} ${record.users.last_name}` : 'N/A',
                      email: record.users?.email || '',
                      date: record.date,
                      status: finalStatus,
                      expectedHours: finalExpectedHours,
                      actualHours: finalActualHours,
                      balanceHours: finalBalanceHours,
                      department: ''
                    };
                  }
                  
                  return (
                    <tr key={record.id || record.user_id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-slate-300" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {displayData.name}
                            </p>
                            <p className="text-sm text-slate-400">
                              {displayData.email || displayData.department}
                            </p>
                          </div>
                        </div>
                    </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-slate-400 mr-2" />
                          <span className="text-slate-300">
                            {new Date(displayData.date).toLocaleDateString('it-IT')}
                          </span>
                        </div>
                    </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(displayData.status)}`}>
                          {getStatusIcon(displayData.status)}
                          <span className="ml-1">{getStatusText(displayData.status)}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-slate-300">
                          {formatHours(displayData.expectedHours)}
                        </span>
                    </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-slate-300">
                          {formatHours(displayData.actualHours)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditRecord(record)}
                          disabled={record.is_realtime}
                          className={`p-2 rounded-lg transition-colors ${
                            record.is_realtime 
                              ? 'text-slate-500 cursor-not-allowed opacity-50' 
                              : 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20'
                          }`}
                          title={record.is_realtime ? "Dati real-time non modificabili" : "Modifica record"}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewAttendanceDetails(record)}
                          className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Visualizza dettagli presenze"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-slate-500" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">Nessun record trovato</h3>
              <p className="text-slate-500">
                {activeTab === 'today' 
                  ? 'Non ci sono presenze registrate per oggi' 
                  : 'Nessun record di presenza trovato per i filtri selezionati'
                }
              </p>
            </div>
          )}
        </div>

        {/* Modale Modifica Record */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Modifica Record Presenza</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ore Effettive</label>
                  <input
                    type="number"
                    step="0.25"
                    value={editForm.actual_hours}
                    onChange={(e) => setEditForm({...editForm, actual_hours: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Note</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows="3"
                    placeholder="Aggiungi note..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.is_overtime}
                      onChange={(e) => setEditForm({...editForm, is_overtime: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Straordinario</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.is_early_departure}
                      onChange={(e) => setEditForm({...editForm, is_early_departure: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Uscita Anticipata</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.is_late_arrival}
                      onChange={(e) => setEditForm({...editForm, is_late_arrival: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Arrivo in Ritardo</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modale Genera Presenze */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-600">
                <div>
                  <h3 className="text-lg font-semibold text-white">Aggiungi presenza</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Step {generateStep} di 2
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setGenerateStep(1);
                    setGenerateForm({
                      startDate: '',
                      endDate: '',
                      employeeId: ''
                    });
                  }}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    generateStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    1
                  </div>
                  <div className={`flex-1 h-1 mx-2 ${
                    generateStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'
                  }`}></div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    generateStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    2
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-400">
                  <span>Seleziona Dipendente</span>
                  <span>Seleziona Date</span>
                </div>
              </div>
              
              {/* Step 1: Selezione Dipendente */}
              {generateStep === 1 && (
                <div className="p-6">
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Seleziona Dipendente
                    </label>
                    <select
                      value={generateForm.employeeId}
                      onChange={(e) => setGenerateForm({...generateForm, employeeId: e.target.value})}
                      className="w-full border border-slate-600 bg-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Seleziona dipendente</option>
                      {allEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowGenerateModal(false);
                        setGenerateStep(1);
                        setGenerateForm({
                          startDate: '',
                          endDate: '',
                          employeeId: ''
                        });
                      }}
                      className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={() => {
                        if (generateForm.employeeId) {
                          setGenerateStep(2);
                        } else {
                          alert('Seleziona un dipendente per continuare');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-2"
                    >
                      Avanti
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Selezione Date */}
              {generateStep === 2 && (
                <div className="p-6">
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Data Inizio</label>
                      <input
                        type="date"
                        value={generateForm.startDate}
                        onChange={(e) => setGenerateForm({...generateForm, startDate: e.target.value})}
                        className="w-full border border-slate-600 bg-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Data Fine</label>
                      <input
                        type="date"
                        value={generateForm.endDate}
                        onChange={(e) => setGenerateForm({...generateForm, endDate: e.target.value})}
                        className="w-full border border-slate-600 bg-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Riepilogo */}
                  <div className="bg-slate-700 rounded-md p-4 mb-6">
                    <h4 className="text-sm font-medium text-white mb-2">Riepilogo</h4>
                    <div className="text-sm text-slate-300 space-y-1">
                      <p><span className="text-slate-400">Dipendente:</span> {
                        employees.find(emp => emp.id === generateForm.employeeId)?.firstName + ' ' + 
                        employees.find(emp => emp.id === generateForm.employeeId)?.lastName
                      }</p>
                      <p><span className="text-slate-400">Periodo:</span> {generateForm.startDate} - {generateForm.endDate}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between gap-3">
                    <button
                      onClick={() => setGenerateStep(1)}
                      className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                    >
                      Indietro
                    </button>
                    <button
                      onClick={() => {
                        if (generateForm.startDate && generateForm.endDate) {
                          handleGenerateAttendance();
                        } else {
                          alert('Seleziona entrambe le date per continuare');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Aggiungi presenza
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
        )}

        {/* Modal Dettagli Presenze */}
        {showAttendanceDetails && selectedAttendanceDetails && (
          <AttendanceDetails
            userId={selectedAttendanceDetails.userId}
            date={selectedAttendanceDetails.date}
            onClose={() => {
              setShowAttendanceDetails(false);
              setSelectedAttendanceDetails(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AdminAttendance;