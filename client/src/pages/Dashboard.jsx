import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import {
  Users,
  Clock,
  FileText,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  Calendar,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import HolidaysCalendar from '../components/HolidaysCalendar';

const Dashboard = () => {
  const { user, apiCall } = useAuthStore();
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
    weeklyHours: '0h 0m',
    overtimeBalance: '+0h 0m',
    remainingPermissions: '0h',
    monthlyPresences: '0/20'
  });
  
  // Dati per calcoli real-time
  const [attendanceData, setAttendanceData] = useState([]);
  const [workSchedules, setWorkSchedules] = useState([]);
  
  // Dati per admin dashboard real-time
  const [adminRealTimeData, setAdminRealTimeData] = useState([]);


  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch dashboard stats
        await fetchDashboardData();
        
        // Fetch data based on role
        console.log('🔍 Dashboard loading for user role:', user?.role);
        if (user?.role === 'admin') {
          // Admin: fetch real-time data
          console.log('🔍 Loading admin data...');
          await fetchEmployees();
          await fetchAdminWorkSchedules();
          await calculateAdminRealTimeData();
          await fetchSickToday(); // Fetch employees on sick leave today
        } else {
          // Employee: fetch personal data
          console.log('🔍 Loading employee data...');
          await fetchAttendanceData();
          await fetchWorkSchedules();
        }
        
        // Fetch recent requests for admin
        if (user?.role === 'admin') {
          await fetchRecentRequests();
        }
        
        // Fetch upcoming events for all users
        await fetchUpcomingEvents();
        
        // Forza un secondo aggiornamento dopo 1 secondo per sicurezza
        setTimeout(() => {
          if (user?.role === 'employee') {
            console.log('🔄 Secondary KPI update...');
            // Non calcolare KPI localmente, usa solo l'endpoint
          } else if (user?.role === 'admin') {
            console.log('🔄 Secondary admin real-time update...');
            calculateAdminRealTimeData();
          }
        }, 1000);
        
        // Timer per ricaricare i dati ogni 30 secondi
        const refreshTimer = setInterval(() => {
          if (user?.role === 'employee') {
            console.log('🔄 Refreshing employee data...');
            fetchAttendanceData(); // Questo chiamerà updateKPIsWithBalance
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
        
        // Fetch weekly attendance data (solo per admin)
        if (user?.role === 'admin') {
          const weeklyResponse = await apiCall('/api/dashboard/attendance');
          if (weeklyResponse.ok) {
            const weeklyData = await weeklyResponse.json();
            setWeeklyAttendance(weeklyData || []);
          }
          
          // Fetch departments data
          const departmentsResponse = await apiCall('/api/departments');
          if (departmentsResponse.ok) {
            const departmentsData = await departmentsResponse.json();
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
          }
        }
        
        return () => {
          clearInterval(refreshTimer);
          clearInterval(kpiTimer);
        };
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
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

  // Ricalcola i dati admin quando cambiano workSchedules o currentAttendance
  useEffect(() => {
    if (user?.role === 'admin' && workSchedules.length > 0 && currentAttendance.length > 0) {
      calculateAdminRealTimeData();
    }
  }, [workSchedules, currentAttendance, user?.role]);

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
      const response = await apiCall('/api/attendance/current');
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Fetched current attendance data:', data);
        setCurrentAttendance(data);
        console.log('📊 Current attendance loaded:', data.length, 'employees currently working');
      } else {
        console.error('❌ Failed to fetch current attendance:', response.status);
      }
    } catch (error) {
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
    
    if (!currentAttendance || currentAttendance.length === 0) {
      console.log('⚠️ No data available for admin real-time calculation');
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Ricalcola lo status real-time per ogni employee
    const realTimeData = currentAttendance.map(employee => {
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
        is_absent: finalStatus === 'not_started' && employee.actual_hours === 0
      };
    });
    
    console.log('📊 Admin real-time data calculated:', realTimeData.length, 'employees');
    setAdminRealTimeData(realTimeData);
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
      if (user?.role === 'admin') {
        const response = await apiCall('/api/attendance/sick-today');
        if (response.ok) {
          const data = await response.json();
          setSickToday(data);
          console.log('🤒 Employees sick today:', data.length);
        }
      }
    } catch (error) {
      console.error('Error fetching sick today:', error);
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
          events.push({
            date: req.start_date,
            endDate: req.end_date,
            type: req.type,
            name: req.type === 'vacation' ? 'Ferie' : req.type === 'sick' ? 'Malattia' : 'Permesso',
            user: user?.role === 'admin' ? req.user_name : undefined,
            color: req.type === 'vacation' ? 'green' : req.type === 'sick' ? 'red' : 'blue'
          });
        });
      }
      
      // Fetch 104 permissions approved (per admin mostrare tutti)
      const perm104Response = await apiCall(`/api/leave-requests?type=permission_104&status=approved&startDate=${today.toISOString().split('T')[0]}&endDate=${nextMonth.toISOString().split('T')[0]}`);
      if (perm104Response.ok) {
        const perm104Data = await perm104Response.json();
        // Filtra solo gli approvati che non sono ancora passati
        const approvedPerms = perm104Data.filter(perm => 
          perm.status === 'approved' && 
          new Date(perm.startDate) >= today
        );
        approvedPerms.forEach(perm => {
          events.push({
            date: perm.startDate,
            endDate: perm.endDate,
            type: 'permission_104',
            name: 'Permesso 104',
            user: user?.role === 'admin' ? perm.user?.name : undefined,
            color: 'purple'
          });
        });
      }
      
      // Sort by date and take next 10 events
      events.sort((a, b) => new Date(a.date) - new Date(b.date));
      setUpcomingEvents(events.slice(0, 10));
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

  const formatOvertime = (hours) => {
    const sign = hours >= 0 ? '+' : '';
    return `${sign}${formatHours(Math.abs(hours))}`;
  };

  const updateKPIsWithBalance = async (balanceData) => {
    if (user?.role === 'employee') {
      // Usa SOLO l'endpoint /api/attendance/current-hours per coerenza con Presenze
      try {
        const response = await apiCall('/api/attendance/current-hours');
        if (response.ok) {
          const currentHoursData = await response.json();
          
          if (currentHoursData.isWorkingDay) {
            const todayHours = currentHoursData.actualHours || 0;
            const todayExpectedHours = currentHoursData.expectedHours || 0;
            const todayBalance = currentHoursData.balanceHours || 0;
            
            // Update KPIs with today's hours from the same endpoint
            // NOTA: overtimeBalance mostra il saldo MENSILE, non quello di oggi
            setUserKPIs(prevKPIs => ({
              ...prevKPIs,
              weeklyHours: formatHours(todayHours), // Ore lavorate OGGI
              overtimeBalance: formatOvertime(balanceData.monte_ore || 0), // Saldo MENSILE (monte ore)
              remainingPermissions: `${Math.max(0, balanceData.monte_ore)}h`,
              monthlyPresences: `${balanceData.working_days}/20`
            }));
            
            console.log('✅ KPIs updated with current-hours endpoint:', { 
              todayHours, 
              todayExpectedHours, 
              todayBalance,
              monthlyBalance: balanceData.monte_ore,
              workingDays: balanceData.working_days
            });
          } else {
            // Non è un giorno lavorativo
            setUserKPIs(prevKPIs => ({
              ...prevKPIs,
              weeklyHours: '0h 0m',
              overtimeBalance: '+0h 0m',
              remainingPermissions: `${Math.max(0, balanceData.monte_ore)}h`,
              monthlyPresences: `${balanceData.working_days}/20`
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

  // Statistiche diverse per admin e utenti
  const statCards = user?.role === 'admin' ? [] : [
    // Utente: KPI personali REALI
    {
      title: 'Ore Lavorate',
      value: userKPIs.weeklyHours,
      icon: Clock,
      color: 'blue',
      change: '+0h 0m',
      changeType: 'positive',
      subtitle: 'OGGI'
    },
    {
      title: 'Saldo Ore',
      value: userKPIs.overtimeBalance,
      icon: Activity,
      color: userKPIs.overtimeBalance.startsWith('+') ? 'green' : userKPIs.overtimeBalance.startsWith('-') ? 'red' : 'blue',
      change: '+0h 0m',
      changeType: 'positive',
      subtitle: 'Monte ore mensile'
    },
    {
      title: 'Permessi Rimanenti',
      value: userKPIs.remainingPermissions,
      icon: FileText,
      color: 'purple',
      change: '0h',
      changeType: 'neutral',
      subtitle: 'Ore disponibili'
    },
    {
      title: 'Presenze Mese',
      value: userKPIs.monthlyPresences,
      icon: Target,
      color: 'yellow',
      change: '0',
      changeType: 'positive',
      subtitle: 'Giorni lavorati'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
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
          
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, index) => {
            const IconComponent = stat.icon;
            const colorClasses = {
              blue: 'bg-blue-500',
              green: 'bg-green-500',
              yellow: 'bg-yellow-500',
              purple: 'bg-purple-500'
            };
            return (
              <div key={index} className="bg-slate-800 rounded-lg p-6 hover:bg-slate-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">{stat.title}</p>
                    <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                    <p className="text-slate-400 text-xs mt-1">{stat.subtitle}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${colorClasses[stat.color]}`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex items-center mt-4">
                  <div className={`flex items-center text-sm ${
                    stat.changeType === 'positive' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {stat.changeType === 'positive' ? (
                      <ArrowUpRight className="h-4 w-4 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 mr-1" />
                    )}
                    <span className="font-semibold">{stat.change}</span>
                  </div>
                  <span className="text-slate-500 text-xs ml-2">vs mese scorso</span>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Admin Dashboard - Layout a 2 colonne */}
      {user?.role === 'admin' && (
        <>
          {/* Sezione In Malattia Oggi - Solo se ci sono dipendenti malati */}
          {sickToday.length > 0 && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <AlertCircle className="h-6 w-6 mr-3 text-red-400" />
                In malattia oggi
              </h3>
              <div className="space-y-3">
                {sickToday.map((person) => (
                  <div key={person.user_id} className="bg-red-800/20 rounded-lg p-4">
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
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Presenti adesso */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Clock className="h-6 w-6 mr-3 text-green-400" />
              Presenti adesso
              <div className="ml-auto flex items-center text-sm text-slate-400">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                Live
              </div>
            </h3>
          
          {(() => {
            const presentNow = adminRealTimeData.filter(person => 
              person.status === 'working' || person.status === 'on_break'
            );
            
            return presentNow.length > 0 ? (
              <div className="space-y-3">
                {presentNow.map((person) => {
                const isWorking = person.status === 'working';
                const isOnBreak = person.status === 'on_break';
                const isCompleted = person.status === 'completed';
                const isNotStarted = person.status === 'not_started';
                
                // Determina colore badge e icona
                let badgeColor = 'bg-slate-500';
                let statusText = 'Sconosciuto';
                let statusColor = 'text-slate-400';
                
                if (isWorking) {
                  badgeColor = 'bg-green-500';
                  statusText = 'Lavorando';
                  statusColor = 'text-green-400';
                } else if (isOnBreak) {
                  badgeColor = 'bg-yellow-500';
                  statusText = 'In pausa';
                  statusColor = 'text-yellow-400';
                } else if (isCompleted) {
                  badgeColor = 'bg-blue-500';
                  statusText = 'Giornata terminata';
                  statusColor = 'text-blue-400';
                } else if (isNotStarted) {
                  badgeColor = 'bg-slate-500';
                  statusText = 'Non iniziato';
                  statusColor = 'text-slate-400';
                } else if (person.status === 'sick_leave') {
                  badgeColor = 'bg-red-500';
                  statusText = 'In malattia';
                  statusColor = 'text-red-400';
                } else if (person.status === 'permission_104') {
                  badgeColor = 'bg-blue-600';
                  statusText = 'Permesso 104';
                  statusColor = 'text-blue-300';
                } else if (person.status === 'non_working_day') {
                  badgeColor = 'bg-gray-600';
                  statusText = 'Non lavorativo';
                  statusColor = 'text-gray-400';
                }
                
                return (
                  <div key={person.user_id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${badgeColor}`}>
                          <span className="text-white font-semibold text-sm">
                            {person.name ? person.name.split(' ').map(n => n[0]).join('') : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">
                            {person.name || 'N/A'}
                          </h4>
                          <p className="text-slate-400 text-sm">
                            {person.department || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold text-lg ${statusColor}`}>
                          {statusText}
                        </div>
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

          {/* Richieste Recenti */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <FileText className="h-6 w-6 mr-3 text-yellow-400" />
              Richieste Recenti
              <div className="ml-auto flex items-center text-sm text-slate-400">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
                In attesa
              </div>
            </h3>
          
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
                  bg: 'bg-blue-500/10',
                  border: 'border-blue-500/20',
                  hover: 'hover:bg-blue-500/20',
                  circle: 'bg-blue-500',
                  text: 'text-blue-200',
                  textLight: 'text-blue-300',
                  textBold: 'text-blue-400'
                };

                return (
                  <div key={request.id} className={`${colors.bg} border ${colors.border} rounded-lg p-4 ${colors.hover} transition-colors`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 ${colors.circle} rounded-full flex items-center justify-center mr-3`}>
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
                          {new Date(request.submittedAt).toLocaleDateString('it-IT')}
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
          </div>
        </div>
        </>
      )}

      {/* Calendario Overview Eventi */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <Calendar className="h-6 w-6 mr-3 text-indigo-400" />
          Eventi Imminenti
        </h3>
        {upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {upcomingEvents.map((event, index) => {
              const eventDate = new Date(event.date);
              const daysUntil = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
              const isToday = daysUntil === 0;
              
              const colorClasses = {
                green: 'bg-green-900/20 border-green-500/30',
                red: 'bg-red-900/20 border-red-500/30',
                blue: 'bg-blue-900/20 border-blue-500/30',
                purple: 'bg-purple-900/20 border-purple-500/30'
              };
              
              const iconColors = {
                green: 'text-green-400',
                red: 'text-red-400',
                blue: 'text-blue-400',
                purple: 'text-purple-400'
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
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${
                        isToday ? 'text-white' : 'text-slate-400'
                      }`}>
                        {isToday ? 'Oggi' : `Tra ${daysUntil} ${daysUntil === 1 ? 'giorno' : 'giorni'}`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessun evento programmato</p>
          </div>
        )}
      </div>

      {/* Giorni Festivi */}
      <HolidaysCalendar year={new Date().getFullYear()} />
    </div>
  );
};

export default Dashboard;