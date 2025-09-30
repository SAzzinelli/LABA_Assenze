import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { Clock, Users, AlertCircle, RefreshCw, Edit3, Save, X, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

const AdminAttendance = () => {
  const { user, apiCall } = useAuthStore();
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('today');
  
  // Stati per cronologia
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  // Stati per editing
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    actual_hours: 0,
    is_overtime: false,
    is_early_departure: false,
    is_late_arrival: false,
    notes: ''
  });

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
      
      // Fetch today's attendance
      const today = new Date().toISOString().split('T')[0];
      const response = await apiCall(`/api/attendance?date=${today}`);
      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
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
    const date = new Date(timeString);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
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

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setEditForm({
      actual_hours: record.actual_hours || record.expected_hours || 0,
      is_overtime: record.is_overtime || false,
      is_early_departure: record.is_early_departure || false,
      is_late_arrival: record.is_late_arrival || false,
      notes: record.notes || ''
    });
  };

  const handleSaveEdit = async () => {
    try {
      const response = await apiCall(`/api/attendance/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        setEditingRecord(null);
        fetchAttendanceData();
        if (activeTab === 'history') {
          fetchAttendanceHistory();
        }
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Errore durante l\'aggiornamento');
    }
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditForm({
      actual_hours: 0,
      is_overtime: false,
      is_early_departure: false,
      is_late_arrival: false,
      notes: ''
    });
  };

  const generateAttendanceForPeriod = async () => {
    const startDate = prompt('Data inizio (YYYY-MM-DD):');
    const endDate = prompt('Data fine (YYYY-MM-DD):');
    const employeeId = prompt('ID dipendente (lascia vuoto per tutti):');

    if (!startDate || !endDate) {
      alert('Inserisci date valide');
      return;
    }

    try {
      const response = await apiCall('/api/attendance/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: employeeId || null,
          startDate,
          endDate
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchAttendanceData();
        if (activeTab === 'history') {
          fetchAttendanceHistory();
        }
      } else {
        const error = await response.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error generating attendance:', error);
      alert('Errore durante la generazione');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Gestione Presenze</h1>
              <p className="text-slate-400">
                Sistema automatico basato su orari di lavoro
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={generateAttendanceForPeriod}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Genera Presenze
              </button>
              <button
                onClick={fetchAttendanceData}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Aggiorna
              </button>
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-2">
            Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'today' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Oggi
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'history' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cronologia
            </button>
          </div>
        </div>

        {/* Filters for History */}
        {activeTab === 'history' && (
          <div className="bg-slate-800 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleDateString('it-IT', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dipendente</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Tutti</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Table */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            {activeTab === 'today' ? 'Presenze di Oggi' : 'Cronologia Presenze'}
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4">Dipendente</th>
                  <th className="text-left py-3 px-4">Data</th>
                  <th className="text-left py-3 px-4">Stato</th>
                  <th className="text-left py-3 px-4">Ore Attese</th>
                  <th className="text-left py-3 px-4">Ore Effettive</th>
                  <th className="text-left py-3 px-4">Saldo Ore</th>
                  <th className="text-left py-3 px-4">Note</th>
                  <th className="text-left py-3 px-4">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'today' ? attendance : attendanceHistory).map((record) => (
                  <tr key={record.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4">
                      {record.users ? `${record.users.first_name} ${record.users.last_name}` : 'N/A'}
                    </td>
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
                      {editingRecord?.id === record.id ? (
                        <input
                          type="number"
                          step="0.25"
                          value={editForm.actual_hours}
                          onChange={(e) => setEditForm({...editForm, actual_hours: parseFloat(e.target.value) || 0})}
                          className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        />
                      ) : (
                        formatHours(record.actual_hours)
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${getBalanceColor(record.balance_hours)}`}>
                        {formatHours(record.balance_hours)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {editingRecord?.id === record.id ? (
                        <input
                          type="text"
                          value={editForm.notes}
                          onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                          className="w-32 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                          placeholder="Note..."
                        />
                      ) : (
                        record.notes || '-'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingRecord?.id === record.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="text-green-400 hover:text-green-300"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {((activeTab === 'today' ? attendance : attendanceHistory).length === 0) && (
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
            Gestione Presenze per Amministratori
          </h3>
          <div className="text-slate-300 space-y-2">
            <p>• <strong>Modifica Ore:</strong> Clicca sull'icona di modifica per aggiornare le ore effettive</p>
            <p>• <strong>Genera Presenze:</strong> Crea automaticamente i record per un periodo specifico</p>
            <p>• <strong>Saldo Ore:</strong> Calcolato automaticamente come differenza tra ore effettive e attese</p>
            <p>• <strong>Straordinari:</strong> Contrassegna le ore extra come straordinario concordato</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAttendance;