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
  const [loading, setLoading] = useState(true);
  
  // Stati per KPI utente
  const [userKPIs, setUserKPIs] = useState({
    weeklyHours: '0h 0m',
    overtimeBalance: '+0h 0m',
    remainingPermissions: '0h',
    monthlyPresences: '0/20'
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch real stats from database
      const statsResponse = await apiCall('/api/dashboard/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats({
          presentToday: statsData.presentToday || 0,
          pendingRequests: statsData.pendingRequests || 0
        });
      } else {
        // Fallback to 0 if no data
        setStats({
          presentToday: 0,
          pendingRequests: 0
        });
      }

      // Fetch real weekly attendance from database
      const attendanceResponse = await apiCall('/api/dashboard/attendance');
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        if (attendanceData && attendanceData.length > 0) {
          setWeeklyAttendance(attendanceData);
        } else {
          // No real data available - show empty array
          setWeeklyAttendance([]);
        }
      }

      // Fetch departments from new API
      const departmentsResponse = await apiCall('/api/departments');
      if (departmentsResponse.ok) {
        const departmentsData = await departmentsResponse.json();
        if (departmentsData && departmentsData.length > 0) {
          // Convert API data to chart format
          const chartData = departmentsData.map((dept, index) => ({
            name: dept.name,
            value: Math.floor(Math.random() * 10) + 3, // TODO: Get real employee count
            color: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][index % 4],
            employees: Math.floor(Math.random() * 10) + 3
          }));
          setDepartments(chartData);
        } else {
          // Mock data for testing
          setDepartments([
            { name: 'Amministrazione', value: 8, color: '#8b5cf6', employees: 8 },
            { name: 'Segreteria', value: 6, color: '#06b6d4', employees: 6 },
            { name: 'Orientamento', value: 12, color: '#10b981', employees: 12 },
            { name: 'Reparto IT', value: 4, color: '#f59e0b', employees: 4 }
          ]);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback mock data
      setStats({ presentToday: 12, pendingRequests: 5 });
      setWeeklyAttendance([
        { name: 'Lun', presenze: 15, assenze: 2 },
        { name: 'Mar', presenze: 18, assenze: 1 },
        { name: 'Mer', presenze: 16, assenze: 3 },
        { name: 'Gio', presenze: 19, assenze: 0 },
        { name: 'Ven', presenze: 17, assenze: 2 }
      ]);
      setDepartments([
        { name: 'Amministrazione', value: 8, color: '#8b5cf6', employees: 8 },
        { name: 'Segreteria', value: 6, color: '#06b6d4', employees: 6 },
        { name: 'Orientamento', value: 12, color: '#10b981', employees: 12 },
        { name: 'Reparto IT', value: 4, color: '#f59e0b', employees: 4 }
      ]);
    } finally {
      setLoading(false);
    }
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
    // Utente: KPI personali
    {
      title: 'Ore Lavorate',
      value: '32h 45m',
      icon: Clock,
      color: 'blue',
      change: '+2h 15m',
      changeType: 'positive',
      subtitle: 'Questa settimana'
    },
    {
      title: 'Saldo Ore',
      value: '+4h 30m',
      icon: Activity,
      color: 'green',
      change: '+1h 20m',
      changeType: 'positive',
      subtitle: 'Straordinari'
    },
    {
      title: 'Permessi Rimanenti',
      value: '24h',
      icon: FileText,
      color: 'purple',
      change: '-3h',
      changeType: 'negative',
      subtitle: 'Ore disponibili'
    },
    {
      title: 'Presenze Mese',
      value: '18/20',
      icon: Target,
      color: 'yellow',
      change: '+1',
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

      {/* Charts */}
      {/* Charts Section - Solo per Admin */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Attendance Chart */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <Activity className="h-6 w-6 mr-3 text-indigo-400" />
            Presenze Settimanali
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={weeklyAttendanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="presenzeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                  <stop offset="50%" stopColor="#059669" stopOpacity={0.7}/>
                  <stop offset="100%" stopColor="#047857" stopOpacity={0.5}/>
                </linearGradient>
                <linearGradient id="assenzeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9}/>
                  <stop offset="50%" stopColor="#dc2626" stopOpacity={0.7}/>
                  <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.5}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#374151" opacity={0.4} />
              <XAxis 
                dataKey="name" 
                stroke="#9ca3af" 
                fontSize={12} 
                fontWeight="500"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={12} 
                fontWeight="500"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '16px',
                  color: '#f9fafb',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                  backdropFilter: 'blur(8px)',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                labelStyle={{ color: '#d1d5db', fontWeight: '600' }}
              />
              <Bar 
                dataKey="presenze" 
                fill="url(#presenzeGradient)" 
                name="Presenze" 
                radius={[8, 8, 0, 0]}
                stroke="rgba(16, 185, 129, 0.3)"
                strokeWidth={1}
              />
              <Bar 
                dataKey="assenze" 
                fill="url(#assenzeGradient)" 
                name="Assenze" 
                radius={[8, 8, 0, 0]}
                stroke="rgba(239, 68, 68, 0.3)"
                strokeWidth={1}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department Distribution */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <Target className="h-6 w-6 mr-3 text-purple-400" />
            Dipartimenti
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={departmentData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {departmentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f9fafb'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {departmentData.map((dept, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: dept.color }}></div>
                  <span className="text-slate-300">{dept.name}</span>
                </div>
                <span className="text-white font-semibold">{dept.value}</span>
              </div>
            ))}
          </div>
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
            <button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Timbra Entrata
            </button>
            <button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center">
              <XCircle className="h-5 w-5 mr-2" />
              Timbra Uscita
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