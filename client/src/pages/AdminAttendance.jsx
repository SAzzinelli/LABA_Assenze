import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import AttendanceDetails from '../components/AttendanceDetails';
import { AdminAttendanceSkeleton } from '../components/AdminAttendanceSkeleton';
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
import { calculateRealTimeHours } from '../utils/hoursCalculation';

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
  const [downloadingExcel, setDownloadingExcel] = useState(false);
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

  // Ferie di oggi
  const [vacationsToday, setVacationsToday] = useState([]);

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
      // Carica i dati critici in parallelo per velocità
      await Promise.all([
        fetchAttendanceData(),
        fetchEmployees(),
        fetchAllEmployees(),  // Questo ora carica anche i permessi internamente
        fetchWorkSchedules(),
        fetchSickToday(),
        fetchVacationsToday(),
        fetch104Today(),
        fetchStats()
      ]);

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
      fetchVacationsToday();
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
  }, [activeTab, selectedMonth, selectedYear]);

  // Ricalcola le statistiche quando cambiano i workSchedules
  useEffect(() => {
    if (workSchedules.length > 0) {
      calculateRealTimeStats();
    }
  }, [workSchedules]);

  // Helper per ottenere la data di oggi in formato locale (non UTC)
  const getTodayLocal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchAttendanceData = async () => {
    try {
      setDataLoading(true);
      const today = getTodayLocal();
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

  const handleDownloadMonthlyReportExcel = async () => {
    try {
      setDownloadingExcel(true);
      // Usa il mese e anno selezionati, o quelli correnti se non in cronologia
      const month = activeTab === 'history' ? selectedMonth : new Date().getMonth() + 1;
      const year = activeTab === 'history' ? selectedYear : new Date().getFullYear();
      const response = await apiCall(`/api/admin/reports/monthly-attendance-excel?year=${year}&month=${month}`, {
        headers: {
          Accept: 'application/vnd.ms-excel'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Errore nel download del report Excel');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const monthNames = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 
                          'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
      const monthName = monthNames[selectedMonth - 1];
      link.href = url;
      link.download = `foglio presenze dip ${monthName} ${selectedYear}.xls`;
      // Controllo sicurezza: assicurati che document.body esista
      if (document.body) {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Fallback: usa il root element
        const root = document.getElementById('root');
        if (root) {
          root.appendChild(link);
          link.click();
          root.removeChild(link);
        }
      }
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore nel download del report Excel:', error);
      window.alert('Errore nel download del report Excel. Riprova più tardi.');
    } finally {
      setDownloadingExcel(false);
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
      // Solo admin può accedere a questo endpoint
      const { user } = useAuthStore.getState();
      if (user?.role !== 'admin') {
        console.log('⚠️ Access denied to current attendance (expected for non-admin)');
        return;
      }

      const response = await apiCall('/api/attendance/current');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
        console.log('📊 Current attendance loaded for admin:', data.length, 'employees currently working');
      } else if (response.status === 403) {
        // 403 è atteso per non-admin, ignora silenziosamente
        console.log('⚠️ Access denied to current attendance (expected for non-admin)');
      } else {
        console.error('❌ Failed to fetch current attendance:', response.status);
      }
    } catch (error) {
      // Ignora errori 403 (accesso negato) per non-admin
      if (error.message?.includes('403') || error.message?.includes('Accesso negato')) {
        console.log('⚠️ Access denied to current attendance (expected for non-admin)');
        return;
      }
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
      console.log('🔄 [AdminAttendance] Fetching work schedules...');
      const response = await apiCall('/api/work-schedules');
      console.log('🔄 [AdminAttendance] Response status:', response?.status, 'ok:', response?.ok);

      if (response && response.ok) {
        const data = await response.json();
        console.log('✅ [AdminAttendance] Work schedules fetched:', data?.length || 0, 'total schedules');
        console.log('✅ [AdminAttendance] Raw data:', data);

        // IMPORTANTE: Normalizza la struttura degli schedule per admin (può avere users annidato)
        const normalizedSchedules = (data || []).map(schedule => {
          // Se c'è users annidato, estrai user_id da lì, altrimenti usa user_id diretto
          const userId = schedule.users?.id || schedule.user_id;
          return {
            ...schedule,
            user_id: userId // Assicura che user_id sia sempre presente al livello superiore
          };
        });

        console.log('✅ [AdminAttendance] Normalized schedules:', normalizedSchedules.length, 'total schedules');
        console.log('✅ [AdminAttendance] Normalized data (first 3):', normalizedSchedules.slice(0, 3));

        // Log dettagliato per debug: cerca lo schedule di Ilaria per giovedì (day 4)
        const ilariaId = '4d3535c6-76bd-4027-9b03-39bc7a2b6177';
        const ilariaSchedules = normalizedSchedules.filter(s => s.user_id === ilariaId);
        const ilariaThursday = ilariaSchedules.find(s => Number(s.day_of_week) === 4);
        console.log('🔍 [AdminAttendance] Ilaria schedules:', {
          total: ilariaSchedules.length,
          thursday: ilariaThursday ? {
            day_of_week: ilariaThursday.day_of_week,
            is_working_day: ilariaThursday.is_working_day,
            start_time: ilariaThursday.start_time,
            end_time: ilariaThursday.end_time,
            break_duration: ilariaThursday.break_duration,
            work_type: ilariaThursday.work_type
          } : 'NOT FOUND',
          allDays: ilariaSchedules.map(s => ({
            day: s.day_of_week,
            working: s.is_working_day,
            time: s.start_time && s.end_time ? `${s.start_time}-${s.end_time}` : 'N/A'
          }))
        });

        setWorkSchedules(normalizedSchedules || []);
        console.log('✅ [AdminAttendance] Work schedules state updated:', normalizedSchedules.length, 'schedules');
      } else {
        console.error('❌ [AdminAttendance] Failed to fetch work schedules:', response?.status || 'No response');
      }
    } catch (error) {
      console.error('❌ [AdminAttendance] Error fetching work schedules:', error);
    }
  };

  const fetchSickToday = async () => {
    try {
      // Solo admin può accedere a questo endpoint
      const { user } = useAuthStore.getState();
      if (user?.role !== 'admin') {
        console.log('⚠️ Access denied to sick-today (expected for non-admin)');
        return;
      }

      console.log('🔄 Fetching sick leave requests for today...');
      const response = await apiCall('/api/attendance/sick-today');
      if (response.ok) {
        const data = await response.json();
        console.log('🏥 Sick leave requests for today:', data);
        setSickToday(data);
      } else if (response.status === 403) {
        // 403 è atteso per non-admin, ignora silenziosamente
        console.log('⚠️ Access denied to sick-today (expected for non-admin)');
      } else {
        console.error('❌ Failed to fetch sick leave requests:', response.status, response.statusText);
      }
    } catch (error) {
      // Ignora errori 403 (accesso negato) per non-admin
      if (error.message?.includes('403') || error.message?.includes('Accesso negato')) {
        console.log('⚠️ Access denied to sick-today (expected for non-admin)');
        return;
      }
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

  const fetchVacationsToday = async () => {
    try {
      const { user } = useAuthStore.getState();
      if (user?.role !== 'admin') {
        console.log('⚠️ Access denied to vacations-today (expected for non-admin)');
        return;
      }

      console.log('🔄 Fetching vacation requests for today...');
      const today = getTodayLocal();
      const response = await apiCall(`/api/leave-requests?type=vacation&status=approved`);
      if (response.ok) {
        const data = await response.json();
        // Filtra solo le ferie che includono oggi
        const todayVacations = data.filter(vacation => {
          const start = new Date(vacation.startDate || vacation.start_date);
          const end = new Date(vacation.endDate || vacation.end_date);
          const todayDate = new Date(today);
          return todayDate >= start && todayDate <= end;
        });
        console.log('🏖️ Vacation requests for today:', todayVacations);
        setVacationsToday(todayVacations);
      } else if (response.status === 403) {
        console.log('⚠️ Access denied to vacations-today (expected for non-admin)');
      } else {
        console.error('❌ Failed to fetch vacation requests:', response.status, response.statusText);
      }
    } catch (error) {
      if (error.message?.includes('403') || error.message?.includes('Accesso negato')) {
        console.log('⚠️ Access denied to vacations-today (expected for non-admin)');
        return;
      }
      console.error('❌ Error fetching vacation requests:', error);
    }
  };

  const fetchPermissionHoursForEmployeesList = async (employeesList) => {
    try {
      const employees = employeesList || allEmployees;
      const today = getTodayLocal();
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
    console.log('🔄 Admin calculating real-time stats (using shared utility)...');

    if (!workSchedules || workSchedules.length === 0) {
      console.log('⚠️ No work schedules available for admin stats');
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTimeStr = now.toTimeString().substring(0, 5); // HH:MM

    let workedToday = 0; // Chi ha lavorato oggi
    let currentlyPresent = 0; // Chi è fisicamente presente ora
    let absentToday = 0; // Chi doveva lavorare ma non ha lavorato

    // Usa i workSchedules già caricati invece di fare chiamate API
    const todaySchedules = workSchedules.filter(schedule =>
      Number(schedule.day_of_week) === Number(dayOfWeek) && schedule.is_working_day
    );

    console.log(`📊 Admin stats: ${todaySchedules.length} working schedules today`);

    todaySchedules.forEach(schedule => {
      // Usa la utility condivisa per il calcolo
      const result = calculateRealTimeHours(schedule, now);

      const { actualHours, status } = result;
      const { start_time, end_time } = schedule;

      // Aggiorna le statistiche
      if (actualHours > 0) {
        workedToday++;
      }

      if (currentTimeStr >= start_time && currentTimeStr <= end_time) {
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
      case 'working': return 'bg-yellow-900 text-yellow-100 border-yellow-700';
      case 'not_started': return 'bg-yellow-900 text-yellow-100 border-yellow-700';
      case 'absent': return 'bg-red-900 text-red-100 border-red-700';
      case 'sick_leave': return 'bg-red-900 text-red-100 border-red-700';
      case 'vacation': return 'bg-purple-900 text-purple-100 border-purple-700';
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
      case 'vacation': return 'In Ferie';
      case 'permission_104': return 'Permesso 104';
      case 'holiday': return 'Festivo';
      case 'non_working_day': return 'Non lavorativo';
      default: return 'Sconosciuto';
    }
  };

  // Calcola le ore real-time per un employee ID
  const calculateRealTimeHoursForEmployee = (employeeId) => {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Trova l'orario di lavoro per questo dipendente
    const workSchedule = workSchedules.find(schedule =>
      schedule.user_id === employeeId &&
      Number(schedule.day_of_week) === Number(dayOfWeek) &&
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

    // Usa la utility condivisa
    const result = calculateRealTimeHours(workSchedule, now);

    return {
      actualHours: result.actualHours,
      expectedHours: result.expectedHours,
      balanceHours: result.balanceHours,
      status: result.status,
      isPresent: result.status === 'working' || result.status === 'on_break'
    };
  };

  // Calcola le ore real-time per un record
  const calculateRealTimeHoursForRecord = (record) => {
    const now = new Date();
    const today = getTodayLocal();
    const recordDate = record.date;

    // Converti le date in oggetti Date per confronto corretto
    const todayDate = new Date(today);
    const recordDateObj = new Date(recordDate);
    // Reset hours to compare dates only
    todayDate.setHours(0, 0, 0, 0);
    recordDateObj.setHours(0, 0, 0, 0);

    const isPast = recordDateObj < todayDate;
    const isToday = recordDate === today;
    const isFuture = recordDateObj > todayDate;

    // Se è oggi, controlla prima se è in malattia o ferie (PRIORITÀ MASSIMA)
    if (isToday) {
      // Check sick leave
      const isSickToday = sickToday.some(sickRequest =>
        sickRequest.user_id === record.user_id &&
        new Date(sickRequest.start_date) <= new Date(today) &&
        new Date(sickRequest.end_date) >= new Date(today)
      );

      if (isSickToday) {
        return {
          expectedHours: 0,
          actualHours: 0,
          balanceHours: 0,
          status: 'sick_leave',
          isPresent: false
        };
      }

      // Check vacation
      const isVacationToday = vacationsToday.some(vacation =>
        vacation.user_id === record.user_id &&
        new Date(vacation.startDate || vacation.start_date) <= new Date(today) &&
        new Date(vacation.endDate || vacation.end_date) >= new Date(today)
      );

      if (isVacationToday) {
        return {
          expectedHours: 0,
          actualHours: 0,
          balanceHours: 0,
          status: 'vacation',
          isPresent: false
        };
      }

      // Check 104 permission
      const has104Today = permissions104Today.some(perm104 =>
        perm104.user_id === record.user_id &&
        new Date(perm104.start_date) <= new Date(today) &&
        new Date(perm104.end_date) >= new Date(today)
      );

      if (has104Today) {
        // Trova l'orario di lavoro per questo dipendente nel giorno corrente
        const dayOfWeek = todayDate.getDay();
        const scheduleForDay = workSchedules.find(schedule =>
          schedule.user_id === record.user_id &&
          Number(schedule.day_of_week) === Number(dayOfWeek) &&
          schedule.is_working_day === true
        );

        let expectedHours104 = record.expected_hours || 0;

        if (scheduleForDay && scheduleForDay.start_time && scheduleForDay.end_time) {
          const [startHour, startMin] = scheduleForDay.start_time.split(':').map(Number);
          const [endHour, endMin] = scheduleForDay.end_time.split(':').map(Number);
          const breakDuration = scheduleForDay.break_duration !== null && scheduleForDay.break_duration !== undefined ? scheduleForDay.break_duration : 0;

          const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          const workMinutes = Math.max(0, totalMinutes - breakDuration);
          expectedHours104 = workMinutes / 60;
        }

        return {
          expectedHours: expectedHours104,
          actualHours: 0,
          balanceHours: 0,
          status: 'permission_104',
          isPresent: false
        };
      }

      // Normal calculation for today
      const dayOfWeek = todayDate.getDay();
      const workSchedule = workSchedules.find(schedule =>
        schedule.user_id === record.user_id &&
        Number(schedule.day_of_week) === Number(dayOfWeek) &&
        schedule.is_working_day === true
      );

      if (!workSchedule) {
        return {
          expectedHours: 0,
          actualHours: 0,
          balanceHours: 0,
          status: 'non_working_day',
          isPresent: false
        };
      }

      // Se la DATA del record è passata (non è oggi), usa sempre i dati del database
      const recordDate = new Date(record.date + 'T00:00:00');
      const todayLocal = getTodayLocal();
      const isRecordDatePast = record.date < todayLocal;
      
      if (isRecordDatePast) {
        // Data passata: usa sempre i dati del database
        const expected = record.expected_hours || 0;
        const actual = record.actual_hours || 0;
        const balance = record.balance_hours !== undefined ? record.balance_hours : (actual - expected);
        
        // Determina status in base ai dati
        // IMPORTANTE: Controlla prima se c'è una ferie approvata (is_vacation o leave_type)
        let status = 'completed';
        if (record.is_vacation || record.leave_type === 'vacation') {
          status = 'vacation';
        } else if (actual === 0 && expected > 0) {
          status = 'absent';
        } else if (record.notes && record.notes.includes('Malattia')) {
          status = 'sick_leave';
        } else if (record.notes && record.notes.includes('Ferie')) {
          status = 'vacation';
        } else if (expected === 0) {
          status = 'non_working_day';
        }
        
        return {
          expectedHours: expected,
          actualHours: actual,
          balanceHours: balance,
          status: status,
          isPresent: false
        };
      }
      
      // Se è OGGI ma la giornata lavorativa è già conclusa E ci sono dati nel database, usa quelli
      if (workSchedule.end_time && record.actual_hours > 0) {
        const [endHour, endMin] = workSchedule.end_time.split(':').map(Number);
        const endTime = new Date(todayDate);
        endTime.setHours(endHour, endMin, 0, 0);
        
        // Se l'orario di fine è già passato, usa i dati del database
        if (now > endTime) {
          const expected = record.expected_hours || 0;
          const actual = record.actual_hours || 0;
          const balance = record.balance_hours || (actual - expected);
          
          return {
            expectedHours: expected,
            actualHours: actual,
            balanceHours: balance,
            status: 'completed',
            isPresent: false
          };
        }
      }

      // Check permissions (early exit / late entry)
      const permissionData = permissionsHoursToday[record.user_id];
      let utilityPermissionData = null;

      if (permissionData?.permissions) {
        const earlyExitPerm = permissionData.permissions.find(p => p.type === 'early_exit' && p.exitTime);
        const lateEntryPerm = permissionData.permissions.find(p => p.type === 'late_entry' && p.entryTime);

        if (earlyExitPerm || lateEntryPerm) {
          utilityPermissionData = {};
          if (earlyExitPerm) utilityPermissionData.exit_time = earlyExitPerm.exitTime;
          if (lateEntryPerm) utilityPermissionData.entry_time = lateEntryPerm.entryTime;
        }
      }

      // Use shared utility
      const result = calculateRealTimeHours(workSchedule, now, utilityPermissionData);

      return {
        expectedHours: result.expectedHours,
        actualHours: result.actualHours,
        balanceHours: result.balanceHours,
        status: result.status,
        isPresent: result.status === 'working' || result.status === 'on_break'
      };
    }

    // PAST DATES
    if (isPast) {
      // Recalculate expected hours from schedule
      const recordDayOfWeek = recordDateObj.getDay();
      const scheduleForDay = workSchedules.find(schedule =>
        schedule.user_id === record.user_id &&
        Number(schedule.day_of_week) === Number(recordDayOfWeek) &&
        schedule.is_working_day === true
      );

      let expectedHoursFromSchedule = record.expected_hours || 0;

      if (scheduleForDay && scheduleForDay.start_time && scheduleForDay.end_time) {
        const [startHour, startMin] = scheduleForDay.start_time.split(':').map(Number);
        const [endHour, endMin] = scheduleForDay.end_time.split(':').map(Number);
        const breakDuration = scheduleForDay.break_duration !== null && scheduleForDay.break_duration !== undefined ? scheduleForDay.break_duration : 0;

        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const workMinutes = Math.max(0, totalMinutes - breakDuration);
        expectedHoursFromSchedule = workMinutes / 60;
      }

      const actual = record.actual_hours || 0;
      const balance = actual - expectedHoursFromSchedule;

      // Determine status
      // IMPORTANTE: Controlla prima se è una ferie (is_vacation o leave_type)
      let status = 'completed';
      if (record.is_vacation || record.leave_type === 'vacation') {
        status = 'vacation';
      } else if (actual === 0 && expectedHoursFromSchedule > 0) {
        status = 'absent';
      } else if (record.notes && record.notes.includes('Malattia')) {
        status = 'sick_leave';
      } else if (record.notes && record.notes.includes('Ferie')) {
        status = 'vacation'; // Cambiato da 'holiday' a 'vacation'
      } else if (expectedHoursFromSchedule === 0) {
        status = 'non_working_day';
      }

      return {
        expectedHours: expectedHoursFromSchedule,
        actualHours: actual,
        balanceHours: balance,
        status: status,
        isPresent: false
      };
    }

    // FUTURE DATES
    if (isFuture) {
      const recordDayOfWeek = recordDateObj.getDay();
      const scheduleForDay = workSchedules.find(schedule =>
        schedule.user_id === record.user_id &&
        Number(schedule.day_of_week) === Number(recordDayOfWeek) &&
        schedule.is_working_day === true
      );

      let expected = 0;
      if (scheduleForDay && scheduleForDay.start_time && scheduleForDay.end_time) {
        const [startHour, startMin] = scheduleForDay.start_time.split(':').map(Number);
        const [endHour, endMin] = scheduleForDay.end_time.split(':').map(Number);
        const breakDuration = scheduleForDay.break_duration !== null && scheduleForDay.break_duration !== undefined ? scheduleForDay.break_duration : 0;
        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        expected = Math.max(0, totalMinutes - breakDuration) / 60;
      }

      return {
        expectedHours: expected,
        actualHours: 0,
        balanceHours: 0,
        status: 'scheduled',
        isPresent: false
      };
    }

    return {
      expectedHours: 0,
      actualHours: 0,
      balanceHours: 0,
      status: 'unknown',
      isPresent: false
    };
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
      // IMPORTANTE: filtra solo le presenze di OGGI, escludi quelle di ieri
      const today = getTodayLocal();
      data = attendance.filter(record => record.date === today);

      // Aggiungi dati real-time se non ci sono record per oggi nel database
      const hasTodayInDatabase = data.length > 0;

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
      // Per "Cronologia" usa attendanceHistory (già filtrato dal backend per mese/anno/userId)
      const today = getTodayLocal();

      // Ottieni il mese/anno corrente
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Il backend già filtra per mese/anno/userId, quindi usiamo direttamente i dati
      data = [...attendanceHistory];

      // Aggiungi dati real-time per oggi SOLO se il mese/anno selezionato è quello corrente
      const isCurrentPeriod = selectedMonth === currentMonth && selectedYear === currentYear;
      const hasTodayInHistory = attendanceHistory.some(record => record.date === today);

      if (!hasTodayInHistory && allEmployees.length > 0 && isCurrentPeriod) {
        // Calcola dati real-time per tutti i dipendenti che hanno lavorato oggi
        const employeesToProcess = allEmployees.filter(emp => emp.role !== 'admin');

        const todayRealTimeData = employeesToProcess
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
        // IMPORTANTE: mostra solo le presenze di OGGI, non di ieri
        const today = getTodayLocal();
        if (record.date !== today) {
          return false; // Escludi date passate o future dalla tab "Oggi"
        }
        
        // Mostra chi ha lavorato oggi O è in malattia/ferie/permesso 104
        // O ha già completato la giornata (actual_hours > 0 nel database)
        const realTimeData = calculateRealTimeHoursForRecord(record);
        const hasCompletedDay = (record.actual_hours || 0) > 0;
        const actualHoursToCheck = hasCompletedDay ? record.actual_hours : realTimeData.actualHours;
        return actualHoursToCheck > 0 || 
               realTimeData.status === 'sick_leave' || 
               realTimeData.status === 'holiday' || 
               realTimeData.status === 'permission_104' ||
               realTimeData.status === 'completed';
      }

      return true;
    });
  })();

  if (loading) {
    return <AdminAttendanceSkeleton />;
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
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
              className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${activeTab === 'today'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
            >
              <CalendarDays className="h-4 w-4" />
              Oggi
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
            >
              <BarChart3 className="h-4 w-4" />
              Cronologia
            </button>
          </div>
        </div>

        {/* Filtri e Export - Solo in Cronologia */}
        {activeTab === 'history' && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-slate-300 mb-2">Cerca Dipendente</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nome o cognome..."
                    className="w-full pl-10 pr-3 py-2 h-[42px] bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="w-full sm:w-auto min-w-[140px]">
                <label className="block text-sm font-medium text-slate-300 mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full h-[42px] bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleDateString('it-IT', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-auto min-w-[100px]">
                <label className="block text-sm font-medium text-slate-300 mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full h-[42px] bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

              {/* Pulsante Esporta report - Solo in Cronologia */}
              <div className="w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadMonthlyReportExcel}
                  disabled={downloadingExcel}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 h-[42px] text-sm font-medium transition whitespace-nowrap ${downloadingExcel
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-500'
                    }`}
                >
                  <FileText className="h-4 w-4" />
                  {downloadingExcel ? 'Creazione report...' : 'Esporta report'}
                </button>
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

          {/* Mobile Cards - Responsive: 1 colonna su mobile, 2 su tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 lg:hidden">
            {filteredData.map((record) => {
              const realTime = record.is_realtime ? {
                expectedHours: record.expected_hours,
                actualHours: record.actual_hours,
                balanceHours: record.balance_hours,
                status: record.status
              } : calculateRealTimeHoursForRecord(record);
              const name = record.users ? `${record.users.first_name} ${record.users.last_name}` : 'N/A';
              return (
                <div key={record.id || record.user_id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-3 sm:p-4 hover:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="font-semibold text-white truncate text-sm sm:text-base flex-1 min-w-0">{name}</div>
                    <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs border flex-shrink-0 ${getStatusColor(realTime.status)}`}>{getStatusText(realTime.status)}</span>
                  </div>
                  <div className="text-slate-400 text-xs sm:text-sm mb-3">{new Date(record.date).toLocaleDateString('it-IT')}</div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-slate-400 text-[10px] sm:text-xs mb-1">Attese</div>
                      <div className="font-mono text-white text-xs sm:text-sm font-semibold">{formatHours(realTime.expectedHours)}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-slate-400 text-[10px] sm:text-xs mb-1">Effettive</div>
                      <div className="font-mono text-white text-xs sm:text-sm font-semibold">{formatHours(realTime.actualHours)}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <div className="text-slate-400 text-[10px] sm:text-xs mb-1">Saldo</div>
                      <div className={`font-mono font-bold text-xs sm:text-sm ${realTime.balanceHours > 0 ? 'text-green-400' : realTime.balanceHours < 0 ? 'text-red-400' : 'text-slate-400'}`}>{realTime.balanceHours > 0 ? '+' : ''}{formatHours(realTime.balanceHours)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleViewAttendanceDetails(record)}
                      className="flex-1 py-2 px-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 text-xs sm:text-sm rounded-lg transition-colors border border-green-500/30 touch-manipulation min-h-[44px] flex items-center justify-center"
                    >
                      Dettagli
                    </button>
                    {!record.is_realtime && !record.is_vacation && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditRecord(record); }}
                          className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors border border-blue-500/30 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Modifica"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRecordToDelete(record); setShowDeleteConfirm(true); }}
                          className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors border border-red-500/30 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
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
                        const today = getTodayLocal();
                        const recordDate = record.date;

                        // Converti le date in oggetti Date per confronto corretto
                        const todayDate = new Date(today + 'T00:00:00');
                        const recordDateObj = new Date(recordDate + 'T00:00:00');
                        const isPast = recordDate < today;
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
                        // IMPORTANTE: realTimeData per giorni passati ricalcola già le ore attese dallo schedule
                        if (isToday) {
                          // Oggi: usa sempre real-time (include controllo malattie)
                          finalStatus = realTimeData.status;
                          finalActualHours = realTimeData.actualHours;
                          finalExpectedHours = realTimeData.expectedHours;
                          finalBalanceHours = realTimeData.balanceHours;
                        } else if (hasActualData || isPast) {
                          // Giorno passato: usa actual_hours dal DB (sono già salvati), ma expectedHours ricalcolato dallo schedule
                          finalActualHours = record.actual_hours || 0;
                          finalExpectedHours = realTimeData.expectedHours; // Usa il valore ricalcolato dallo schedule (non DB)
                          finalBalanceHours = finalActualHours - finalExpectedHours; // Ricalcola il balance
                          // Usa lo status calcolato da realTimeData (che include 'completed' per giornate concluse)
                          finalStatus = realTimeData.status;
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
                                disabled={record.is_realtime || record.is_vacation}
                                className={`p-2 rounded-lg transition-colors ${record.is_realtime || record.is_vacation
                                  ? 'text-slate-500 cursor-not-allowed opacity-50'
                                  : 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20'
                                  }`}
                                title={record.is_realtime ? "Dati real-time non modificabili" : record.is_vacation ? "Giorno di ferie non modificabile" : "Modifica record"}
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setRecordToDelete(record);
                                  setShowDeleteConfirm(true);
                                }}
                                disabled={record.is_realtime || record.is_vacation}
                                className={`p-2 rounded-lg transition-colors ${record.is_realtime || record.is_vacation
                                  ? 'text-slate-500 cursor-not-allowed opacity-50'
                                  : 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
                                  }`}
                                title={record.is_realtime ? "Dati real-time non eliminabili" : record.is_vacation ? "Giorno di ferie non eliminabile" : "Elimina record"}
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
                        setEditForm({ ...editForm, actual_hours: value });
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
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${generateStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                    1
                  </div>
                  <div className={`flex-1 h-1 mx-2 ${generateStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'
                    }`}></div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${generateStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
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
                      onChange={(e) => setGenerateForm({ ...generateForm, employeeId: e.target.value })}
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
                        onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                        className="w-full border border-slate-600 bg-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Data Fine</label>
                      <input
                        type="date"
                        value={generateForm.endDate}
                        onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })}
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