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
  XCircle
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
        if (user?.role === 'admin') {
          // Admin: fetch real-time data
          await fetchEmployees();
          await fetchAdminWorkSchedules();
          await calculateAdminRealTimeData();
        } else {
          // Employee: fetch personal data
          await fetchAttendanceData();
          await fetchWorkSchedules();
        }
        
        // Fetch recent requests for admin
        await fetchRecentRequests();
        
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
            fetchAttendanceData();
            fetchWorkSchedules();
            // Non calcolare KPI localmente, usa solo l'endpoint
          } else if (user?.role === 'admin') {
            console.log('🔄 Refreshing admin data...');
            fetchEmployees();
            fetchAdminWorkSchedules();
            calculateAdminRealTimeData();
          }
        }, 30000); // Ogni 30 secondi
        
        return () => clearInterval(refreshTimer);
        
        // Fetch weekly attendance data
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
        setCurrentAttendance(data);
        console.log('📊 Current attendance loaded:', data.length, 'employees currently working');
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
    
    if (!currentAttendance || !workSchedules || currentAttendance.length === 0 || workSchedules.length === 0) {
      console.log('⚠️ No data available for admin real-time calculation');
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
    const realTimeData = currentAttendance.map(employee => {
      // Trova l'orario di lavoro per questo dipendente
      const workSchedule = workSchedules.find(schedule => 
        schedule.user_id === employee.id && 
        schedule.day_of_week === dayOfWeek && 
        schedule.is_working_day
      );
      
      if (!workSchedule) {
        return {
          ...employee,
          is_working_day: false,
          expected_hours: 0,
          actual_hours: 0,
          balance_hours: 0,
          status: 'non_working_day'
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
      
      const balanceHours = actualHours - expectedHours;
      
      return {
        ...employee,
        is_working_day: true,
        expected_hours: Math.round(expectedHours * 10) / 10,
        actual_hours: Math.round(actualHours * 10) / 10,
        balance_hours: Math.round(balanceHours * 10) / 10,
        status: status,
        is_absent: status === 'not_started' && actualHours === 0
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

  const updateKPIsWithBalance = (balanceData) => {
    if (user?.role === 'employee') {
      // Calculate today's hours only (not weekly)
      const today = new Date();
      const todaySchedule = workSchedules.find(schedule => 
        schedule.day_of_week === today.getDay() && schedule.is_working_day
      );
      
      let todayHours = 0;
      if (todaySchedule) {
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const { start_time, end_time, break_duration } = todaySchedule;
        const [startHour, startMin] = start_time.split(':').map(Number);
        const [endHour, endMin] = end_time.split(':').map(Number);
        const breakDuration = break_duration || 60;
        
        // Calculate today's real-time hours (same logic as Presenze page)
        if (currentHour < startHour || (currentHour === startHour && currentMinute < startMin)) {
          todayHours = 0;
        } else if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMin)) {
          const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          const workMinutes = totalMinutes - breakDuration;
          todayHours = workMinutes / 60;
        } else {
          // During work time - calculate with lunch break logic
          const minutesFromStart = (currentHour - startHour) * 60 + (currentMinute - startMin);
          const totalWorkMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          const hasLunchBreak = totalWorkMinutes > 300;
          
          let totalMinutesWorked = 0;
          
          if (hasLunchBreak) {
            // FULL DAY: has lunch break
            const morningEndMinutes = (totalWorkMinutes - breakDuration) / 2;
            const breakStartMinutes = morningEndMinutes;
            const breakEndMinutes = morningEndMinutes + breakDuration;
            
            if (minutesFromStart < breakStartMinutes) {
              totalMinutesWorked = minutesFromStart;
            } else if (minutesFromStart >= breakStartMinutes && minutesFromStart < breakEndMinutes) {
              totalMinutesWorked = breakStartMinutes;
            } else {
              const morningMinutes = breakStartMinutes;
              const afternoonMinutes = minutesFromStart - breakEndMinutes;
              totalMinutesWorked = morningMinutes + afternoonMinutes;
            }
          } else {
            // HALF DAY: no lunch break
            totalMinutesWorked = minutesFromStart;
          }
          
          todayHours = totalMinutesWorked / 60;
        }
      }
      
      // Calculate today's expected hours for balance calculation
      let todayExpectedHours = 0;
      console.log('🔍 Debug todaySchedule:', todaySchedule);
      if (todaySchedule) {
        const { start_time, end_time, break_duration } = todaySchedule;
        console.log('🔍 Schedule times:', { start_time, end_time, break_duration });
        const [startHour, startMin] = start_time.split(':').map(Number);
        const [endHour, endMin] = end_time.split(':').map(Number);
        const breakDuration = break_duration || 60;
        
        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const workMinutes = totalMinutes - breakDuration;
        todayExpectedHours = workMinutes / 60;
        console.log('🔍 Calculated expected hours:', todayExpectedHours);
      } else {
        console.log('⚠️ No todaySchedule found!');
      }
      
      // Calculate today's balance (actual vs expected)
      const todayBalance = todayHours - todayExpectedHours;
      
      // Update KPIs with today's hours and today's balance
      setUserKPIs(prevKPIs => ({
        ...prevKPIs,
        weeklyHours: formatHours(todayHours), // TODAY'S hours only
        overtimeBalance: formatOvertime(todayBalance), // TODAY'S balance (positive/negative/zero)
        remainingPermissions: `${Math.max(0, balanceData.monte_ore)}h`,
        monthlyPresences: `${balanceData.working_days}/20`
      }));
      
      console.log('✅ KPIs updated with today\'s hours:', { 
        todayHours, 
        todayExpectedHours, 
        todayBalance,
        monthlyBalance: balanceData.monte_ore 
      });
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
          Benvenuto, <span className="text-white font-semibold">{user?.firstName}</span>!
          {user?.role === 'admin' 
            ? ' Ecco un riepilogo delle attività del sistema HR'
            : ' La tua dashboard personale con le tue attività'
          }
        </p>
      </div>

      {/* Stats Cards - Solo per Utenti */}
      {user?.role !== 'admin' && (
        <div className="space-y-4">
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Presenti Attualmente */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Clock className="h-6 w-6 mr-3 text-orange-400" />
              Presenti Attualmente
              <div className="ml-auto flex items-center text-sm text-slate-400">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                Live
              </div>
            </h3>
          
          {adminRealTimeData.length > 0 ? (
            <div className="space-y-3">
              {adminRealTimeData.map((person) => {
                const isPresent = person.status === 'working' || person.status === 'on_break' || person.status === 'completed';
                const balanceColor = person.balance_hours > 0 ? 'text-green-400' : 
                                   person.balance_hours < 0 ? 'text-red-400' : 'text-gray-400';
                
                return (
                  <div key={person.user_id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          isPresent ? 'bg-green-500' : 'bg-slate-500'
                        }`}>
                          <span className="text-white font-semibold text-sm">
                            {person.first_name ? person.first_name[0] + person.last_name[0] : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">
                            {person.first_name ? `${person.first_name} ${person.last_name}` : 'N/A'}
                          </h4>
                          <p className="text-slate-400 text-sm">
                            {person.email || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {isPresent ? (
                          <>
                            <div className="text-green-400 font-semibold">
                              {person.status === 'working' ? 'Lavorando' : 
                               person.status === 'on_break' ? 'In pausa' : 'Completato'}
                            </div>
                            <div className="text-slate-400 text-sm">
                              Ore attese: {person.expected_hours}h
                            </div>
                            <div className="text-slate-400 text-sm">
                              Ore effettive: {person.actual_hours}h
                            </div>
                            <div className={`text-sm font-semibold ${balanceColor}`}>
                              Saldo: {person.balance_hours > 0 ? '+' : ''}{person.balance_hours}h
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-slate-400 font-semibold">
                              {person.status === 'not_started' ? 'Non iniziato' : 'Non lavorativo'}
                            </div>
                            <div className="text-slate-500 text-sm">
                              {person.is_working_day ? 'Giorno lavorativo' : 'Giorno non lavorativo'}
                            </div>
                          </>
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
              <p className="text-slate-400">Nessun record di presenza per oggi</p>
            </div>
          )}
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
              recentRequests.map((request) => (
                <div key={request.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 hover:bg-yellow-500/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">{request.user?.name || 'Dipendente'}</h4>
                        <p className="text-yellow-200 text-sm">
                          {request.type === 'permission' ? 'Permesso' : 
                           request.type === 'vacation' ? 'Ferie' : 
                           request.type === 'sick' ? 'Malattia' : 'Richiesta'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-400 font-semibold">
                        {new Date(request.submittedAt).toLocaleDateString('it-IT')}
                      </div>
                      <div className="text-yellow-300 text-sm">
                        {request.reason || 'Nessun motivo specificato'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">Nessuna richiesta recente</p>
                <p className="text-slate-500 text-sm mt-2">Le richieste dei dipendenti appariranno qui</p>
              </div>
            )}
          </div>
          </div>
        </div>
      )}


      {/* Giorni Festivi */}
      <HolidaysCalendar year={new Date().getFullYear()} />
    </div>
  );
};

export default Dashboard;