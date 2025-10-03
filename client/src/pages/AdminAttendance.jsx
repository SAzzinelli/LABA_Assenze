import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { 
  Clock, 
  Users, 
  AlertCircle, 
  RefreshCw, 
  Edit3, 
  Save, 
  X, 
  Calendar,
  Filter,
  Search,
  Download,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock3,
  User,
  CalendarDays,
  BarChart3,
  Settings,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stati per modali
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Stati per editing
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    actual_hours: 0,
    is_overtime: false,
    is_early_departure: false,
    is_late_arrival: false,
    notes: ''
  });

  // Stati per generazione presenze
  const [generateForm, setGenerateForm] = useState({
    startDate: '',
    endDate: '',
    employeeId: '',
    allEmployees: true
  });

  // Statistiche
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    totalHours: 0,
    averageHours: 0
  });

  useEffect(() => {
    fetchAttendanceData();
    fetchEmployees();
    fetchStats();
    // Aggiorna ogni 60 secondi
    const interval = setInterval(fetchAttendanceData, 60000);
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
        setEmployees(data.employees || data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await apiCall(`/api/attendance/stats?date=${today}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
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
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      case 'holiday': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'non_working_day': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'holiday': return <Calendar className="h-4 w-4" />;
      case 'non_working_day': return <Minus className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'text-green-600 bg-green-50 border-green-200';
    if (balance < 0) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
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
    setShowEditModal(true);
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
        alert(data.message || 'Record aggiornato con successo!');
        setShowEditModal(false);
        setEditingRecord(null);
        fetchAttendanceData();
        fetchStats();
        if (activeTab === 'history') {
          fetchAttendanceHistory();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Errore durante l\'aggiornamento');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Errore durante l\'aggiornamento');
    }
  };

  const handleGenerateAttendance = async () => {
    try {
      const response = await apiCall('/api/attendance/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: generateForm.allEmployees ? null : generateForm.employeeId,
          startDate: generateForm.startDate,
          endDate: generateForm.endDate
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Presenze generate con successo!');
        setShowGenerateModal(false);
        setGenerateForm({
          startDate: '',
          endDate: '',
          employeeId: '',
          allEmployees: true
        });
        fetchAttendanceData();
        fetchStats();
        if (activeTab === 'history') {
          fetchAttendanceHistory();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Errore durante la generazione');
      }
    } catch (error) {
      console.error('Error generating attendance:', error);
      alert('Errore durante la generazione');
    }
  };

  const filteredData = (activeTab === 'today' ? attendance : attendanceHistory).filter(record => {
    if (!searchTerm) return true;
    const employeeName = record.users ? 
      `${record.users.first_name} ${record.users.last_name}`.toLowerCase() : '';
    return employeeName.includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <div className="text-white text-xl">Caricamento presenze...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Gestione Presenze</h1>
              <p className="text-slate-400">
                Sistema di gestione presenze avanzato per amministratori
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Ultimo aggiornamento: {lastUpdate.toLocaleTimeString('it-IT')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowGenerateModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Genera Presenze
              </button>
              <button
                onClick={fetchAttendanceData}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Aggiorna
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filtri
              </button>
            </div>
          </div>
        </div>

        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-slate-400 text-sm">Totale Dipendenti</p>
                <p className="text-2xl font-bold text-white">{stats.totalEmployees}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-slate-400 text-sm">Presenti Oggi</p>
                <p className="text-2xl font-bold text-white">{stats.presentToday}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-slate-400 text-sm">Assenti Oggi</p>
                <p className="text-2xl font-bold text-white">{stats.absentToday}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock3 className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-slate-400 text-sm">Ore Totali</p>
                <p className="text-2xl font-bold text-white">{formatHours(stats.totalHours)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'today' 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Oggi
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                activeTab === 'history' 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Cronologia
            </button>
          </div>
        </div>

        {/* Filtri */}
        {showFilters && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Cerca Dipendente</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nome o cognome..."
                    className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              {activeTab === 'history' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Mese</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Tutti i dipendenti</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tabella Presenze */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              {activeTab === 'today' ? 'Presenze di Oggi' : 'Cronologia Presenze'}
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Dipendente</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Data</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Stato</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Ore Attese</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Ore Effettive</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Saldo Ore</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Note</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-300">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((record) => (
                  <tr key={record.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                          <User className="h-4 w-4 text-slate-300" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {record.users ? `${record.users.first_name} ${record.users.last_name}` : 'N/A'}
                          </p>
                          <p className="text-sm text-slate-400">
                            {record.users?.email || ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-slate-300">
                          {new Date(record.date).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                        {getStatusIcon(record.status)}
                        <span className="ml-1">{getStatusText(record.status)}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-slate-300">
                        {formatHours(record.expected_hours)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-slate-300">
                        {formatHours(record.actual_hours)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getBalanceColor(record.balance_hours)}`}>
                        {record.balance_hours > 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : record.balance_hours < 0 ? (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        ) : null}
                        {formatHours(record.balance_hours)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-slate-400">
                        {record.notes || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Modifica record"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Visualizza dettagli"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-slate-500" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">Nessun record trovato</h3>
              <p className="text-slate-500">
                {activeTab === 'today' 
                  ? 'Non ci sono presenze registrate per oggi' 
                  : 'Nessun record di presenza trovato per i filtri selezionati'
                }
              </p>
            </div>
          )}
        </div>

        {/* Modale Modifica Record */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Modifica Record Presenza</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ore Effettive</label>
                  <input
                    type="number"
                    step="0.25"
                    value={editForm.actual_hours}
                    onChange={(e) => setEditForm({...editForm, actual_hours: parseFloat(e.target.value) || 0})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Note</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows="3"
                    placeholder="Aggiungi note..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.is_overtime}
                      onChange={(e) => setEditForm({...editForm, is_overtime: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Straordinario</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.is_early_departure}
                      onChange={(e) => setEditForm({...editForm, is_early_departure: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Uscita Anticipata</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.is_late_arrival}
                      onChange={(e) => setEditForm({...editForm, is_late_arrival: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Arrivo in Ritardo</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modale Genera Presenze */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Genera Presenze</h3>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Data Inizio</label>
                  <input
                    type="date"
                    value={generateForm.startDate}
                    onChange={(e) => setGenerateForm({...generateForm, startDate: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Data Fine</label>
                  <input
                    type="date"
                    value={generateForm.endDate}
                    onChange={(e) => setGenerateForm({...generateForm, endDate: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={generateForm.allEmployees}
                      onChange={(e) => setGenerateForm({...generateForm, allEmployees: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-300">Tutti i dipendenti</span>
                  </label>
                </div>
                
                {!generateForm.allEmployees && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Dipendente</label>
                    <select
                      value={generateForm.employeeId}
                      onChange={(e) => setGenerateForm({...generateForm, employeeId: e.target.value})}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Seleziona dipendente</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleGenerateAttendance}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Genera
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAttendance;