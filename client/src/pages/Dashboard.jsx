import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/store';
import { formatHours } from '../utils/hoursCalculation';
import { DashboardEmployeeSkeleton, DashboardAdminSkeleton } from '../components/Skeleton';
import {
  Users,
  Clock,
  FileText,
  CheckCircle,
  Activity,
  Target,
  Calendar,
  XCircle,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Plane,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import HolidaysCalendar from '../components/HolidaysCalendar';

const Dashboard = () => {
  const { user, apiCall } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    presentToday: 0,
    pendingRequests: 0,
    monthlyBalance: 0
  });
  const [weeklyAttendance, setWeeklyAttendance] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [currentAttendance, setCurrentAttendance] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sickToday, setSickToday] = useState([]); // Dipendenti in malattia oggi
  const [upcomingEvents, setUpcomingEvents] = useState([]); // Eventi imminenti
  
  // Stati per KPI utente
  const [userKPIs, setUserKPIs] = useState({
    workedToday: '0h 0m',
    remainingToday: '0h 0m',
    monthlyPresences: '0/20'
  });
  
  // Dati per calcoli real-time
  const [attendanceData, setAttendanceData] = useState([]);
  const [workSchedules, setWorkSchedules] = useState([]);
  
  // Dati aggiuntivi per dipendente
  const [overtimeBalance, setOvertimeBalance] = useState(null);
  const [vacationBalance, setVacationBalance] = useState(null);
  
  // Stati per sezioni collassabili
  const [eventsCollapsed, setEventsCollapsed] = useState(false);
  const [bancaOreCollapsed, setBancaOreCollapsed] = useState(false);
  const [ferieCollapsed, setFerieCollapsed] = useState(false);
  const [sickTodayCollapsed, setSickTodayCollapsed] = useState(false);
  const [recoveriesCollapsed, setRecoveriesCollapsed] = useState(false);
  const [presentNowCollapsed, setPresentNowCollapsed] = useState(false);
  const [recentRequestsCollapsed, setRecentRequestsCollapsed] = useState(false);
  const [todayEventsCollapsed, setTodayEventsCollapsed] = useState(false);
  
  // Dati per admin dashboard real-time
  const [adminRealTimeData, setAdminRealTimeData] = useState([]);

  // Dati per recuperi imminenti (admin) - solo per alert
  const [upcomingRecoveries, setUpcomingRecoveries] = useState([]);
  // Recuperi approvati per oggi (per mostrare pill "recupero ore")
  const [todayRecoveries, setTodayRecoveries] = useState([]);
  // Lista di tutti i dipendenti (per includere quelli con recuperi ma senza presenza)
  const [allEmployees, setAllEmployees] = useState([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch dashboard stats
        await fetchDashboardData();
        
        // Fetch data based on role - in parallelo per velocità
        console.log('🔍 Dashboard loading for user role:', user?.role);
        if (user?.role === 'admin') {
          // Admin: fetch real-time data in parallelo
          console.log('🔍 Loading admin data...');
          await Promise.all([
            fetchEmployees(),
            fetchAdminWorkSchedules(),
            fetchSickToday(), // Fetch employees on sick leave today
            fetchRecentRequests(),
            fetchUpcomingRecoveries(),
            fetchAllEmployeesForRecoveries() // Fetch all employees per includere quelli con recuperi
          ]);
          // Calcola dopo che i dati sono caricati
          calculateAdminRealTimeData();
        } else {
          // Employee: fetch personal data in parallelo
          console.log('🔍 Loading employee data...');
          await Promise.all([
            fetchAttendanceData(),
            fetchWorkSchedules(),
            fetchOvertimeBalance(),
            fetchVacationBalance()
          ]);
        }
        
        // Fetch upcoming events for all users (non critico, può caricare dopo)
        fetchUpcomingEvents().catch(console.error);
        
        // Timer per ricaricare i dati ogni 30 secondi
        const refreshTimer = setInterval(() => {
          if (user?.role === 'employee') {
            console.log('🔄 Refreshing employee data...');
            fetchAttendanceData(); // Questo chiamerà updateKPIsWithBalance
            fetchOvertimeBalance(); // Aggiorna anche il balance banca ore
          } else if (user?.role === 'admin') {
            console.log('🔄 Refreshing admin data...');
            fetchEmployees();
            fetchAdminWorkSchedules();
            calculateAdminRealTimeData();
            fetchSickToday();
          }
        }, 30000); // Ogni 30 secondi
        
        // Timer per aggiornare i KPI ogni minuto (per aggiornare le ore in tempo reale)
        const kpiTimer = setInterval(() => {
          if (user?.role === 'employee') {
            fetchAttendanceData(); // Questo aggiornerà anche i KPI
          }
        }, 60000); // Ogni minuto
        
        // Nasconde il loading PRIMA di caricare dati secondari (grafici)
        setLoading(false);
        
        // Fetch weekly attendance data (solo per admin) - dati secondari, non bloccano il loading
        if (user?.role === 'admin') {
          Promise.all([
            apiCall('/api/dashboard/attendance').then(response => {
              if (response.ok) {
                return response.json().then(data => {
                  setWeeklyAttendance(data || []);
                });
              }
            }),
            apiCall('/api/departments').then(response => {
              if (response.ok) {
                return response.json().then(departmentsData => {
                  if (departmentsData && departmentsData.length > 0) {
                    const chartData = departmentsData.map((dept, index) => ({
                      name: dept.name,
                      value: dept.employee_count || 0,
                      color: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][index % 4],
                      employees: dept.employee_count || 0
                    }));
                    setDepartments(chartData);
                  } else {
                    setDepartments([]);
                  }
                });
              }
            })
          ]).catch(console.error);
        }
        
        return () => {
          clearInterval(refreshTimer);
          clearInterval(kpiTimer);
        };
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        setLoading(false);
      }
    };
    
    loadDashboardData();
    
  }, [user?.role]);

  // Ricalcola i KPI quando cambiano i dati di attendance o work schedules
  useEffect(() => {
    if (user?.role === 'employee' && attendanceData.length > 0 && workSchedules.length > 0) {
      // Non calcolare KPI localmente, usa solo l'endpoint
      console.log('📊 Attendance and work schedules loaded, KPI will be updated by endpoint');
    }
  }, [attendanceData, workSchedules, user?.role]);

  // Ricalcola i dati admin quando cambiano workSchedules, currentAttendance, todayRecoveries o allEmployees
  useEffect(() => {
    if (user?.role === 'admin' && workSchedules.length > 0 && (currentAttendance.length > 0 || todayRecoveries.length > 0)) {
      calculateAdminRealTimeData();
    }
  }, [workSchedules, currentAttendance, todayRecoveries, allEmployees, user?.role]);

  const fetchAttendanceData = async () => {
    try {
      const response = await apiCall('/api/attendance');
      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data);
        console.log('📊 Attendance data loaded:', data.length, 'records');
        // Non calcolare i KPI localmente, usa solo l'endpoint
      }
      
      // Fetch hours balance from the correct endpoint (same as Presenze page)
      const balanceResponse = await apiCall('/api/attendance/hours-balance');
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        console.log('📊 Hours balance loaded:', balanceData);
        // Update KPIs with correct balance data
        updateKPIsWithBalance(balanceData);
        
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    }
  };

  const fetchWorkSchedules = async () => {
    try {
      const response = await apiCall('/api/work-schedules');
      if (response.ok) {
        const data = await response.json();
        setWorkSchedules(data);
        console.log('📅 Work schedules loaded:', data.length, 'records');
      }
    } catch (error) {
      console.error('Error fetching work schedules:', error);
    }
  };

  // Ricalcola i KPI quando i work schedules sono caricati
  useEffect(() => {
    if (user?.role === 'employee' && workSchedules.length > 0) {
      console.log('🔄 Work schedules loaded, recalculating employee KPIs...');
      // Ricalcola i KPI per il dipendente quando i work schedules sono disponibili
      fetchAttendanceData();
    }
  }, [workSchedules, user?.role]);

  // Fetch employees for admin dashboard
  const fetchEmployees = async () => {
    try {
      // Solo admin può accedere a questo endpoint
      if (user?.role !== 'admin') {
        return;
      }
      
      // Forza refresh senza cache aggiungendo timestamp
      const response = await apiCall(`/api/attendance/current?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 [Dashboard] Fetched current attendance data:', data);
        console.log('🔍 [Dashboard] Status breakdown:', {
          working: data.filter(e => e.status === 'working').length,
          on_break: data.filter(e => e.status === 'on_break').length,
          vacation: data.filter(e => e.status === 'vacation').length,
          sick_leave: data.filter(e => e.status === 'sick_leave').length,
          permission_104: data.filter(e => e.status === 'permission_104').length,
          completed: data.filter(e => e.status === 'completed').length,
          other: data.filter(e => !['working', 'on_break', 'vacation', 'sick_leave', 'permission_104', 'completed'].includes(e.status)).length
        });
        
        // Log specifico per dipendenti in ferie
        const vacationEmployees = data.filter(e => e.status === 'vacation');
        if (vacationEmployees.length > 0) {
          console.log('🏖️ [Dashboard] Dipendenti in ferie trovati:', vacationEmployees.map(e => `${e.first_name} ${e.last_name} (${e.status})`));
        } else {
          console.log('⚠️ [Dashboard] Nessun dipendente in ferie trovato nei dati');
        }
        
        setCurrentAttendance(data);
        console.log('📊 [Dashboard] Current attendance loaded:', data.length, 'employees');
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

  // Fetch work schedules for admin dashboard
  const fetchAdminWorkSchedules = async () => {
    try {
      const response = await apiCall('/api/work-schedules');
      if (response.ok) {
        const data = await response.json();
        setWorkSchedules(data);
      }
    } catch (error) {
      console.error('Error fetching admin work schedules:', error);
    }
  };

  // Calcolo real-time per admin dashboard (stesso sistema del dipendente)
  const calculateAdminRealTimeData = () => {
    console.log('🔄 Admin dashboard calculating real-time data...');
    console.log('🔍 Current attendance state:', currentAttendance);
    console.log('🔍 Current attendance length:', currentAttendance?.length || 0);
    
    // Permetti il calcolo anche se non ci sono dati di presenza, ma ci sono recuperi
    if ((!currentAttendance || currentAttendance.length === 0) && (!todayRecoveries || todayRecoveries.length === 0)) {
      console.log('⚠️ No data available for admin real-time calculation');
      setAdminRealTimeData([]);
      return;
    }
    
    // Log status breakdown prima del processing
    const statusBreakdown = {
      vacation: currentAttendance.filter(e => e.status === 'vacation').length,
      working: currentAttendance.filter(e => e.status === 'working').length,
      sick_leave: currentAttendance.filter(e => e.status === 'sick_leave').length,
      permission_104: currentAttendance.filter(e => e.status === 'permission_104').length,
      other: currentAttendance.filter(e => !['vacation', 'working', 'sick_leave', 'permission_104'].includes(e.status)).length
    };
    console.log('🔍 Status breakdown BEFORE processing:', statusBreakdown);

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Verifica se un dipendente ha un recupero approvato per oggi e restituisce i dettagli
    const getRecoveryToday = (userId) => {
      return todayRecoveries.find(recovery => recovery.user_id === userId);
    };
    
    // Verifica se un recupero è attualmente in corso o terminato
    const getRecoveryStatus = (recovery) => {
      if (!recovery) return null;
      
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // minuti dall'inizio del giorno
      
      const [startHour, startMin] = recovery.start_time.split(':').map(Number);
      const [endHour, endMin] = recovery.end_time.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      if (currentTime < startTime) {
        return 'scheduled'; // Recupero programmato ma non ancora iniziato
      } else if (currentTime >= startTime && currentTime < endTime) {
        return 'active'; // Recupero in corso
      } else {
        return 'completed'; // Recupero terminato
      }
    };

    // Ricalcola lo status real-time per ogni employee
    const realTimeData = currentAttendance.map(employee => {
      // Verifica se ha un recupero per oggi
      const recoveryToday = getRecoveryToday(employee.user_id);
      const recoveryStatus = getRecoveryStatus(recoveryToday);
      
      // IMPORTANTE: Preserva lo status per ferie, malattia, permessi 104
      // Questi status non devono essere modificati
      if (employee.status === 'vacation' || employee.status === 'sick_leave' || employee.status === 'permission_104') {
        console.log(`👤 [Dashboard] ${employee.first_name} ${employee.last_name}: status=${employee.status} (preservato)`);
        const preserved = {
          ...employee,
          status: employee.status,
          is_working_day: employee.is_working_day || true,
          is_absent: false,
          hasRecoveryToday: !!recoveryToday,
          recoveryToday: recoveryToday,
          recoveryStatus: recoveryStatus
        };
        console.log(`👤 [Dashboard] Preserved employee data:`, preserved);
        return preserved;
      }

      // Trova lo schedule per oggi
      const todaySchedule = workSchedules.find(schedule => 
        schedule.user_id === employee.user_id && 
        schedule.day_of_week === now.getDay()
      );

      let finalStatus = employee.status;

      if (todaySchedule && employee.is_working_day) {
        const [endHour, endMin] = todaySchedule.end_time.split(':').map(Number);
        
        // Controlla se c'è un permesso di uscita anticipata
        const permissionEndTime = employee.permission_end_time;
        const effectiveEndHour = permissionEndTime ? parseInt(permissionEndTime.split(':')[0]) : endHour;
        const effectiveEndMin = permissionEndTime ? parseInt(permissionEndTime.split(':')[1]) : endMin;

        // Se l'ora attuale è dopo l'ora di fine (considerando permessi)
        if (currentHour > effectiveEndHour || (currentHour === effectiveEndHour && currentMinute >= effectiveEndMin)) {
          // Se ha lavorato, status è completed, altrimenti absent
          finalStatus = employee.actual_hours > 0 ? 'completed' : 'absent';
        }
      }

      console.log(`👤 ${employee.first_name} ${employee.last_name}: status=${employee.status} -> ${finalStatus}, permissionEnd=${employee.permission_end_time}`);

      return {
        ...employee,
        status: finalStatus,
        is_working_day: employee.is_working_day || true,
        is_absent: finalStatus === 'not_started' && employee.actual_hours === 0,
        hasRecoveryToday: !!recoveryToday,
        recoveryToday: recoveryToday,
        recoveryStatus: recoveryStatus
      };
    });
    
    // Aggiungi dipendenti con recuperi che non sono in currentAttendance
    const employeesWithRecoveriesNotInAttendance = todayRecoveries
      .filter(recovery => {
        // Verifica se il dipendente non è già in realTimeData
        return !realTimeData.some(emp => emp.user_id === recovery.user_id);
      })
      .map(recovery => {
        // Trova i dati del dipendente da allEmployees
        const employee = allEmployees.find(emp => emp.id === recovery.user_id);
        if (!employee) return null;
        
        const recoveryStatus = getRecoveryStatus(recovery);
        
        // Crea un entry virtuale per il dipendente con recupero
        return {
          user_id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          name: `${employee.first_name} ${employee.last_name}`,
          department: employee.department || 'Non specificato',
          status: recoveryStatus === 'completed' ? 'recovery_completed' : 
                  recoveryStatus === 'active' ? 'recovery_active' : 
                  'recovery_scheduled',
          is_working_day: true,
          is_absent: false,
          actual_hours: 0,
          expected_hours: 0,
          balance_hours: 0,
          hasRecoveryToday: true,
          recoveryToday: recovery,
          recoveryStatus: recoveryStatus
        };
      })
      .filter(emp => emp !== null); // Rimuovi null se employee non trovato
    
    // Combina i dati esistenti con quelli dei dipendenti con recuperi
    const finalRealTimeData = [...realTimeData, ...employeesWithRecoveriesNotInAttendance];
    
    // Log status breakdown dopo il processing
    const finalStatusBreakdown = {
      vacation: finalRealTimeData.filter(e => e.status === 'vacation').length,
      working: finalRealTimeData.filter(e => e.status === 'working').length,
      sick_leave: finalRealTimeData.filter(e => e.status === 'sick_leave').length,
      permission_104: finalRealTimeData.filter(e => e.status === 'permission_104').length,
      other: finalRealTimeData.filter(e => !['vacation', 'working', 'sick_leave', 'permission_104'].includes(e.status)).length
    };
    console.log('📊 Admin real-time data calculated:', finalRealTimeData.length, 'employees');
    console.log('🔍 Status breakdown AFTER processing:', finalStatusBreakdown);
    setAdminRealTimeData(finalRealTimeData);
  };

  const fetchRecentRequests = async () => {
    try {
      if (user?.role === 'admin') {
        const response = await apiCall('/api/leave-requests');
        if (response.ok) {
          const data = await response.json();
          // Filtra solo le richieste pending degli ultimi 7 giorni
          const recent = data.filter(req => {
            const requestDate = new Date(req.submittedAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return req.status === 'pending' && requestDate >= weekAgo;
          }).slice(0, 5); // Massimo 5 richieste recenti
          setRecentRequests(recent);
        }
      }
    } catch (error) {
      console.error('Error fetching recent requests:', error);
    }
  };

  const fetchSickToday = async () => {
    try {
      // Solo admin può accedere a questo endpoint
      if (user?.role !== 'admin') {
        return;
      }
      
        const response = await apiCall('/api/attendance/sick-today');
        if (response.ok) {
          const data = await response.json();
          setSickToday(data);
          console.log('🤒 Employees sick today:', data.length);
      } else if (response.status === 403) {
        // 403 è atteso per non-admin, ignora silenziosamente
        console.log('⚠️ Access denied to sick-today (expected for non-admin)');
      } else {
        console.error('❌ Failed to fetch sick today:', response.status);
      }
    } catch (error) {
      // Ignora errori 403 (accesso negato) per non-admin
      if (error.message?.includes('403') || error.message?.includes('Accesso negato')) {
        console.log('⚠️ Access denied to sick-today (expected for non-admin)');
        return;
      }
      console.error('Error fetching sick today:', error);
    }
  };

  // Fetch saldo totale banca ore
  // Fetch tutti i dipendenti (per includere quelli con recuperi ma senza presenza)
  const fetchAllEmployeesForRecoveries = async () => {
    try {
      if (user?.role !== 'admin') return;
      
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setAllEmployees(data || []);
      }
    } catch (error) {
      console.error('Error fetching all employees:', error);
    }
  };

  // Fetch recuperi imminenti (admin) - solo approvati oggi o nei prossimi 7 giorni
  const fetchUpcomingRecoveries = async () => {
    try {
      if (user?.role !== 'admin') return;

      // Fetch sia recuperi approved che completed per includere tutti i recuperi di oggi
      const [approvedResponse, completedResponse] = await Promise.all([
        apiCall('/api/recovery-requests?status=approved'),
        apiCall('/api/recovery-requests?status=completed')
      ]);

      const approvedData = approvedResponse.ok ? await approvedResponse.json() : [];
      const completedData = completedResponse.ok ? await completedResponse.json() : [];
      
      // Combina approved e completed per avere tutti i recuperi
      const allRecoveries = [...(approvedData || []), ...(completedData || [])];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Filtra solo recuperi approvati nei prossimi 7 giorni (non ancora processati)
      const upcoming = allRecoveries.filter(recovery => {
        const recoveryDate = new Date(recovery.recovery_date);
        recoveryDate.setHours(0, 0, 0, 0);
        return recoveryDate >= today && recoveryDate <= nextWeek && !recovery.balance_added && recovery.status === 'approved';
      });

      setUpcomingRecoveries(upcoming);

      // Filtra recuperi per oggi (per pill "recupero ore")
      // IMPORTANTE: Include anche recuperi già processati (balance_added=true o status=completed) se sono di oggi
      // perché il dipendente deve comunque comparire in "Presenti adesso" per tutta la giornata
      const todayRecoveriesList = allRecoveries.filter(recovery => {
        const recoveryDate = new Date(recovery.recovery_date);
        recoveryDate.setHours(0, 0, 0, 0);
        return recoveryDate.getTime() === today.getTime();
      });
      setTodayRecoveries(todayRecoveriesList);
    } catch (error) {
      console.error('Error fetching upcoming recoveries:', error);
    }
  };

  // Fetch saldo banca ore
  const fetchOvertimeBalance = async () => {
    try {
      if (user?.role !== 'employee') return;
      
      const currentYear = new Date().getFullYear();
      // Aggiungi timestamp per evitare cache
      const response = await apiCall(`/api/hours/overtime-balance?year=${currentYear}&_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        setOvertimeBalance(data);
      }
    } catch (error) {
      console.error('Error fetching overtime balance:', error);
    }
  };

  // Fetch saldo ferie
  const fetchVacationBalance = async () => {
    try {
      if (user?.role !== 'employee') return;
      
      const response = await apiCall('/api/vacation-balances');
      if (response.ok) {
        const data = await response.json();
        setVacationBalance(data);
      }
    } catch (error) {
      console.error('Error fetching vacation balance:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const events = [];
      
      // Fetch leave requests approved
      const leaveResponse = await apiCall(`/api/leave-requests?status=approved&startDate=${today.toISOString().split('T')[0]}&endDate=${nextMonth.toISOString().split('T')[0]}`);
      if (leaveResponse.ok) {
        const leaveData = await leaveResponse.json();
        leaveData.forEach(req => {
          // Solo richieste approvate per "In programma oggi"
          if (req.status !== 'approved') return;
          // Valida che le date siano valide prima di aggiungere l'evento
          if (req.start_date && req.end_date) {
            const startDate = new Date(req.start_date);
            const endDate = new Date(req.end_date);
            
            // Verifica che le date siano valide (non NaN)
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              // Determina il tipo specifico di permesso
              let eventName = '';
              if (req.type === 'vacation') {
                eventName = 'Ferie';
              } else if (req.type === 'sick' || req.type === 'sick_leave') {
                eventName = 'Malattia';
              } else if (req.type === 'permission' || req.type === 'permission_104') {
                // Determina tipo specifico di permesso
                if (req.permissionType === 'uscita_anticipata' || req.permissionType === 'early_exit' || req.exitTime || req.exit_time) {
                  eventName = 'Uscita Anticipata';
                } else if (req.permissionType === 'entrata_posticipata' || req.permissionType === 'late_entry' || req.entryTime || req.entry_time) {
                  eventName = 'Entrata Posticipata';
                } else if (req.permissionType === 'full_day' || req.fullDay) {
                  eventName = 'Giornata Intera';
                } else if (req.type === 'permission_104') {
                  eventName = 'Permesso 104';
                } else {
                  eventName = 'Permesso';
                }
              } else {
                eventName = 'Permesso';
              }
              
              events.push({
                date: req.start_date,
                endDate: req.end_date,
                type: req.type,
                permissionType: req.permissionType || req.permission_type,
                name: eventName,
                user: user?.role === 'admin' ? (req.user?.name || (req.users ? `${req.users.first_name} ${req.users.last_name}` : undefined)) : undefined,
                color: req.type === 'vacation' ? 'green' : req.type === 'sick' || req.type === 'sick_leave' ? 'red' : req.type === 'permission' ? 'orange' : 'blue',
                exitTime: req.exitTime || req.exit_time,
                entryTime: req.entryTime || req.entry_time
              });
            }
          }
        });
      }
      
      // Fetch 104 permissions approved (per admin mostrare tutti)
      const perm104Response = await apiCall(`/api/leave-requests?type=permission_104&status=approved&startDate=${today.toISOString().split('T')[0]}&endDate=${nextMonth.toISOString().split('T')[0]}`);
      if (perm104Response.ok) {
        const perm104Data = await perm104Response.json();
        // Filtra solo gli approvati con date valide (include anche quelli di oggi)
        const todayStr = today.toISOString().split('T')[0];
        const approvedPerms = perm104Data.filter(perm => {
          if (!perm.start_date || !perm.end_date || !perm.status || perm.status !== 'approved') {
            return false;
          }
          const startDate = new Date(perm.start_date);
          const endDate = new Date(perm.end_date);
          
          // Verifica che le date siano valide
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return false;
          }
          
          // Include permessi 104 che sono oggi o futuri (confronta solo le date, non le ore)
          const startDateStr = startDate.toISOString().split('T')[0];
          const endDateStr = endDate.toISOString().split('T')[0];
          return endDateStr >= todayStr; // Include anche quelli che finiscono oggi
        });
        
        approvedPerms.forEach(perm => {
          if (perm.start_date && perm.end_date) {
            const startDate = new Date(perm.start_date);
            const endDate = new Date(perm.end_date);
            
            // Verifica che le date siano valide
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              // Recupera il nome utente se disponibile
              const userName = user?.role === 'admin' 
                ? (perm.users?.first_name && perm.users?.last_name 
                    ? `${perm.users.first_name} ${perm.users.last_name}`
                    : perm.user_name || 'Dipendente')
                : undefined;
              
              events.push({
                date: perm.start_date,
                endDate: perm.end_date,
                type: 'permission_104',
                name: 'Permesso 104',
                user: userName,
                color: 'purple'
              });
            }
          }
        });
      }
      
      // Filtra ulteriormente eventi con date invalide e ordina
      const validEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return !isNaN(eventDate.getTime());
      });
      
      // Sort by date
      validEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Eventi di oggi DEVONO sempre comparire in "In programma oggi"
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEvents = validEvents.filter(e => {
        const start = new Date(e.date);
        const end = e.endDate ? new Date(e.endDate) : new Date(e.date);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return start.getTime() <= todayStart.getTime() && todayStart.getTime() <= end.getTime();
      });
      const otherEvents = validEvents.filter(e => !todayEvents.includes(e));
      // Mostra sempre tutti gli eventi di oggi + i prossimi 10 futuri
      setUpcomingEvents([...todayEvents, ...otherEvents.slice(0, 10)]);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await apiCall('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  // calculateUserKPIs function removed - now using only hours-balance API endpoint

  const formatHours = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const updateKPIsWithBalance = async (balanceData) => {
    if (user?.role === 'employee') {
      // Usa SOLO l'endpoint /api/attendance/current-hours per coerenza con Presenze
      try {
          // Fetch expected monthly presences from user-stats endpoint
          let expectedMonthlyPresences = 20; // Fallback default
          try {
            const statsResponse = await apiCall('/api/attendance/user-stats');
            if (statsResponse && statsResponse.ok) {
              const statsData = await statsResponse.json();
              expectedMonthlyPresences = statsData.expectedMonthlyPresences || 20;
            }
          } catch (statsError) {
            console.error('❌ Error fetching user stats:', statsError);
          }

        const response = await apiCall('/api/attendance/current-hours');
          if (response && response.ok) {
          const currentHoursData = await response.json();
          
          if (currentHoursData.isWorkingDay) {
            const todayHours = currentHoursData.actualHours || 0;
            const todayContractHours = currentHoursData.contractHours ?? currentHoursData.expectedHours ?? 0;
            const remainingTodayHours = currentHoursData.remainingHours ?? Math.max(0, (currentHoursData.expectedHours || 0) - todayHours);
            
            // Se c'è un permesso 104 o è in ferie, mostra lo status invece delle ore
            const workedTodayDisplay = currentHoursData.status === 'permission_104' 
              ? 'Permesso 104' 
              : currentHoursData.status === 'vacation'
              ? 'In Ferie'
              : formatHours(todayHours);
            const remainingTodayDisplay = currentHoursData.status === 'permission_104' || currentHoursData.status === 'vacation'
              ? '0h 0m' 
              : formatHours(remainingTodayHours);
            
            // Update KPIs with today's hours from the same endpoint
            setUserKPIs(prevKPIs => ({
              ...prevKPIs,
              workedToday: workedTodayDisplay,
              remainingToday: remainingTodayDisplay,
              monthlyPresences: `${balanceData.working_days}/${expectedMonthlyPresences}`
            }));
            
            console.log('✅ KPIs updated with current-hours endpoint:', { 
              todayHours, 
              contractHours: todayContractHours,
              remainingTodayHours,
              workingDays: balanceData.working_days,
              expectedMonthlyPresences
            });
          } else {
            // Non è un giorno lavorativo
            setUserKPIs(prevKPIs => ({
              ...prevKPIs,
              workedToday: '0h 0m',
              remainingToday: '0h 0m',
              monthlyPresences: `${balanceData.working_days}/${expectedMonthlyPresences}`
            }));
          }
        } else {
          console.error('❌ Failed to fetch current hours:', response.status);
        }
      } catch (error) {
        console.error('❌ Error fetching current hours:', error);
        // Non fare fallback, lascia i valori esistenti o usa valori di default
      }
    }
  };

  // Usa i dati reali dal database
  const weeklyAttendanceData = weeklyAttendance;
  const departmentData = departments;

  // Funzione per gestire il click sui KPI
  const handleKPIClick = (key) => {
    // Tutti i KPI portano alla pagina Presenze
    navigate('/presenze');
  };

  // Statistiche diverse per admin e utenti
  const statCards = user?.role === 'admin' ? [] : [
    {
      key: 'worked-today',
      title: 'Ore Lavorate',
      helper: null,
      value: userKPIs.workedToday,
      icon: Clock,
      color: 'blue',
      subLabel: 'OGGI',
      onClick: () => handleKPIClick('worked-today')
    },
    {
      key: 'remaining-today',
      title: 'Da lavorare oggi',
      helper: null,
      value: userKPIs.remainingToday,
      icon: Activity,
      color: 'green',
      subLabel: 'OGGI',
      onClick: () => handleKPIClick('remaining-today')
    },
    {
      key: 'monthly-presence',
      title: 'Presenze Mese',
      helper: new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).replace(/^[a-z]/, (char) => char.toUpperCase()),
      value: userKPIs.monthlyPresences,
      icon: Target,
      color: 'yellow',
      subLabel: null,
      onClick: () => handleKPIClick('monthly-presence')
    }
  ];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const eventsToday = upcomingEvents.filter(event => {
    const start = new Date(event.date);
    const end = event.endDate ? new Date(event.endDate) : new Date(event.date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return start.getTime() <= todayStart.getTime() && todayStart.getTime() <= end.getTime();
  });

  if (loading) {
    return user?.role === 'admin' ? <DashboardAdminSkeleton /> : <DashboardEmployeeSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">
          {user?.role === 'admin' 
            ? 'Ciao! Ecco un riepilogo delle attività del sistema HR'
            : <>Ciao, <span className="text-white font-semibold">{user?.firstName}</span>! La tua dashboard personale con le tue attività</>
          }
        </p>
      </div>

      {/* Stats Cards - Solo per Utenti */}
      {user?.role !== 'admin' && (
        <div className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {statCards.map((stat) => {
            const IconComponent = stat.icon;
            const colorClasses = {
              blue: 'bg-blue-500',
              green: 'bg-green-500',
              yellow: 'bg-yellow-500',
              purple: 'bg-purple-500'
            };
            return (
              <div 
                key={stat.key} 
                onClick={stat.onClick}
                className="bg-zinc-900 rounded-lg p-4 sm:p-6 cursor-pointer active:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-400 text-xs sm:text-sm font-medium">{stat.title}</p>
                    {stat.helper && (
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">{stat.helper}</p>
                    )}
                    <p className="text-2xl sm:text-3xl font-bold text-white mt-2">{stat.value}</p>
                    {stat.subLabel && (
                      <span className="inline-flex items-center mt-2 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold rounded-full bg-white/20 text-white">
                        {stat.subLabel}
                      </span>
                    )}
                  </div>
                  <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${colorClasses[stat.color]}`}>
                    <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* GAYometro - Solo per Michele Catelani */}
      {user?.role !== 'admin' && user?.firstName === 'Michele' && user?.lastName === 'Catelani' && (
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 rounded-lg p-6 border-4 border-purple-400 animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <span className="text-3xl mr-2">🌈</span>
              GAYometro
            </h2>
            <div className="bg-red-600 px-4 py-2 rounded-full animate-bounce">
              <span className="text-white font-bold text-lg">ALERT!</span>
            </div>
          </div>
          
          <div className="bg-black/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm">Livello Gay</span>
              <span className="text-white font-bold text-lg">100%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-6 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 h-full flex items-center justify-center text-white font-bold text-xs animate-pulse"
                style={{ width: '100%' }}
              >
                MASSIMO
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/10 border-2 border-yellow-500/50 rounded-lg p-3">
            <p className="text-yellow-200 text-sm font-semibold text-center">
              ⚠️ Il GAYometro rileva valori costantemente al massimo! Giorno dopo giorno, sempre al 100%! 🌈
            </p>
          </div>
        </div>
      )}

      {/* Dashboard Dipendente - Sezioni Aggiuntive */}
      {user?.role !== 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Banca Ore e Ferie */}
          <div className="space-y-4">
            {/* Banca Ore */}
            {overtimeBalance !== null && (
              <div className={`rounded-lg p-6 border-2 transition-all ${
                overtimeBalance.balance < 0 
                  ? 'bg-red-900/50 border-red-500/30' 
                  : overtimeBalance.balance > 0 
                  ? 'bg-green-900/50 border-green-500/30' 
                  : 'bg-zinc-900 border-zinc-800'
              }`}>
                <div 
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => setBancaOreCollapsed(!bancaOreCollapsed)}
                >
                  <h3 className={`text-lg font-bold flex items-center ${
                    overtimeBalance.balance < 0 
                      ? 'text-red-300' 
                      : overtimeBalance.balance > 0 
                      ? 'text-green-300' 
                      : 'text-white'
                  }`}>
                    <DollarSign className={`h-5 w-5 mr-2 ${
                      overtimeBalance.balance < 0 
                        ? 'text-red-400' 
                        : overtimeBalance.balance > 0 
                        ? 'text-green-400' 
                        : 'text-amber-400'
                    }`} />
                    Banca Ore
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/banca-ore');
                      }}
                      className="text-sm text-white/80 hover:text-white font-medium"
                    >
                      Dettagli →
                    </button>
                    {bancaOreCollapsed ? (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
                {!bancaOreCollapsed && (
                  <>
                    <div className={`text-3xl font-bold mb-2 ${
                      overtimeBalance.balance < 0 ? 'text-red-400' : 
                      overtimeBalance.balance > 0 ? 'text-green-400' : 'text-white'
                    }`}>
                      {overtimeBalance.balance < 0 ? '-' : '+'}{formatHours(Math.abs(overtimeBalance.balance || 0))}
                    </div>
                    <p className="text-sm text-slate-400">
                      {overtimeBalance.balance < 0 ? 'Debito da recuperare' : 
                       overtimeBalance.balance > 0 ? 'Credito disponibile' : 'In pari'}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Saldo Ferie */}
            {vacationBalance && (
              <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
                <div 
                  className="flex items-center justify-between mb-4 cursor-pointer"
                  onClick={() => setFerieCollapsed(!ferieCollapsed)}
                >
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <Plane className="h-5 w-5 mr-2 text-slate-400" />
                    Ferie
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/ferie');
                      }}
                      className="text-sm text-white/80 hover:text-white font-medium"
                    >
                      Dettagli →
                    </button>
                    {ferieCollapsed ? (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
                {!ferieCollapsed && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Giorni Rimanenti</p>
                        <p className="text-2xl font-bold text-green-400">
                          {vacationBalance.remaining_days || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Giorni Utilizzati</p>
                        <p className="text-2xl font-bold text-slate-300">
                          {vacationBalance.used_days || 0}
                        </p>
                      </div>
                    </div>
                    {vacationBalance.pending_days > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-400">In attesa: <span className="text-yellow-400 font-semibold">{vacationBalance.pending_days} giorni</span></p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Eventi Imminenti */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <div 
              className="flex items-center justify-between cursor-pointer mb-4"
              onClick={() => setEventsCollapsed(!eventsCollapsed)}
            >
              <h3 className="text-lg font-bold text-white flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-orange-400" />
                Eventi Imminenti
              </h3>
              {eventsCollapsed ? (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              )}
            </div>
            {!eventsCollapsed && (
              <>
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const futureEvents = upcomingEvents.filter(event => {
                    const eventDate = new Date(event.date);
                    eventDate.setHours(0, 0, 0, 0);
                    return eventDate >= today;
                  });
                  
                  return futureEvents.length > 0 ? (
                    <div className="space-y-3">
                      {futureEvents.slice(0, 5).map((event, index) => {
                        const eventDate = new Date(event.date);
                        eventDate.setHours(0, 0, 0, 0);
                        const daysDiff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
                        const colorClasses = {
                          green: 'bg-green-500/8 border-green-500/20',
                          red: 'bg-red-500/8 border-red-500/20',
                          blue: 'bg-zinc-900/50 border-zinc-800',
                          purple: 'bg-purple-500/8 border-purple-500/20'
                        };
                        
                        return (
                          <div key={index} className={`p-3 rounded-lg border ${colorClasses[event.color]}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-white font-semibold text-sm">{event.name}</p>
                                <p className="text-slate-400 text-xs mt-1">
                                  {eventDate.toLocaleDateString('it-IT', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                {daysDiff === 0 ? (
                                  <span className="text-xs font-semibold text-orange-400">Oggi</span>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    Fra {daysDiff} {daysDiff === 1 ? 'giorno' : 'giorni'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nessun evento imminente</p>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Calendario Festivi - Dipendente */}
      {user?.role !== 'admin' && (
        <HolidaysCalendar />
      )}

      {/* Admin Dashboard - Layout a 2 colonne */}
      {user?.role === 'admin' && (
        <>
          {/* Sezione In Malattia Oggi - Solo se ci sono dipendenti malati */}
          {sickToday.length > 0 && (
            <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6 mb-6">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => setSickTodayCollapsed(!sickTodayCollapsed)}
              >
                <h3 className="text-xl font-bold text-white flex items-center">
                  <AlertCircle className="h-6 w-6 mr-3 text-red-400" />
                  In malattia oggi
                </h3>
                {sickTodayCollapsed ? (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                )}
              </div>
              {!sickTodayCollapsed && (
                <div className="space-y-3">
                {sickToday.map((person) => (
                  <div key={person.user_id} className="bg-red-800/10 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center mr-3">
                          <span className="text-white font-semibold text-sm">
                            {person.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{person.name}</h4>
                          <p className="text-red-200 text-sm">{person.department}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-400 font-semibold">Malattia</div>
                        <div className="text-red-300 text-sm">
                          {person.reason || 'Nessun motivo'}
                        </div>
                        <div className="text-red-200 text-xs mt-1">
                          Dal {new Date(person.start_date).toLocaleDateString('it-IT')} 
                          {' '}al {new Date(person.end_date).toLocaleDateString('it-IT')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
          )}

          {/* Alert Recuperi Imminenti (Admin) - solo se ci sono recuperi approvati nei prossimi 7 giorni */}
          {upcomingRecoveries.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 sm:p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="flex items-center cursor-pointer flex-1"
                  onClick={() => setRecoveriesCollapsed(!recoveriesCollapsed)}
                >
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center">
                    <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-amber-400" />
                    Recuperi Imminenti
                  </h3>
                  {recoveriesCollapsed ? (
                    <ChevronDown className="h-5 w-5 text-slate-400 ml-2" />
                  ) : (
                    <ChevronUp className="h-5 w-5 text-slate-400 ml-2" />
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = '/recuperi-ore';
                  }}
                  className="text-amber-400 hover:text-amber-300 text-sm font-medium underline min-h-[44px] px-2"
                >
                  Vai alla gestione
                </button>
              </div>
              {!recoveriesCollapsed && (
                <div className="space-y-2">
                {upcomingRecoveries.slice(0, 3).map((recovery) => (
                  <div key={recovery.id} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold text-sm sm:text-base truncate">
                          {recovery.users?.first_name} {recovery.users?.last_name}
                        </div>
                        <div className="text-amber-300 text-xs sm:text-sm">
                          📅 {new Date(recovery.recovery_date).toLocaleDateString('it-IT')} • ⏰ {(() => {
                            const formatTimeWithoutSeconds = (timeString) => {
                              if (!timeString) return '';
                              if (timeString.match(/^\d{2}:\d{2}$/)) return timeString;
                              if (timeString.match(/^\d{2}:\d{2}:\d{2}$/)) return timeString.substring(0, 5);
                              try {
                                const [hours, minutes] = timeString.split(':');
                                return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
                              } catch {
                                return timeString;
                              }
                            };
                            return `${formatTimeWithoutSeconds(recovery.start_time)} - ${formatTimeWithoutSeconds(recovery.end_time)}`;
                          })()} ({formatHours(recovery.hours)})
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {upcomingRecoveries.length > 3 && (
                  <p className="text-amber-300 text-sm text-center pt-2">
                    +{upcomingRecoveries.length - 3} altri recuperi programmati
                  </p>
                )}
                </div>
              )}
            </div>
          )}

          {/* Presenti adesso - Full width con 2 colonne interne */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <div 
              className="flex items-center justify-between mb-6 cursor-pointer"
              onClick={() => setPresentNowCollapsed(!presentNowCollapsed)}
            >
              <h3 className="text-xl font-bold text-white flex items-center">
                <Clock className="h-6 w-6 mr-3 text-green-400" />
                Presenti adesso
                <div className="ml-3 flex items-center text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  Live
                </div>
              </h3>
              {presentNowCollapsed ? (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              )}
            </div>
          
          {!presentNowCollapsed && (() => {
            // Includi tutti i dipendenti con status rilevanti (lavoro, pausa, ferie, malattia, permessi 104)
            // Escludi solo quelli con status 'non_working_day' o 'absent' senza giustificazione
            console.log('🔍 [Dashboard] adminRealTimeData:', adminRealTimeData);
            console.log('🔍 [Dashboard] adminRealTimeData length:', adminRealTimeData.length);
            
            const presentNow = adminRealTimeData.filter(person => {
              // Includi dipendenti con status standard
              const hasStandardStatus = person.status === 'working' || 
                person.status === 'on_break' || 
                person.status === 'vacation' ||
                person.status === 'sick_leave' ||
                person.status === 'permission_104' ||
                person.status === 'completed';
              
              // Includi dipendenti con status di recupero specifici
              const hasRecoveryStatus = person.status === 'recovery_completed' || 
                person.status === 'recovery_active' || 
                person.status === 'recovery_scheduled';
              
              // IMPORTANTE: Includi anche dipendenti con recuperi approvati per oggi
              // anche se non hanno uno status standard (es. recupero terminato)
              const hasRecovery = person.hasRecoveryToday && 
                (person.recoveryStatus === 'active' || person.recoveryStatus === 'completed' || person.recoveryStatus === 'scheduled');
              
              // IMPORTANTE: Escludi esplicitamente i permessi (giornata intera o orari)
              const shouldExclude = person.status === 'permission';
              
              if (person.status === 'vacation') {
                console.log('🏖️ [Dashboard] Trovato dipendente in ferie:', person.name, person.status);
              }
              if (person.status === 'permission') {
                console.log('🚫 [Dashboard] Escluso dipendente con permesso:', person.name, person.status);
              }
              if (hasRecovery || hasRecoveryStatus) {
                console.log('🔄 [Dashboard] Trovato dipendente con recupero:', person.name, 'status:', person.status, 'recoveryStatus:', person.recoveryStatus);
              }
              
              return (hasStandardStatus || hasRecovery || hasRecoveryStatus) && !shouldExclude;
            });
            
            console.log('🔍 [Dashboard] presentNow filtered:', presentNow.length, 'dipendenti');
            console.log('🔍 [Dashboard] presentNow status breakdown:', {
              working: presentNow.filter(p => p.status === 'working').length,
              on_break: presentNow.filter(p => p.status === 'on_break').length,
              vacation: presentNow.filter(p => p.status === 'vacation').length,
              sick_leave: presentNow.filter(p => p.status === 'sick_leave').length,
              permission_104: presentNow.filter(p => p.status === 'permission_104').length,
              completed: presentNow.filter(p => p.status === 'completed').length
            });
            
            return presentNow.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {presentNow.map((person) => {
                const isWorking = person.status === 'working';
                const isOnBreak = person.status === 'on_break';
                const isCompleted = person.status === 'completed';
                const isNotStarted = person.status === 'not_started';
                
                // Determina colore badge e icona
                let badgeColor = 'bg-slate-500';
                let statusText = 'Sconosciuto';
                let statusColor = 'text-slate-400';
                
                // Gestisci status di recupero specifici
                if (person.status === 'recovery_completed') {
                  // Quando il recupero è terminato, mostra "Recupero terminato" con badge grigio
                  badgeColor = 'bg-zinc-700';
                  statusText = 'Recupero terminato';
                  statusColor = 'text-slate-300';
                } else if (person.status === 'recovery_active') {
                  badgeColor = 'bg-orange-500';
                  statusText = 'Recupero in corso';
                  statusColor = 'text-orange-300';
                } else if (person.status === 'recovery_scheduled') {
                  badgeColor = 'bg-orange-400';
                  statusText = 'Recupero programmato';
                  statusColor = 'text-orange-200';
                } else if (person.hasRecoveryToday && person.recoveryStatus) {
                  // Priorità: se ha un recupero, mostra lo status del recupero
                  if (person.recoveryStatus === 'active') {
                    // Se sta facendo il recupero e ha uno status working, mostra "A lavoro" con pill recupero
                    if (isWorking) {
                      badgeColor = 'bg-green-500';
                      statusText = 'A lavoro';
                      statusColor = 'text-green-400';
                    } else if (isOnBreak) {
                      badgeColor = 'bg-yellow-500';
                      statusText = 'In pausa';
                      statusColor = 'text-yellow-400';
                    } else {
                      badgeColor = 'bg-orange-500';
                      statusText = 'Recupero in corso';
                      statusColor = 'text-orange-300';
                    }
                  } else if (person.recoveryStatus === 'completed') {
                    // Quando il recupero è terminato, mostra "Recupero terminato" con badge grigio
                    badgeColor = 'bg-zinc-700';
                    statusText = 'Recupero terminato';
                    statusColor = 'text-slate-300';
                  } else if (person.recoveryStatus === 'scheduled') {
                    badgeColor = 'bg-orange-400';
                    statusText = 'Recupero programmato';
                    statusColor = 'text-orange-200';
                  }
                } else if (isWorking) {
                  badgeColor = 'bg-green-500';
                  statusText = 'A lavoro';
                  statusColor = 'text-green-400';
                } else if (isOnBreak) {
                  badgeColor = 'bg-yellow-500';
                  statusText = 'In pausa';
                  statusColor = 'text-yellow-400';
                } else if (isCompleted) {
                  badgeColor = 'bg-zinc-700';
                  statusText = 'Giornata terminata';
                  statusColor = 'text-slate-300';
                } else if (isNotStarted) {
                  badgeColor = 'bg-slate-500';
                  statusText = 'Non iniziato';
                  statusColor = 'text-slate-400';
                } else if (person.status === 'sick_leave') {
                  badgeColor = 'bg-red-500';
                  statusText = 'In malattia';
                  statusColor = 'text-red-400';
                } else if (person.status === 'permission_104') {
                  badgeColor = 'bg-purple-600';
                  statusText = 'Permesso 104';
                  statusColor = 'text-slate-300';
                } else if (person.status === 'vacation') {
                  badgeColor = 'bg-purple-500';
                  statusText = 'In Ferie';
                  statusColor = 'text-purple-400';
                } else if (person.status === 'non_working_day') {
                  badgeColor = 'bg-gray-600';
                  statusText = 'Non lavorativo';
                  statusColor = 'text-gray-400';
                }
                
                return (
                  <div key={person.user_id} className="bg-zinc-800 rounded-lg p-3 sm:p-4 hover:bg-zinc-700 transition-colors border border-zinc-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${badgeColor}`}>
                          <span className="text-white font-semibold text-sm">
                            {person.name ? person.name.split(' ').map(n => n[0]).join('') : 'N/A'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                            {person.name || 'N/A'}
                          </h4>
                          <p className="text-slate-400 text-xs sm:text-sm truncate">
                            {person.department || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        {person.hasRecoveryToday && (person.recoveryStatus === 'completed' || person.status === 'recovery_completed') ? (
                          <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                            Recupero terminato
                          </span>
                        ) : (
                          <div className={`font-semibold text-base sm:text-lg ${statusColor}`}>
                            {statusText}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400">Nessun dipendente presente in questo momento</p>
            </div>
          );
          })()}
          </div>

          {/* Grid per Richieste Recenti e In programma oggi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 mt-3 sm:mt-4 md:mt-6">
          {/* Richieste Recenti */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <div 
              className="flex items-center justify-between mb-6 cursor-pointer"
              onClick={() => setRecentRequestsCollapsed(!recentRequestsCollapsed)}
            >
              <h3 className="text-xl font-bold text-white flex items-center">
                <FileText className="h-6 w-6 mr-3 text-purple-400" />
                Richieste Recenti
                <div className="ml-3 flex items-center text-sm text-slate-400">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mr-2 animate-pulse"></div>
                  In attesa
                </div>
              </h3>
              {recentRequestsCollapsed ? (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              )}
            </div>
          
          {!recentRequestsCollapsed && (
            <div className="space-y-3">
            {recentRequests.length > 0 ? (
              recentRequests.map((request) => {
                // Determina i colori in base al tipo: viola per permessi, rosso per malattia, blu per ferie
                const colors = request.type === 'permission' ? {
                  bg: 'bg-purple-500/10',
                  border: 'border-purple-500/20',
                  hover: 'hover:bg-purple-500/20',
                  circle: 'bg-purple-500',
                  text: 'text-purple-200',
                  textLight: 'text-purple-300',
                  textBold: 'text-purple-400'
                } : request.type === 'sick_leave' ? {
                  bg: 'bg-red-500/10',
                  border: 'border-red-500/20',
                  hover: 'hover:bg-red-500/20',
                  circle: 'bg-red-500',
                  text: 'text-red-200',
                  textLight: 'text-red-300',
                  textBold: 'text-red-400'
                } : {
                  bg: 'bg-zinc-900/50',
                  border: 'border-zinc-800',
                  hover: 'hover:bg-zinc-900/70',
                  circle: 'bg-zinc-800',
                  text: 'text-slate-300',
                  textLight: 'text-slate-300',
                  textBold: 'text-slate-300'
                };

                return (
                  <div key={request.id} className={`${colors.bg} border ${colors.border} rounded-lg p-4 ${colors.hover} transition-colors`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center min-w-0 flex-1">
                        <div className={`w-10 h-10 ${colors.circle} rounded-full flex items-center justify-center mr-3 flex-shrink-0`}>
                          <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{request.user?.name || request.submittedBy || 'Dipendente'}</h4>
                          <p className={`${colors.text} text-sm`}>
                            {request.type === 'permission' ? 'Permesso' : 
                             request.type === 'vacation' ? 'Ferie' : 
                             request.type === 'sick_leave' ? 'Malattia' : 'Richiesta'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`${colors.textBold} font-semibold`}>
                          {request.start_date ? (
                            request.end_date && request.end_date !== request.start_date ? (
                              // Range di date: mostra da X a Y
                              <>
                                {new Date(request.start_date).toLocaleDateString('it-IT')}
                                {' - '}
                                {new Date(request.end_date).toLocaleDateString('it-IT')}
                              </>
                            ) : (
                              // Singola data: mostra solo la data
                              new Date(request.start_date).toLocaleDateString('it-IT')
                            )
                          ) : (
                            // Fallback: mostra data richiesta se start_date non disponibile
                            request.submittedAt ? new Date(request.submittedAt).toLocaleDateString('it-IT') : 'N/A'
                          )}
                        </div>
                        <div className={`${colors.textLight} text-sm`}>
                          {request.reason || request.notes || 'Nessun motivo'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">Nessuna richiesta recente</p>
              </div>
            )}
            </div>
          )}
          </div>

          {/* In programma oggi */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <div 
          className="flex items-center justify-between mb-4 cursor-pointer"
          onClick={() => setTodayEventsCollapsed(!todayEventsCollapsed)}
        >
          <h3 className="text-xl font-bold text-white flex items-center">
            <Calendar className="h-6 w-6 mr-3 text-orange-400" />
            In programma oggi
          </h3>
          {todayEventsCollapsed ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          )}
        </div>
        {!todayEventsCollapsed && (
          <>
            {eventsToday.length > 0 ? (
          <div className="space-y-3">
            {eventsToday.map((event, index) => {
              const eventDate = new Date(event.date);
              
              // Salta eventi con date invalide (extra sicurezza)
              if (isNaN(eventDate.getTime())) {
                return null;
              }
              
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const start = new Date(event.date);
              const end = event.endDate ? new Date(event.endDate) : new Date(event.date);
              start.setHours(0, 0, 0, 0);
              end.setHours(0, 0, 0, 0);
              
              const colorClasses = {
                green: 'bg-green-900/20 border-green-500/30',
                red: 'bg-red-900/20 border-red-500/30',
                blue: 'bg-zinc-900/50 border-zinc-800',
                purple: 'bg-purple-900/20 border-purple-500/30',
                orange: 'bg-orange-900/20 border-orange-500/30'
              };
              
              const iconColors = {
                green: 'text-green-400',
                red: 'text-red-400',
                blue: 'text-slate-400',
                purple: 'text-purple-400',
                orange: 'text-orange-400'
              };
              
              const IconComponent = event.type === 'permission_104' ? AlertCircle : 
                                   event.type === 'vacation' ? Calendar : 
                                   event.type === 'sick' ? XCircle : Clock;
              
              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${colorClasses[event.color]}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <IconComponent className={`h-5 w-5 mr-3 ${iconColors[event.color]}`} />
                      <div>
                        <h4 className="text-white font-semibold">{event.name} {event.user && `- ${event.user}`}</h4>
                        <p className="text-slate-300 text-sm">
                          {eventDate.toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                          {event.endDate && event.endDate !== event.date && (
                            <> - {new Date(event.endDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</>
                          )}
                        </p>
                        {event.type === 'permission' && (event.exitTime || event.entryTime) && (
                          <p className="text-orange-300 text-sm mt-1">
                            {event.exitTime && `Esce alle ${event.exitTime.slice(0, 5)}`}
                            {event.exitTime && event.entryTime && ' · '}
                            {event.entryTime && `Entra alle ${event.entryTime.slice(0, 5)}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white">Oggi</div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nessun evento programmato per oggi</p>
            </div>
          )}
          </>
        )}
      </div>
          </div>
          {/* Fine grid per Richieste Recenti e In programma oggi */}

      {/* Giorni Festivi */}
      <HolidaysCalendar />
        </>
      )}

    </div>
  );
};

export default Dashboard;