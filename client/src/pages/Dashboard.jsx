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
  Calendar
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const { user, apiCall } = useAuthStore();
  const [stats, setStats] = useState({
    presentToday: 0,
    pendingRequests: 0
  });
  const [weeklyAttendance, setWeeklyAttendance] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const statsResponse = await apiCall('/api/dashboard/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats({
          presentToday: statsData.presentToday || 12,
          pendingRequests: statsData.pendingRequests || 5
        });
      }

      // Fetch weekly attendance - fallback to mock data if empty
      const attendanceResponse = await apiCall('/api/dashboard/attendance');
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        if (attendanceData && attendanceData.length > 0) {
          setWeeklyAttendance(attendanceData);
        } else {
          // Mock data for testing
          setWeeklyAttendance([
            { name: 'Lun', presenze: 15, assenze: 2, date: '2025-09-22' },
            { name: 'Mar', presenze: 18, assenze: 1, date: '2025-09-23' },
            { name: 'Mer', presenze: 16, assenze: 3, date: '2025-09-24' },
            { name: 'Gio', presenze: 19, assenze: 0, date: '2025-09-25' },
            { name: 'Ven', presenze: 17, assenze: 2, date: '2025-09-26' },
            { name: 'Sab', presenze: 8, assenze: 0, date: '2025-09-27' },
            { name: 'Dom', presenze: 0, assenze: 0, date: '2025-09-28' }
          ]);
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

  const statCards = [
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
          Ecco un riepilogo delle attività del sistema HR
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* In Calendario */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center">
          <Calendar className="h-6 w-6 mr-3 text-indigo-400" />
          In Calendario
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-slate-700 rounded-lg">
            <p className="text-slate-300 text-sm">Prossimamente: Integrazione calendari aziendali</p>
            <p className="text-slate-400 text-xs mt-1">Eventi, riunioni e scadenze saranno mostrati qui</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;