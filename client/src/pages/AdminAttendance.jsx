import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { Clock, Users, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';

const AdminAttendance = () => {
  const { user, apiCall } = useAuthStore();
  const [currentAttendance, setCurrentAttendance] = useState([]);
  const [upcomingDepartures, setUpcomingDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('current');
  
  // Stati per cronologia
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchAttendanceData();
    fetchEmployees();
    // Aggiorna ogni 30 secondi
    const interval = setInterval(fetchAttendanceData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAttendanceHistory();
    }
  }, [activeTab, selectedMonth, selectedYear, selectedEmployee]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      
      // Fetch current attendance
      const currentResponse = await apiCall('/api/attendance/current');
      if (currentResponse.ok) {
        const currentData = await currentResponse.json();
        setCurrentAttendance(currentData);
      }

      // Fetch upcoming departures
      const upcomingResponse = await apiCall('/api/attendance/upcoming-departures');
      if (upcomingResponse.ok) {
        const upcomingData = await upcomingResponse.json();
        setUpcomingDepartures(upcomingData);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      setHistoryLoading(true);
      
      // Costruisci i parametri della query
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedYear) params.append('year', selectedYear);
      if (selectedEmployee) params.append('userId', selectedEmployee);
      
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
    return timeString.substring(0, 5);
  };

  const getHoursWorked = (checkIn) => {
    if (!checkIn) return '0h 0m';
    const now = new Date();
    const checkInTime = new Date(`${now.toISOString().split('T')[0]}T${checkIn}`);
    const diffMs = now - checkInTime;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getDepartureText = (minutes) => {
    if (minutes <= 0) return 'Dovrebbe essere già uscito';
    if (minutes < 60) return `Fra ${minutes} minuti`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `Fra ${hours}h`;
    return `Fra ${hours}h ${remainingMinutes}m`;
  };

  if (loading && currentAttendance.length === 0) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Users className="h-8 w-8 mr-3 text-green-400" />
              Presenze
            </h1>
            <p className="text-slate-400 mt-2">
              Gestione presenze e monitoraggio dipendenti
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-slate-400">Ultimo aggiornamento</div>
              <div className="text-white font-medium">
                {lastUpdate.toLocaleTimeString('it-IT')}
              </div>
            </div>
            <button
              onClick={fetchAttendanceData}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              title="Aggiorna"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex space-x-1 bg-slate-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'current'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Presenze Attuali
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Cronologia Presenze
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'current' ? (
        <div className="space-y-6">
          {/* Current Attendance Content */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center">
          <Clock className="h-6 w-6 mr-3 text-green-400" />
          Presenti Ora in Ufficio ({currentAttendance.length})
        </h3>
        
        {currentAttendance.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-400">Nessuno presente in ufficio al momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentAttendance.map((person) => (
              <div key={person.id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-white font-semibold">{person.name}</h4>
                    <p className="text-slate-400 text-sm">{person.department}</p>
                  </div>
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Entrata:</span>
                    <span className="text-white">{formatTime(person.check_in)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ore lavorate:</span>
                    <span className="text-green-400 font-medium">
                      {getHoursWorked(person.check_in)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Departures */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center">
          <ArrowRight className="h-6 w-6 mr-3 text-amber-400" />
          Prossime Uscite (Prossime 2 ore)
        </h3>
        
        {upcomingDepartures.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-400">Nessuna uscita programmata nelle prossime 2 ore</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingDepartures.map((person) => (
              <div key={person.id} className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 bg-indigo-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {person.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{person.name}</h4>
                      <p className="text-slate-400 text-sm">{person.department}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-white font-medium">
                      {person.expected_check_out}
                    </div>
                    <div className="text-sm text-amber-400">
                      {getDepartureText(person.minutes_until_departure)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Entrata:</span>
                    <span className="text-white">{formatTime(person.check_in)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* History Filters */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-400" />
              Filtri Cronologia
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={1}>Gennaio</option>
                  <option value={2}>Febbraio</option>
                  <option value={3}>Marzo</option>
                  <option value={4}>Aprile</option>
                  <option value={5}>Maggio</option>
                  <option value={6}>Giugno</option>
                  <option value={7}>Luglio</option>
                  <option value={8}>Agosto</option>
                  <option value={9}>Settembre</option>
                  <option value={10}>Ottobre</option>
                  <option value={11}>Novembre</option>
                  <option value={12}>Dicembre</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dipendente</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Tutti i dipendenti</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-400" />
              Cronologia Presenze
            </h2>
            
            {historyLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : attendanceHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-4 text-slate-300">Data</th>
                      <th className="text-left py-3 px-4 text-slate-300">Dipendente</th>
                      <th className="text-left py-3 px-4 text-slate-300">Entrata</th>
                      <th className="text-left py-3 px-4 text-slate-300">Uscita</th>
                      <th className="text-left py-3 px-4 text-slate-300">Ore Lavorate</th>
                      <th className="text-left py-3 px-4 text-slate-300">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map((record) => (
                      <tr key={record.id} className="border-b border-slate-700 hover:bg-slate-700">
                        <td className="py-3 px-4 text-white">
                          {new Date(record.date).toLocaleDateString('it-IT')}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {record.user_id ? 
                            employees.find(emp => emp.id === record.user_id)?.first_name + ' ' + 
                            employees.find(emp => emp.id === record.user_id)?.last_name : 
                            'N/A'
                          }
                        </td>
                        <td className="py-3 px-4 text-white">
                          {record.clock_in ? formatTime(record.clock_in) : '-'}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {record.clock_out ? formatTime(record.clock_out) : '-'}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {record.hours_worked ? `${record.hours_worked.toFixed(1)}h` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.clock_in && record.clock_out 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {record.clock_in && record.clock_out ? 'Completo' : 'Incompleto'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">Nessun record trovato per i filtri selezionati</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAttendance;
