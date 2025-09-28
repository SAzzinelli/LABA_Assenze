import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { 
  Users, 
  Clock, 
  FileText, 
  TrendingUp, 
  Calendar,
  CheckCircle,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Zap,
  Target,
  Award
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';

const Dashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingRequests: 0,
    attendanceRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dati realistici per i grafici
  const weeklyAttendanceData = [
    { name: 'Lun', presenze: 42, assenze: 3, ore: 336 },
    { name: 'Mar', presenze: 44, assenze: 1, ore: 352 },
    { name: 'Mer', presenze: 43, assenze: 2, ore: 344 },
    { name: 'Gio', presenze: 45, assenze: 0, ore: 360 },
    { name: 'Ven', presenze: 41, assenze: 4, ore: 328 },
    { name: 'Sab', presenze: 18, assenze: 0, ore: 144 },
    { name: 'Dom', presenze: 8, assenze: 0, ore: 64 }
  ];

  const departmentData = [
    { name: 'Amministrazione', value: 12, color: '#8b5cf6', employees: 12 },
    { name: 'Segreteria', value: 8, color: '#06b6d4', employees: 8 },
    { name: 'Orientamento', value: 15, color: '#10b981', employees: 15 },
    { name: 'Reparto IT', value: 6, color: '#f59e0b', employees: 6 }
  ];

  const performanceData = [
    { month: 'Gen', productivity: 85, satisfaction: 92, attendance: 94 },
    { month: 'Feb', productivity: 88, satisfaction: 89, attendance: 96 },
    { month: 'Mar', productivity: 92, satisfaction: 95, attendance: 98 },
    { month: 'Apr', productivity: 89, satisfaction: 91, attendance: 95 },
    { month: 'Mag', productivity: 94, satisfaction: 93, attendance: 97 },
    { month: 'Giu', productivity: 96, satisfaction: 96, attendance: 99 }
  ];

  const recentActivities = [
    {
      id: 1,
      type: 'checkin',
      user: 'Marco Rossi',
      time: '08:30',
      icon: CheckCircle,
      color: 'text-green-400'
    },
    {
      id: 2,
      type: 'request',
      user: 'Anna Bianchi',
      time: '09:15',
      icon: FileText,
      color: 'text-yellow-400'
    },
    {
      id: 3,
      type: 'checkout',
      user: 'Luca Verdi',
      time: '17:45',
      icon: Clock,
      color: 'text-blue-400'
    },
    {
      id: 4,
      type: 'alert',
      user: 'Sistema',
      time: '10:20',
      icon: AlertCircle,
      color: 'text-red-400'
    }
  ];

  const statCards = [
    {
      title: 'Totale Dipendenti',
      value: stats.totalEmployees || 41,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      change: '+2',
      changeType: 'positive',
      subtitle: 'Dipendenti attivi'
    },
    {
      title: 'Presenti Oggi',
      value: stats.presentToday || 38,
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-teal-500',
      change: '+5%',
      changeType: 'positive',
      subtitle: 'Tasso presenza: 93%'
    },
    {
      title: 'Richieste in Sospeso',
      value: stats.pendingRequests || 7,
      icon: FileText,
      gradient: 'from-amber-500 to-orange-500',
      change: '-3',
      changeType: 'negative',
      subtitle: 'Da approvare'
    },
    {
      title: 'Ore Lavorate',
      value: '2,184h',
      icon: Clock,
      gradient: 'from-purple-500 to-pink-500',
      change: '+12%',
      changeType: 'positive',
      subtitle: 'Questo mese'
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
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur-3xl"></div>
        <div className="relative glass-card p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-slate-400 mt-2 text-lg">
                Benvenuto, <span className="text-white font-semibold">{user?.firstName}</span>! 
                Ecco un riepilogo delle attività del sistema HR
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-slate-400">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm">Sistema aggiornato</span>
              </div>
              <div className="h-8 w-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <div key={index} className="stat-card group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-slate-400 text-sm font-medium mb-1">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-white mb-1">
                    {stat.value}
                  </p>
                  <p className="text-slate-400 text-xs">
                    {stat.subtitle}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl bg-gradient-to-r ${stat.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <IconComponent className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className={`flex items-center text-sm ${
                  stat.changeType === 'positive' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {stat.changeType === 'positive' ? (
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 mr-1" />
                  )}
                  <span className="font-semibold">{stat.change}</span>
                </div>
                <span className="text-slate-500 text-xs">vs mese scorso</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Attendance Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <Activity className="h-6 w-6 mr-3 text-indigo-400" />
              Presenze Settimanali
            </h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center text-emerald-400">
                <div className="h-3 w-3 bg-emerald-500 rounded-full mr-2"></div>
                Presenze
              </div>
              <div className="flex items-center text-red-400">
                <div className="h-3 w-3 bg-red-500 rounded-full mr-2"></div>
                Assenze
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={weeklyAttendanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="presenzeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                </linearGradient>
                <linearGradient id="assenzeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                }}
              />
              <Bar dataKey="presenze" fill="url(#presenzeGradient)" name="Presenze" radius={[4, 4, 0, 0]} />
              <Bar dataKey="assenze" fill="url(#assenzeGradient)" name="Assenze" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <Target className="h-6 w-6 mr-3 text-purple-400" />
              Dipartimenti
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
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
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                }}
                formatter={(value, name, props) => [`${props.payload.employees} dipendenti`, props.payload.name]}
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
                <span className="text-white font-semibold">{dept.employees}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center">
            <Award className="h-6 w-6 mr-3 text-amber-400" />
            Performance Mensile
          </h3>
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center text-blue-400">
              <div className="h-3 w-3 bg-blue-500 rounded-full mr-2"></div>
              Produttività
            </div>
            <div className="flex items-center text-emerald-400">
              <div className="h-3 w-3 bg-emerald-500 rounded-full mr-2"></div>
              Soddisfazione
            </div>
            <div className="flex items-center text-purple-400">
              <div className="h-3 w-3 bg-purple-500 rounded-full mr-2"></div>
              Presenze
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="productivityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="satisfactionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} domain={[80, 100]} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1e293b', 
                border: '1px solid #334155',
                borderRadius: '12px',
                color: '#f8fafc',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
              }}
            />
            <Area type="monotone" dataKey="productivity" stroke="#3b82f6" fill="url(#productivityGradient)" strokeWidth={3} />
            <Area type="monotone" dataKey="satisfaction" stroke="#10b981" fill="url(#satisfactionGradient)" strokeWidth={3} />
            <Area type="monotone" dataKey="attendance" stroke="#8b5cf6" fill="url(#attendanceGradient)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Zap className="h-6 w-6 mr-3 text-yellow-400" />
              Azioni Rapide
            </h3>
            <div className="space-y-3">
              {user?.role === 'admin' ? (
                <>
                  <button className="btn btn-primary w-full justify-start">
                    <Users className="h-5 w-5 mr-3" />
                    Gestisci Dipendenti
                  </button>
                  <button className="btn btn-secondary w-full justify-start">
                    <FileText className="h-5 w-5 mr-3" />
                    Approva Richieste
                  </button>
                  <button className="btn btn-secondary w-full justify-start">
                    <TrendingUp className="h-5 w-5 mr-3" />
                    Report Presenze
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-success w-full justify-start">
                    <Clock className="h-5 w-5 mr-3" />
                    Timbra Presenza
                  </button>
                  <button className="btn btn-secondary w-full justify-start">
                    <FileText className="h-5 w-5 mr-3" />
                    Richiedi Permesso
                  </button>
                  <button className="btn btn-secondary w-full justify-start">
                    <Calendar className="h-5 w-5 mr-3" />
                    Le Mie Presenze
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center">
                <Activity className="h-6 w-6 mr-3 text-cyan-400" />
                Attività Recenti
              </h3>
              <button className="text-slate-400 hover:text-white text-sm font-medium">
                Vedi tutto
              </button>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const IconComponent = activity.icon;
                return (
                  <div key={activity.id} className="flex items-center space-x-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-colors">
                    <div className={`p-3 rounded-xl shadow-lg ${activity.color.replace('text-', 'bg-').replace('-400', '-500/20')} border ${activity.color.replace('text-', 'border-').replace('-400', '-500/30')}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">
                        {activity.user}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {activity.type === 'checkin' && 'Ha timbrato l\'entrata'}
                        {activity.type === 'checkout' && 'Ha timbrato l\'uscita'}
                        {activity.type === 'request' && 'Ha inviato una richiesta'}
                        {activity.type === 'alert' && 'Sistema: richiesta approvata'}
                      </p>
                    </div>
                    <div className="text-slate-400 text-sm font-medium">
                      {activity.time}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;