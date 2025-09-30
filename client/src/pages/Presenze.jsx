import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { Clock, Calendar, CheckCircle, XCircle, TrendingUp, TrendingDown, Users, AlertCircle } from 'lucide-react';

const Attendance = () => {
  const { user, apiCall } = useAuthStore();
  const [attendance, setAttendance] = useState([]);
  const [hoursBalance, setHoursBalance] = useState({
    total_balance: 0,
    overtime_hours: 0,
    deficit_hours: 0,
    working_days: 0,
    absent_days: 0
  });
  const [workSchedules, setWorkSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchAttendance();
    fetchHoursBalance();
    fetchWorkSchedules();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await apiCall('/api/attendance');
      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      } else {
        setAttendance([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHoursBalance = async () => {
    try {
      const currentDate = new Date();
      const response = await apiCall(`/api/attendance/hours-balance?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`);
      if (response.ok) {
        const data = await response.json();
        setHoursBalance(data);
      }
    } catch (error) {
      console.error('Error fetching hours balance:', error);
    }
  };

  const fetchWorkSchedules = async () => {
    try {
      const response = await apiCall('/api/work-schedules');
      if (response.ok) {
        const data = await response.json();
        setWorkSchedules(data);
      }
    } catch (error) {
      console.error('Error fetching work schedules:', error);
    }
  };

  const formatTime = (time) => {
    return time ? new Date(time).toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }) : '--:--';
  };

  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return '0h 0m';
    const h = Math.floor(Math.abs(hours));
    const m = Math.round((Math.abs(hours) - h) * 60);
    return `${hours < 0 ? '-' : ''}${h}h ${m}m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'text-green-400';
      case 'absent': return 'text-red-400';
      case 'holiday': return 'text-blue-400';
      case 'non_working_day': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'present': return 'Presente';
      case 'absent': return 'Assente';
      case 'holiday': return 'Festivo';
      case 'non_working_day': return 'Non lavorativo';
      default: return 'Sconosciuto';
    }
  };

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'text-green-400';
    if (balance < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getBalanceIcon = (balance) => {
    if (balance > 0) return <TrendingUp className="h-4 w-4" />;
    if (balance < 0) return <TrendingDown className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getTodaySchedule = () => {
    const today = new Date().getDay();
    return workSchedules.find(schedule => schedule.day_of_week === today);
  };

  const todaySchedule = getTodaySchedule();
  const todayAttendance = attendance.find(record => 
    new Date(record.date).toDateString() === new Date().toDateString()
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Presenze</h1>
          <p className="text-slate-400">
            Sistema automatico basato su orari di lavoro - Monte ore: {formatHours(hoursBalance.total_balance)}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Monte Ore Mensile */}
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Monte Ore Mensile</p>
                <p className={`text-2xl font-bold ${getBalanceColor(hoursBalance.total_balance)}`}>
                  {formatHours(hoursBalance.total_balance)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${getBalanceColor(hoursBalance.total_balance)}`}>
                {getBalanceIcon(hoursBalance.total_balance)}
              </div>
            </div>
          </div>

          {/* Ore Straordinario */}
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Straordinari</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatHours(hoursBalance.overtime_hours)}
                </p>
              </div>
              <div className="p-3 rounded-full text-green-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Ore Deficit */}
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Deficit</p>
                <p className="text-2xl font-bold text-red-400">
                  {formatHours(hoursBalance.deficit_hours)}
                </p>
              </div>
              <div className="p-3 rounded-full text-red-400">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Giorni Lavorativi */}
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Giorni Lavorativi</p>
                <p className="text-2xl font-bold text-blue-400">
                  {hoursBalance.working_days}
                </p>
              </div>
              <div className="p-3 rounded-full text-blue-400">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Today's Status */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Stato Oggi
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Orario di Lavoro */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Orario di Lavoro</h3>
              {todaySchedule && todaySchedule.is_working_day ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inizio:</span>
                    <span className="font-mono">{todaySchedule.start_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fine:</span>
                    <span className="font-mono">{todaySchedule.end_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pausa:</span>
                    <span className="font-mono">{todaySchedule.break_duration} min</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-700 pt-2">
                    <span className="text-slate-400">Ore Attese:</span>
                    <span className="font-bold text-green-400">
                      {formatHours(todaySchedule.expected_hours || 8)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400">
                  <p>Giorno non lavorativo</p>
                </div>
              )}
            </div>

            {/* Stato Presenza */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Stato Presenza</h3>
              {todayAttendance ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Stato:</span>
                    <span className={`font-semibold ${getStatusColor(todayAttendance.status)}`}>
                      {getStatusText(todayAttendance.status)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ore Attese:</span>
                    <span className="font-mono">{formatHours(todayAttendance.expected_hours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ore Effettive:</span>
                    <span className="font-mono">{formatHours(todayAttendance.actual_hours)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-700 pt-2">
                    <span className="text-slate-400">Saldo Ore:</span>
                    <span className={`font-bold ${getBalanceColor(todayAttendance.balance_hours)}`}>
                      {formatHours(todayAttendance.balance_hours)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400">
                  <p>Nessun record per oggi</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Attendance History */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Cronologia Presenze
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4">Data</th>
                  <th className="text-left py-3 px-4">Stato</th>
                  <th className="text-left py-3 px-4">Ore Attese</th>
                  <th className="text-left py-3 px-4">Ore Effettive</th>
                  <th className="text-left py-3 px-4">Saldo Ore</th>
                  <th className="text-left py-3 px-4">Note</th>
                </tr>
              </thead>
              <tbody>
                {attendance.slice(0, 10).map((record) => (
                  <tr key={record.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4">
                      {new Date(record.date).toLocaleDateString('it-IT')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${getStatusColor(record.status)}`}>
                        {getStatusText(record.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {formatHours(record.expected_hours)}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {formatHours(record.actual_hours)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${getBalanceColor(record.balance_hours)}`}>
                        {formatHours(record.balance_hours)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {record.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {attendance.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun record di presenza trovato</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-300 mb-3 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Come Funziona il Sistema
          </h3>
          <div className="text-slate-300 space-y-2">
            <p>• <strong>Presenza Automatica:</strong> Sei considerato presente in base al tuo orario di lavoro</p>
            <p>• <strong>Monte Ore:</strong> Parti da 0 ore e accumuli ore positive (straordinari) o negative (deficit)</p>
            <p>• <strong>Assenze:</strong> Solo quando hai richieste di permesso/malattia/ferie approvate</p>
            <p>• <strong>Gestione Admin:</strong> Gli amministratori possono modificare ore effettive e contrassegnare straordinari</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;