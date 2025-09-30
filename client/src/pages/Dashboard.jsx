import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import {
  Users,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  Calendar,
  MapPin
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import HolidaysCalendar from '../components/HolidaysCalendar';

const Dashboard = () => {
  const { user, apiCall } = useAuthStore();
  const [stats, setStats] = useState({
    presentToday: 0,
    pendingRequests: 0
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

  // Stato per timbratura
  const [userStats, setUserStats] = useState({
    isClockedIn: false,
    todayHours: '0h 0m',
    monthlyPresences: 0,
    expectedMonthlyPresences: 20,
    workplace: 'LABA Firenze - Sede Via Vecchietti'
  });

  useEffect(() => {
    fetchDashboardData();
    
    // Aggiornamento live ogni 30 secondi per admin
    if (user?.role === 'admin') {
      const interval = setInterval(() => {
        fetchCurrentAttendance();
        fetchRecentRequests();
      }, 30000); // 30 secondi
      
      return () => clearInterval(interval);
    } else {
      // Per utenti: carica KPI iniziali e aggiorna ogni minuto
      fetchUserKPIs();
      fetchUserStats(); // Carica stato timbratura
      const interval = setInterval(() => {
        fetchUserKPIs();
        fetchUserStats(); // Aggiorna stato timbratura
      }, 60000); // 1 minuto
      
      return () => clearInterval(interval);
    }
  }, [user?.role]);

  const fetchDashboardData = async () => {
    try {
      if (user?.role === 'admin') {
        // Fetch pending requests directly
        const requestsResponse = await apiCall('/api/leave-requests');
        let pendingRequests = 0;
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          pendingRequests = requestsData.filter(req => req.status === 'pending').length;
        }

        // Fetch present today from attendance
        const attendanceResponse = await apiCall('/api/attendance/current');
        let presentToday = 0;
        if (attendanceResponse.ok) {
          const attendanceData = await attendanceResponse.json();
          presentToday = attendanceData.length;
        }

        setStats({
          presentToday: presentToday,
          pendingRequests: pendingRequests
        });

        // Fetch weekly attendance data
        const weeklyResponse = await apiCall('/api/dashboard/attendance');
        if (weeklyResponse.ok) {
          const weeklyData = await weeklyResponse.json();
          if (weeklyData && weeklyData.length > 0) {
            setWeeklyAttendance(weeklyData);
          } else {
            // No real data available - show empty array
            setWeeklyAttendance([]);
          }
        } else {
          // Fallback: create empty weekly data
          setWeeklyAttendance([]);
        }
      } else {
        // Fetch KPI utente
        await fetchUserKPIs();
      }

        // Fetch current attendance for admin
        await fetchCurrentAttendance();
        
        // Fetch recent requests for admin
        await fetchRecentRequests();
        
        // Fetch departments from new API
        const departmentsResponse = await apiCall('/api/departments');
        if (departmentsResponse.ok) {
          const departmentsData = await departmentsResponse.json();
          if (departmentsData && departmentsData.length > 0) {
            // Convert API data to chart format with real employee counts
            const chartData = departmentsData.map((dept, index) => ({
              name: dept.name,
              value: dept.employee_count || 0, // Use real employee count
              color: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][index % 4],
              employees: dept.employee_count || 0
            }));
            setDepartments(chartData);
          } else {
            // No departments data - show empty
            setDepartments([]);
          }
        }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // No fallback data - show empty state
      setStats({ presentToday: 0, pendingRequests: 0 });
      setWeeklyAttendance([]);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentAttendance = async () => {
    try {
      if (user?.role === 'admin') {
        const response = await apiCall('/api/attendance/current');
        if (response.ok) {
          const data = await response.json();
          setCurrentAttendance(data);
        }
      }
    } catch (error) {
      console.error('Error fetching current attendance:', error);
    }
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

  const handleClockIn = async () => {
    try {
      const response = await apiCall('/api/attendance/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchDashboardData(); // Aggiorna i dati della dashboard
        fetchCurrentAttendance(); // Aggiorna immediatamente le presenze
        fetchUserStats(); // Aggiorna stato timbratura
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Clock in error:', error);
      alert('Errore durante la timbratura di entrata');
    }
  };

  const handleClockOut = async () => {
    try {
      const response = await apiCall('/api/attendance/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchDashboardData(); // Aggiorna i dati della dashboard
        fetchCurrentAttendance(); // Aggiorna immediatamente le presenze
        fetchUserStats(); // Aggiorna stato timbratura
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Clock out error:', error);
      alert('Errore durante la timbratura di uscita');
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await apiCall('/api/attendance/user-stats');
      if (response.ok) {
        const data = await response.json();
        setUserStats(data);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchUserKPIs = async () => {
    try {
      // 1. Ore lavorate questa settimana
      const weeklyHoursResponse = await apiCall('/api/attendance/user-weekly-hours');
      const weeklyHours = weeklyHoursResponse.success ? weeklyHoursResponse.data.totalHours : 0;
      
      // 2. Saldo ore (straordinari)
      const overtimeResponse = await apiCall('/api/attendance/user-overtime');
      const overtimeHours = overtimeResponse.success ? overtimeResponse.data.overtimeHours : 0;
      
      // 3. Permessi rimanenti
      const permissionsResponse = await apiCall('/api/leave-balances');
      const remainingPermissions = permissionsResponse.success ? permissionsResponse.data.permission?.remaining || 0 : 0;
      
      // 4. Presenze mese
      const monthlyPresencesResponse = await apiCall('/api/attendance/user-stats');
      const monthlyPresences = monthlyPresencesResponse.success ? monthlyPresencesResponse.data.monthlyPresences || 0 : 0;
      
      setUserKPIs({
        weeklyHours: formatHours(weeklyHours),
        overtimeBalance: formatOvertime(overtimeHours),
        remainingPermissions: `${remainingPermissions}h`,
        monthlyPresences: `${monthlyPresences}/20`
      });
    } catch (error) {
      console.error('Error fetching user KPIs:', error);
    }
  };

  const formatHours = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatOvertime = (hours) => {
    const sign = hours >= 0 ? '+' : '';
    return `${sign}${formatHours(Math.abs(hours))}`;
  };

  // Usa i dati reali dal database
  const weeklyAttendanceData = weeklyAttendance;
  const departmentData = departments;

  // Statistiche diverse per admin e utenti
  const statCards = user?.role === 'admin' ? [
    // Admin: statistiche aziendali
    {
      title: 'Presenti Oggi',
      value: stats.presentToday || 0,
      icon: CheckCircle,
      color: 'green',
      change: '+5%',
      changeType: 'positive',
      subtitle: 'In ufficio oggi'
    },
    {
      title: 'Richieste in Sospeso',
      value: stats.pendingRequests || 0,
      icon: FileText,
      color: 'yellow',
      change: '-3',
      changeType: 'negative',
      subtitle: 'Da approvare'
    }
  ] : [
    // Utente: KPI personali REALI
    {
      title: 'Ore Lavorate',
      value: userKPIs.weeklyHours,
      icon: Clock,
      color: 'blue',
      change: '+0h 0m',
      changeType: 'positive',
      subtitle: 'Questa settimana'
    },
    {
      title: 'Saldo Ore',
      value: userKPIs.overtimeBalance,
      icon: Activity,
      color: 'green',
      change: '+0h 0m',
      changeType: 'positive',
      subtitle: 'Straordinari'
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

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 gap-6 ${user?.role === 'admin' ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
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

      {/* Presenti Attualmente - Full Width */}
      {user?.role === 'admin' && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <CheckCircle className="h-6 w-6 mr-3 text-green-400" />
            Presenti Attualmente
            <div className="ml-auto flex items-center text-sm text-slate-400">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              Live
            </div>
          </h3>
          
          {currentAttendance.length > 0 ? (
            <div className="space-y-3">
              {currentAttendance.map((person) => {
                const isPresent = person.clock_in && !person.clock_out;
                const clockInTime = person.clock_in ? new Date(person.clock_in) : null;
                const now = new Date();
                const hoursWorked = isPresent && clockInTime ? 
                  ((now - clockInTime) / (1000 * 60 * 60)).toFixed(1) : 
                  person.hours_worked || 0;
                
                return (
                  <div key={person.user_id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          isPresent ? 'bg-green-500' : 'bg-slate-500'
                        }`}>
                          <span className="text-white font-semibold text-sm">
                            {person.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{person.name}</h4>
                          <p className="text-slate-400 text-sm">{person.department}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {isPresent ? (
                          <>
                            <div className="text-green-400 font-semibold">
                              Entrato: {clockInTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-slate-400 text-sm">
                              Ore lavorate: {hoursWorked}h
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-slate-400 font-semibold">
                              Non presente
                            </div>
                            <div className="text-slate-500 text-sm">
                              Non ha fatto entrata
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
              <p className="text-slate-400">Nessuno presente in ufficio al momento</p>
            </div>
          )}
        </div>
      )}

      {/* Richieste Recenti - Solo per Admin */}
      {user?.role === 'admin' && (
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
      )}

      {/* Timbratura - Solo per Utenti */}
      {user?.role !== 'admin' && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <Clock className="h-6 w-6 mr-3 text-green-400" />
            Timbratura
          </h3>
          
          {/* Selezione Sede di Lavoro */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Sede di Lavoro
            </label>
            <select 
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="badia">Piazza di Badia a Ripoli 1/A</option>
              <option value="vecchietti">Via de' Vecchietti 6</option>
            </select>
          </div>

          {/* Pulsanti Timbratura */}
          <div className="flex gap-4">
            <button 
              onClick={handleClockIn}
              disabled={userStats.isClockedIn}
              className={`flex-1 font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center ${
                userStats.isClockedIn 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              {userStats.isClockedIn ? 'Già Entrato' : 'Timbra Entrata'}
            </button>
            <button 
              onClick={handleClockOut}
              disabled={!userStats.isClockedIn}
              className={`flex-1 font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center ${
                !userStats.isClockedIn 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <XCircle className="h-5 w-5 mr-2" />
              {!userStats.isClockedIn ? 'Non Entrato' : 'Timbra Uscita'}
            </button>
          </div>
        </div>
      )}

      {/* Giorni Festivi */}
      <HolidaysCalendar year={new Date().getFullYear()} />
    </div>
  );
};

export default Dashboard;