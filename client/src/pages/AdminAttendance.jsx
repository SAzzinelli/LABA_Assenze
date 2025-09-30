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

      {/* Current Attendance */}
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
  );
};

export default AdminAttendance;
