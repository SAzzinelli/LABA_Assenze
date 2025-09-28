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
  const { user } = useAuthStore();
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
      const statsResponse = await fetch('/api/dashboard/stats', {
        credentials: 'include'
      });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats({
          presentToday: statsData.presentToday || 0,
          pendingRequests: statsData.pendingRequests || 0
        });
      }

      // Fetch weekly attendance
      const attendanceResponse = await fetch('/api/dashboard/attendance', {
        credentials: 'include'
      });
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        setWeeklyAttendance(attendanceData);
      }

      // Fetch departments
      const departmentsResponse = await fetch('/api/dashboard/departments', {
        credentials: 'include'
      });
      if (departmentsResponse.ok) {
        const departmentsData = await departmentsResponse.json();
        setDepartments(departmentsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyAttendanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f9fafb'
                }}
              />
              <Bar dataKey="presenze" fill="#10b981" name="Presenze" radius={[4, 4, 0, 0]} />
              <Bar dataKey="assenze" fill="#ef4444" name="Assenze" radius={[4, 4, 0, 0]} />
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