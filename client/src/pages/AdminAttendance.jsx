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
  Clock,
  Accessibility,
  Trash2
} from 'lucide-react';

const AdminAttendance = () => {
  const { user, apiCall } = useAuthStore();
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('today');
  
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
    actual_hours: '0:00',
    notes: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

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
  
  // Permessi 104 di oggi
  const [permissions104Today, setPermissions104Today] = useState([]);
  
  // Permessi con ore (entrata/uscita) per oggi
  const [permissionsHoursToday, setPermissionsHoursToday] = useState({});
  
  // Saldi banca ore per tutti i dipendenti
  const [employeeBalances, setEmployeeBalances] = useState({});

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
      await fetchAllEmployees();  // Questo ora carica anche i permessi internamente
      await fetchWorkSchedules();
      await fetchSickToday();
      await fetch104Today();
      await fetchStats();
      
      // Forza un secondo aggiornamento dopo 1 secondo per sicurezza
      setTimeout(() => {
        console.log('🔄 Secondary admin data update...');
        fetchStats();
      }, 1000);
      
      // Nasconde il loading iniziale dopo che tutti i dati sono caricati
      setLoading(false);
    };
    
    initializeData();
    
    // Polling ogni 60s per sincronizzazione con dipendenti (ridotto carico)
    const syncInterval = setInterval(() => {
      console.log('🔄 Admin sync polling...');
      // Dati dinamici
      fetchAttendanceData();
      fetchSickToday();
      fetch104Today();
      fetchStats();
      // Evita di ricaricare ad ogni tick liste relativamente statiche
      // fetchEmployees();
      // fetchAllEmployees();
      // fetchWorkSchedules();
    }, 60000);
    
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
      setDataLoading(true);
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
      setDataLoading(false);
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
        
        // Dopo aver caricato i dipendenti, carica i loro saldi E i permessi!
        await fetchEmployeeBalancesForList(data);
        await fetchPermissionHoursForEmployeesList(data);  // Passa direttamente i dati invece di usare state
      }
    } catch (error) {
      console.error('Error fetching all employees:', error);
    }
  };

  const fetchEmployeeBalancesForList = async (employees) => {
    try {
      console.log('🔄 Fetching total balances for all employees...');
      const ids = employees.map(e => e.id).join(',');
      const response = await apiCall(`/api/attendance/total-balances?userIds=${ids}`);
      if (response.ok) {
        const data = await response.json();
        const balances = data.balances || {};
        console.log('💰 Employee balances loaded:', balances);
        setEmployeeBalances(balances);
      } else {
        console.error('❌ Failed to fetch batch balances:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching employee balances:', error);
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

  const fetch104Today = async () => {
    try {
      console.log('🔄 Fetching 104 permissions for today...');
      const response = await apiCall('/api/attendance/104-today');
      if (response.ok) {
        const data = await response.json();
        console.log('🔵 104 permissions for today:', data);
        setPermissions104Today(data);
      } else {
        console.error('❌ Failed to fetch 104 permissions:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching 104 permissions:', error);
    }
  };

  const fetchPermissionHoursForEmployeesList = async (employeesList) => {
    try {
      const employees = employeesList || allEmployees;
      const today = new Date().toISOString().split('T')[0];
      console.log('🔄 Fetching permission hours for all employees...');
      console.log('📊 Total employees to check:', employees.length);
      
      // Recupera permessi per ogni dipendente CON DETTAGLI (exit_time, entry_time)
      const permissionsMap = {};
      
      for (const emp of employees) {
        try {
          const response = await apiCall(`/api/leave-requests/permission-hours?userId=${emp.id}&date=${today}`);
          if (response.ok) {
            const data = await response.json();
            console.log(`📋 ${emp.first_name} ${emp.last_name} - Permission data:`, data);
            if (data.totalPermissionHours > 0) {
              // Salva ore E dettagli (tipo, orari)
              permissionsMap[emp.id] = {
                hours: data.totalPermissionHours,
                permissions: data.permissions || []
              };
              console.log(`🕐 ✅ Employee ${emp.first_name} ${emp.last_name}: ${data.totalPermissionHours}h permission FOUND!`);
            } else {
              console.log(`⚪ Employee ${emp.first_name} ${emp.last_name}: no permission today`);
            }
          } else {
            console.warn(`⚠️ Failed to fetch permissions for ${emp.first_name} ${emp.last_name}:`, response.status);
          }
        } catch (err) {
          console.error(`❌ Error fetching permissions for ${emp.id}:`, err);
        }
      }
      
      console.log('✅ Final permission hours map:', permissionsMap);
      console.log('📊 Total permissions found:', Object.keys(permissionsMap).length);
      setPermissionsHoursToday(permissionsMap);
    } catch (error) {
      console.error('❌ Error fetching permission hours:', error);
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
      case 'permission_104': return 'bg-blue-900 text-blue-100 border-blue-700';
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
      case 'permission_104': return 'Permesso 104';
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

      // Controlla se ha permesso 104 oggi
      const has104Today = permissions104Today.some(perm104 => 
        perm104.user_id === record.user_id &&
        new Date(perm104.start_date) <= new Date(today) &&
        new Date(perm104.end_date) >= new Date(today)
      );

      if (has104Today) {
        console.log('🔵 User has 104 permission today:', record.user_id);
        return {
          expectedHours: 0,
          actualHours: 0,
          balanceHours: 0,
          status: 'permission_104',
          isPresent: false
        };
      }
    }
    
    
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
    
    const { start_time, end_time, break_duration, break_start_time } = workSchedule;
    const [startHour, startMin] = start_time.split(':').map(Number);
    const [endHour, endMin] = end_time.split(':').map(Number);
    const breakDuration = break_duration || 60;
    
    // Calcola ore attese totali dall'orario contrattuale (SEMPRE FISSE!)
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const workMinutes = totalMinutes - breakDuration;
    const expectedHours = workMinutes / 60; // NON ridurre per permessi early_exit/late_entry!
    
    // Trova permessi per questo dipendente
    const permissionData = permissionsHoursToday[record.user_id];
    const permissionHours = permissionData?.hours || 0;
    
    // Trova orari effettivi considerando permessi
    let effectiveEndHour = endHour;
    let effectiveEndMin = endMin;
    let effectiveStartHour = startHour;
    let effectiveStartMin = startMin;
    
    // PERMESSO USCITA ANTICIPATA: non riduce expectedHours, solo cambia orario effettivo
    if (permissionData?.permissions) {
      const earlyExitPerm = permissionData.permissions.find(p => p.type === 'early_exit' && p.exitTime);
      if (earlyExitPerm) {
        const [exitHour, exitMin] = earlyExitPerm.exitTime.split(':').map(Number);
        effectiveEndHour = exitHour;
        effectiveEndMin = exitMin;
        console.log(`🚪 ${record.user_id} ha permesso uscita anticipata alle ${earlyExitPerm.exitTime} → DEBITO`);
      }
      
      // PERMESSO ENTRATA POSTICIPATA: non riduce expectedHours, solo cambia orario effettivo
      const lateEntryPerm = permissionData.permissions.find(p => p.type === 'late_entry' && p.entryTime);
      if (lateEntryPerm) {
        const [entryHour, entryMin] = lateEntryPerm.entryTime.split(':').map(Number);
        effectiveStartHour = entryHour;
        effectiveStartMin = entryMin;
        console.log(`🚪 ${record.user_id} ha permesso entrata posticipata alle ${lateEntryPerm.entryTime} → DEBITO`);
      }
    }
    
    // Calcola ore effettive real-time
    let actualHours = 0;
    
    // Se è prima dell'inizio effettivo (considerando late_entry)
    if (currentHour < effectiveStartHour || (currentHour === effectiveStartHour && currentMinute < effectiveStartMin)) {
      actualHours = 0;
    }
    // Se è dopo la fine effettiva (considerando early_exit)
    else if (currentHour > effectiveEndHour || (currentHour === effectiveEndHour && currentMinute >= effectiveEndMin)) {
      // Calcola le ore REALMENTE lavorate (da effectiveStart a effectiveEnd)
      const effectiveWorkMinutes = (effectiveEndHour * 60 + effectiveEndMin) - (effectiveStartHour * 60 + effectiveStartMin) - breakDuration;
      actualHours = effectiveWorkMinutes / 60;
    }
    // Se è durante l'orario di lavoro
    else {
      // Determina se è una giornata completa (ha pausa pranzo) o mezza giornata
      const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const hasLunchBreak = totalWorkMinutes > 300; // Più di 5 ore = giornata completa
      
      if (hasLunchBreak) {
        // GIORNATA COMPLETA: usa break_start_time se disponibile, altrimenti 13:00
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        
        let breakStartInMinutes;
        if (break_start_time) {
          const [breakHour, breakMin] = break_start_time.split(':').map(Number);
          breakStartInMinutes = breakHour * 60 + breakMin;
        } else {
          // Default: 13:00
          breakStartInMinutes = 13 * 60;
        }
        
        const breakEndInMinutes = breakStartInMinutes + breakDuration;
        
        // Calcola minuti dall'inizio EFFETTIVO (considerando late_entry)
        const startTimeInMinutes = effectiveStartHour * 60 + effectiveStartMin;
        
        if (currentTimeInMinutes < breakStartInMinutes) {
          // Prima della pausa pranzo
          const totalMinutesWorked = currentTimeInMinutes - startTimeInMinutes;
          actualHours = totalMinutesWorked / 60;
        } else if (currentTimeInMinutes >= breakStartInMinutes && currentTimeInMinutes < breakEndInMinutes) {
          // Durante la pausa pranzo
          const totalMinutesWorked = breakStartInMinutes - startTimeInMinutes;
          actualHours = totalMinutesWorked / 60;
        } else {
          // Dopo la pausa pranzo
          const morningMinutes = breakStartInMinutes - startTimeInMinutes;
          const afternoonMinutes = currentTimeInMinutes - breakEndInMinutes;
          const totalMinutesWorked = morningMinutes + afternoonMinutes;
          actualHours = totalMinutesWorked / 60;
        }
      } else {
        // MEZZA GIORNATA: non ha pausa pranzo (es. 9:00-13:00)
        const minutesFromStart = (currentHour - effectiveStartHour) * 60 + (currentMinute - effectiveStartMin);
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
    // Se è dopo la fine dell'orario di lavoro (o dopo l'orario di uscita del permesso)
    else if (currentHour > effectiveEndHour || (currentHour === effectiveEndHour && currentMinute >= effectiveEndMin)) {
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
      case 'permission_104': return <Accessibility className="h-4 w-4" />;
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

  // Funzione per convertire ore decimali in formato HH:MM
  const hoursToTime = (hours) => {
    if (!hours && hours !== 0) return '0:00';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  // Funzione per convertire formato HH:MM in ore decimali
  const timeToHours = (timeStr) => {
    if (!timeStr || timeStr === '') return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + (m || 0) / 60;
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setEditForm({
      actual_hours: hoursToTime(record.actual_hours || record.expected_hours || 0),
      notes: record.notes || ''
    });
    setShowEditModal(true);
  };

  const handleDeleteRecord = async (record) => {
    try {
      const response = await apiCall(`/api/attendance/${record.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Record eliminato con successo!');
        setShowDeleteConfirm(false);
        setRecordToDelete(null);
        fetchAttendanceData();
        fetchStats();
        if (activeTab === 'history') {
          fetchAttendanceHistory();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Errore durante l\'eliminazione');
      }
    } catch (error) {
      console.error('Error deleting attendance:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  const handleSaveEdit = async () => {
    try {
      // Converti ore in formato HH:MM in ore decimali
      const actualHoursDecimal = timeToHours(editForm.actual_hours);
      
      const response = await apiCall(`/api/attendance/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          actual_hours: actualHoursDecimal,
          notes: editForm.notes
        })
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
    if (activeTab === 'today') {
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
      const todayDateObj = new Date(today);
      
      // Ottieni il mese/anno corrente
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      // Filtra SOLO record con data <= oggi E che corrispondono al mese/anno selezionato
      data = attendanceHistory.filter(record => {
        const recordDateObj = new Date(record.date);
        const recordMonth = recordDateObj.getMonth() + 1;
        const recordYear = recordDateObj.getFullYear();
        
        // Verifica che la data sia <= oggi
        const isPastOrToday = recordDateObj <= todayDateObj;
        
        // Verifica che mese/anno del record corrispondano a quelli selezionati
        const matchesMonth = selectedMonth === recordMonth;
        const matchesYear = selectedYear === recordYear;
        
        return isPastOrToday && matchesMonth && matchesYear;
      });
      
      // Aggiungi dati real-time per oggi SOLO se il mese/anno selezionato è quello corrente
      const isCurrentPeriod = selectedMonth === currentMonth && selectedYear === currentYear;
      const hasTodayInHistory = attendanceHistory.some(record => record.date === today);
      
      if (!hasTodayInHistory && allEmployees.length > 0 && isCurrentPeriod) {
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
        // Per attendance records, usa la struttura normale
        employeeName = record.users ? 
          `${record.users.first_name} ${record.users.last_name}`.toLowerCase() : '';
        if (!employeeName.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }
      
      // Logica specifica per ogni tab
      if (activeTab === 'today') {
        // Mostra chi ha lavorato oggi O è in malattia/ferie/permesso 104
        const realTimeData = calculateRealTimeHoursForRecord(record);
        return realTimeData.actualHours > 0 || realTimeData.status === 'sick_leave' || realTimeData.status === 'holiday' || realTimeData.status === 'permission_104';
      }
      
      return true;
    });
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-500 border-t-transparent"></div>
          <div className="text-white text-xl font-semibold">Caricamento dati...</div>
          <div className="text-slate-400 text-sm">Preparazione sistema presenze</div>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
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
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500 text-sm">
                  Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
                </p>
                {dataLoading && (
                  <div className="flex items-center gap-1 text-indigo-400 text-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border border-indigo-400 border-t-transparent"></div>
                    <span>Aggiornamento...</span>
                  </div>
                )}
              </div>
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
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
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
                      {emp.first_name || emp.firstName} {emp.last_name || emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Presenze - Responsive: cards on mobile, table on lg+ */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              {activeTab === 'today' ? 'Presenze di Oggi' : 'Cronologia Presenze'}
          </h2>
          </div>
          
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 lg:hidden">
            {filteredData.map((record) => {
              const realTime = record.is_realtime ? {
                expectedHours: record.expected_hours,
                actualHours: record.actual_hours,
                balanceHours: record.balance_hours,
                status: record.status
              } : calculateRealTimeHoursForRecord(record);
              const name = record.users ? `${record.users.first_name} ${record.users.last_name}` : 'N/A';
              return (
                <div key={record.id || record.user_id} className="rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold truncate mr-2">{name}</div>
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(realTime.status)}`}>{getStatusText(realTime.status)}</span>
                  </div>
                  <div className="text-slate-400 text-sm mb-3">{new Date(record.date).toLocaleDateString('it-IT')}</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-slate-400">Attese</div>
                      <div className="font-mono">{formatHours(realTime.expectedHours)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Effettive</div>
                      <div className="font-mono">{formatHours(realTime.actualHours)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Saldo</div>
                      <div className={`font-mono font-bold ${realTime.balanceHours>0?'text-green-400':realTime.balanceHours<0?'text-red-400':'text-slate-400'}`}>{realTime.balanceHours>0?'+':''}{formatHours(realTime.balanceHours)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-right">
                    <button onClick={() => handleViewAttendanceDetails(record)} className="text-green-400 hover:text-green-300 text-sm">Dettagli</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 hidden lg:block">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden shadow-xl ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left py-3 px-3 sm:py-4 sm:px-6 font-medium text-slate-300 text-xs sm:text-sm">Dipendente</th>
                  <th className="text-left py-3 px-3 sm:py-4 sm:px-6 font-medium text-slate-300 text-xs sm:text-sm">Data</th>
                  <th className="text-left py-3 px-3 sm:py-4 sm:px-6 font-medium text-slate-300 text-xs sm:text-sm">Stato</th>
                  <th className="text-left py-3 px-3 sm:py-4 sm:px-6 font-medium text-slate-300 text-xs sm:text-sm">Attese</th>
                  <th className="text-left py-3 px-3 sm:py-4 sm:px-6 font-medium text-slate-300 text-xs sm:text-sm">Effettive</th>
                  <th className="text-left py-3 px-3 sm:py-4 sm:px-6 font-medium text-slate-300 text-xs sm:text-sm">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((record) => {
                  // Calcola real-time o usa dati esistenti
                  let displayData;
                  if (record.is_realtime) {
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
                    } else if (hasActualData || isPast) {
                      // Giorno passato con dati: usa DB
                      finalActualHours = record.actual_hours || 0;
                      finalExpectedHours = record.expected_hours || 0;
                      finalBalanceHours = record.balance_hours || 0;
                      finalStatus = finalActualHours > 0 ? 'present' : 'absent';
                    } else {
                      // Fallback
                      finalStatus = realTimeData.status;
                      finalActualHours = realTimeData.actualHours;
                      finalExpectedHours = realTimeData.expectedHours;
                      finalBalanceHours = realTimeData.balanceHours;
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
                      <td className="py-3 px-2 sm:py-4 sm:px-6 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-6 w-6 sm:h-8 sm:w-8 bg-slate-600 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                            <User className="h-3 w-3 sm:h-4 sm:w-4 text-slate-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white text-xs sm:text-sm truncate">
                              {displayData.name}
                            </p>
                            <p className="text-xs text-slate-400 truncate hidden sm:block">
                              {displayData.email || displayData.department}
                            </p>
                          </div>
                        </div>
                    </td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-slate-400 mr-2" />
                          <span className="text-slate-300">
                            {new Date(displayData.date).toLocaleDateString('it-IT')}
                          </span>
                        </div>
                    </td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(displayData.status)}`}>
                          {getStatusIcon(displayData.status)}
                          <span className="ml-1">{getStatusText(displayData.status)}</span>
                        </span>
                      </td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4">
                        <span className="font-mono text-slate-300">
                          {formatHours(displayData.expectedHours)}
                        </span>
                    </td>
                      <td className="py-3 px-2 sm:py-4 sm:px-4">
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
                          onClick={() => {
                            setRecordToDelete(record);
                            setShowDeleteConfirm(true);
                          }}
                          disabled={record.is_realtime}
                          className={`p-2 rounded-lg transition-colors ${
                            record.is_realtime 
                              ? 'text-slate-500 cursor-not-allowed opacity-50' 
                              : 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
                          }`}
                          title={record.is_realtime ? "Dati real-time non eliminabili" : "Elimina record"}
                        >
                          <Trash2 className="h-4 w-4" />
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
            </div>
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
                    type="text"
                    pattern="[0-9]{1,2}:[0-5][0-9]"
                    value={editForm.actual_hours}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Permetti solo numeri e due punti
                      if (value === '' || /^\d{0,2}:?\d{0,2}$/.test(value.replace(':', ''))) {
                        // Aggiungi automaticamente i due punti dopo 2 cifre
                        if (value.length === 2 && !value.includes(':')) {
                          value = value + ':';
                        }
                        setEditForm({...editForm, actual_hours: value});
                      }
                    }}
                    placeholder="0:00"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Formato: HH:MM (es. 8:30 per 8 ore e 30 minuti)</p>
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

        {/* Modale Conferma Eliminazione */}
        {showDeleteConfirm && recordToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Conferma Eliminazione</h3>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setRecordToDelete(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-slate-300">
                  Sei sicuro di voler eliminare questo record di presenza?
                </p>
                <div className="bg-slate-700 rounded-lg p-3">
                  <p className="text-sm text-slate-400">
                    {(() => {
                      const emp = allEmployees.find(e => e.id === recordToDelete.user_id);
                      return emp ? `${emp.first_name} ${emp.last_name}` : 'Dipendente';
                    })()}
                  </p>
                  <p className="text-sm text-slate-400">
                    {new Date(recordToDelete.date).toLocaleDateString('it-IT')}
                  </p>
                  <p className="text-sm text-slate-400">
                    Ore: {recordToDelete.actual_hours || 0}h
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setRecordToDelete(null);
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => handleDeleteRecord(recordToDelete)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Elimina
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
                          {emp.first_name || emp.firstName} {emp.last_name || emp.lastName}
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
                        (() => {
                          const selectedEmp = allEmployees.find(emp => emp.id === generateForm.employeeId);
                          if (!selectedEmp) return '';
                          return (selectedEmp.first_name || selectedEmp.firstName || '') + ' ' + (selectedEmp.last_name || selectedEmp.lastName || '');
                        })()
                      }</p>
                      <p><span className="text-slate-400">Periodo:</span> {
                        (() => {
                          const formatDate = (dateStr) => {
                            if (!dateStr) return '';
                            const date = new Date(dateStr);
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}-${month}-${year}`;
                          };
                          return `${formatDate(generateForm.startDate)} - ${formatDate(generateForm.endDate)}`;
                        })()
                      }</p>
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