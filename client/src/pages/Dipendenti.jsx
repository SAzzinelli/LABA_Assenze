import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { formatHours } from '../utils/hoursCalculation';
import { useModal } from '../hooks/useModal';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import AddEmployeeModal from '../components/AddEmployeeModal';
import CustomAlert from '../components/CustomAlert';
import ConfirmModal from '../components/ConfirmModal';
import { Users, Plus, Edit, Trash2, Search, Filter, X, Save, User, Mail, Phone, Calendar, Briefcase, CheckSquare, Eye, Clock, Sun, Moon, Coffee, DollarSign, TrendingUp, TrendingDown, Activity, LayoutGrid, List, Key } from 'lucide-react';

const Employees = () => {
  const { user, apiCall } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' o 'card' per desktop
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Stati per alert custom
  const [alert, setAlert] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, employeeId: null, employeeName: '' });

  // Funzioni helper per alert
  const showAlert = (type, title, message) => {
    setAlert({ isOpen: true, type, title, message });
  };

  const closeAlert = () => {
    setAlert({ isOpen: false, type: 'success', title: '', message: '' });
  };

  // Hook per gestire chiusura modal con ESC e click fuori
  useModal(showAddModal, () => setShowAddModal(false));
  useModal(showEditModal, () => setShowEditModal(false));
  useModal(showDetailsModal, () => setShowDetailsModal(false));

  // Real-time updates
  const { emitUpdate } = useRealTimeUpdates({
    onEmployeeUpdate: (data) => {
      console.log('👤 Aggiornamento dipendenti ricevuto:', data);
      fetchEmployees();
    }
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailActiveTab, setDetailActiveTab] = useState('details');
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    department: '',
    has104: false
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const formatHoursValue = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return { sign: '', hours: 0, minutes: 0, full: '0h 0m' };
    }

    const sign = value < 0 ? '-' : value > 0 ? '+' : '';
    const absValue = Math.abs(value);
    const hours = Math.floor(absValue);
    const minutes = Math.max(0, Math.floor((absValue - hours) * 60));

    return {
      sign,
      hours,
      minutes,
      full: `${sign}${hours}h ${minutes}m`
    };
  };

  const fetchEmployees = async () => {
    try {
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const employees = await response.json();
        setEmployees(employees);
      } else {
        // Nessun dipendente trovato
        setEmployees([]);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await apiCall('/api/departments');
      if (response.ok) {
        const departments = await response.json();
        setDepartments(departments);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };


  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const dayNames = {
    monday: 'Lunedì',
    tuesday: 'Martedì',
    wednesday: 'Mercoledì',
    thursday: 'Giovedì',
    friday: 'Venerdì',
    saturday: 'Sabato',
    sunday: 'Domenica'
  };

  // Ordine corretto dei giorni (Lunedì primo)
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const getWorkTypeIcon = (workType) => {
    switch (workType) {
      case 'morning': return <Sun className="h-4 w-4 text-yellow-400" />;
      case 'afternoon': return <Moon className="h-4 w-4 text-slate-400" />;
      case 'full': return <Clock className="h-4 w-4 text-purple-400" />;
      default: return <X className="h-4 w-4 text-slate-400" />;
    }
  };

  const getWorkTypeLabel = (workType) => {
    switch (workType) {
      case 'morning': return 'Solo Mattina';
      case 'afternoon': return 'Solo Pomeriggio';
      case 'full': return 'Giornata Completa';
      default: return 'Non Lavorativo';
    }
  };

  const handleAddEmployee = async (employeeData) => {
    try {
      const response = await apiCall('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      });

      if (response.ok) {
        const result = await response.json();

        // Emetti aggiornamento real-time
        emitUpdate('employee_updated', {
          type: 'created',
          employeeId: result.id,
          employeeName: `${employeeData.firstName} ${employeeData.lastName}`,
          department: employeeData.department,
          message: `Nuovo dipendente aggiunto: ${employeeData.firstName} ${employeeData.lastName}`
        });

        // Ricarica la lista dipendenti
        fetchEmployees();
        setShowAddModal(false);

        showAlert('success', 'Successo!', `Dipendente ${employeeData.firstName} ${employeeData.lastName} aggiunto con successo!`);
      } else {
        const error = await response.json();
        showAlert('error', 'Errore', error.error);
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      showAlert('error', 'Errore', 'Errore durante l\'aggiunta del dipendente');
    }
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      firstName: employee.firstName || employee.first_name || '',
      lastName: employee.lastName || employee.last_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      birthDate: employee.birthDate || employee.birth_date || '',
      department: employee.department || '',
      has104: employee.has104 || employee.has_104 || false
    });
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async () => {
    try {
      const response = await apiCall(`/api/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          birthDate: formData.birthDate,
          department: formData.department,
          has104: formData.has104
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Emetti aggiornamento real-time
        emitUpdate('employee_updated', {
          type: 'updated',
          employeeId: selectedEmployee.id,
          employeeName: `${formData.firstName} ${formData.lastName}`,
          department: formData.department
        });

        // Ricarica la lista dipendenti per assicurarsi che i dati siano aggiornati
        await fetchEmployees();
        setShowEditModal(false);
        setSelectedEmployee(null);
        resetForm();

        showAlert('success', 'Successo!', `Dipendente ${formData.firstName} ${formData.lastName} aggiornato con successo!`);
      } else {
        const error = await response.json();
        showAlert('error', 'Errore', error.error || 'Errore durante l\'aggiornamento del dipendente');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      showAlert('error', 'Errore', 'Errore durante l\'aggiornamento del dipendente');
    }
  };

  const handleDeleteEmployee = (employeeId) => {
    const employee = employees.find(emp => emp.id === employeeId);
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'questo dipendente';

    setConfirmModal({
      isOpen: true,
      employeeId,
      employeeName
    });
  };

  const confirmDeleteEmployee = async () => {
    const { employeeId, employeeName } = confirmModal;

    try {
      const response = await apiCall(`/api/employees/${employeeId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const data = await response.json();
        showAlert('success', 'Successo!', data.message || 'Dipendente eliminato con successo!');
        setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
      } else {
        const error = await response.json();
        showAlert('error', 'Errore', error.error || 'Errore durante l\'eliminazione del dipendente');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      showAlert('error', 'Errore', 'Errore di connessione durante l\'eliminazione');
    }
  };

  const handleResetPassword = async (employee) => {
    if (!window.confirm(`Sei sicuro di voler resettare la password per ${employee.name}?\n\nUna nuova password temporanea verrà generata e inviata via email.`)) {
      return;
    }

    try {
      const response = await apiCall(`/api/admin/employees/${employee.id}/reset-password`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        showAlert('success', 'Successo!', data.message || `Password resettata con successo. La nuova password è stata inviata via email a ${employee.email}`);
      } else {
        const error = await response.json();
        showAlert('error', 'Errore', error.error || 'Errore durante il reset della password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      showAlert('error', 'Errore', 'Errore di connessione durante il reset della password');
    }
  };

  const handleViewDetails = async (employee) => {
    console.log('Opening details for:', employee);
    setSelectedEmployee(employee);
    setShowDetailsModal(true);

    // Fetch balance data quando si aprono i dettagli
    if (employee.id) {
      await fetchEmployeeBalance(employee.id);
    }
  };

  const fetchEmployeeBalance = async (employeeId) => {
    try {
      // Fetch balance totale con logica real-time (singolo endpoint)
      let balanceValue = null;
      const singleBalanceResponse = await apiCall(`/api/attendance/total-balance?userId=${employeeId}`);
      if (singleBalanceResponse.ok) {
        const singleBalance = await singleBalanceResponse.json();
        const totalBalance = typeof singleBalance.totalBalanceHours === 'number'
          ? singleBalance.totalBalanceHours
          : null;
        const realTimeBalance = typeof singleBalance.realTime?.balanceHours === 'number'
          ? singleBalance.realTime.balanceHours
          : null;
        const remainingToday = typeof singleBalance.realTime?.remainingHours === 'number'
          ? singleBalance.realTime.remainingHours
          : 0;

        // Usa direttamente il balance totale dal backend (che include già oggi se necessario)
        balanceValue = totalBalance ?? realTimeBalance ?? 0;
      }

      // Fallback all'endpoint aggregato
      if (balanceValue === null) {
        const balanceResponse = await apiCall(`/api/attendance/total-balances?userIds=${employeeId}`);
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          balanceValue = balanceData.balances?.[employeeId] ?? 0;
        }
      }

      if (balanceValue !== null) {
        setCurrentBalance(balanceValue);
      }

      // Fetch history recente (ultimi 10 record)
      const historyResponse = await apiCall(`/api/attendance?userId=${employeeId}&limit=10`);
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setBalanceHistory(historyData || []);
      }
    } catch (error) {
      console.error('Error fetching employee balance:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      birthDate: '',
      department: '',
      has104: false
    });
  };

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [only104, setOnly104] = useState(false);

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter ? (emp.department || '').toLowerCase().includes(departmentFilter.toLowerCase()) : true;
    const matches104 = only104 ? emp.has104 === true : true;
    return matchesSearch && matchesDept && matches104;
  });

  if (user?.role !== 'admin' && user?.role !== 'supervisor') {
    return (
      <div className="flex items-center justify-center h-96 text-white text-2xl font-bold">
        Accesso negato. Solo gli amministratori e supervisori possono visualizzare questa pagina.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Users className="h-8 w-8 mr-3 text-slate-400" />
              Gestione Dipendenti
            </h1>
            <p className="text-slate-400 mt-2">
              Gestisci i dipendenti e le loro informazioni
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Aggiungi Dipendente
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-zinc-900 rounded-lg p-4 sm:p-6 border border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca dipendenti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>
          {/* Toggle Vista - Solo Desktop */}
          <div className="hidden md:flex items-center gap-2 bg-zinc-800 rounded-lg p-1 border border-zinc-700">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${viewMode === 'list'
                ? 'bg-zinc-900 text-white border border-zinc-700'
                : 'text-slate-300 hover:text-white'
                }`}
              title="Vista Lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${viewMode === 'card'
                ? 'bg-zinc-900 text-white border border-zinc-700'
                : 'text-slate-300 hover:text-white'
                }`}
              title="Vista Card"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setFiltersOpen(v => !v)} className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center border border-zinc-700">
            <Filter className="h-5 w-5 mr-2" />
            Filtri
          </button>
        </div>
        {filtersOpen && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Reparto</label>
              <input value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white" placeholder="Es. Amministrazione" />
            </div>
            <label className="flex items-center gap-2 mt-2 sm:mt-7">
              <input type="checkbox" checked={only104} onChange={e => setOnly104(e.target.checked)} className="h-4 w-4" />
              <span className="text-slate-300 text-sm">Solo beneficiari 104</span>
            </label>
          </div>
        )}
      </div>

      {/* Employees - Responsive: cards on mobile, table/cards on desktop based on viewMode */}
      {/* Mobile Cards - Sempre visibili su mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:hidden">
        {filteredEmployees.map((employee) => (
          <div
            key={employee.id}
            onClick={() => handleViewDetails(employee)}
            className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
                  <span className="text-white font-bold text-sm">
                    {employee.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="ml-3">
                  <div className="text-white font-semibold leading-5">{employee.name}</div>
                  <div className="text-slate-400 text-xs">{employee.email}</div>
                </div>
              </div>
              {employee.has104 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white border border-purple-400">104</span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="px-2 py-1 rounded-full bg-zinc-800 text-slate-300 border border-zinc-700">{employee.department}</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleEditEmployee(employee); }}
                className="flex-1 py-2 bg-zinc-800 text-white border border-zinc-700 rounded-lg hover:bg-zinc-700 touch-manipulation min-h-[44px] text-sm font-medium"
                title="Modifica"
              >
                Modifica
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleResetPassword(employee); }}
                className="flex-1 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 rounded-lg hover:bg-yellow-500/30 touch-manipulation min-h-[44px] text-sm font-medium"
                title="Reset Password"
              >
                <Key className="h-4 w-4 inline mr-1" />
                Reset
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(employee.id); }}
                className="flex-1 py-2 bg-red-500/20 text-red-300 border border-red-400/30 rounded-lg hover:bg-red-500/30 touch-manipulation min-h-[44px] text-sm font-medium"
                title="Elimina"
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Cards - Visibili quando viewMode === 'card' */}
      {viewMode === 'card' && (
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              onClick={() => handleViewDetails(employee)}
              className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
                    <span className="text-white font-bold text-sm">
                      {employee.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="ml-3">
                    <div className="text-white font-semibold leading-5">{employee.name}</div>
                  </div>
                </div>
                {employee.has104 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white border border-purple-400">104</span>
                )}
              </div>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="px-2 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600 text-xs">{employee.department}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleEditEmployee(employee); }}
                  className="flex-1 py-2 bg-zinc-800 text-white border border-zinc-700 rounded-lg hover:bg-zinc-700 flex items-center justify-center"
                  title="Modifica"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleViewDetails(employee); }}
                  className="flex-1 py-2 bg-green-500/20 text-green-300 border border-green-400/30 rounded-lg hover:bg-green-500/30 flex items-center justify-center"
                  title="Dettagli"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleResetPassword(employee); }}
                  className="flex-1 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 rounded-lg hover:bg-yellow-500/30 flex items-center justify-center"
                  title="Reset Password"
                >
                  <Key className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(employee.id); }}
                  className="flex-1 py-2 bg-red-500/20 text-red-300 border border-red-400/30 rounded-lg hover:bg-red-500/30 flex items-center justify-center"
                  title="Elimina"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop Table - Visibile quando viewMode === 'list' */}
      {viewMode === 'list' && (
        <div className="bg-zinc-900 rounded-lg overflow-hidden hidden md:block border border-zinc-800">
          <div className="overflow-x-auto hover:overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider w-1/3">
                    Nome
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider w-1/4">
                    Dipartimento
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-zinc-800/50 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.01]"
                    onClick={() => handleViewDetails(employee)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-zinc-800 rounded-full flex items-center justify-center flex-shrink-0 border border-zinc-700">
                          <span className="text-white font-bold text-sm">
                            {employee.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="ml-4 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-medium text-white">
                              {employee.name}
                            </div>
                            {employee.has104 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-600 text-white border border-purple-400 flex-shrink-0">
                                104
                              </span>
                            )}
                            {employee.role === 'supervisor' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 flex-shrink-0">
                                SUPERVISORE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-all hover:scale-105 ${employee.department === 'Amministrazione'
                        ? 'bg-zinc-800 text-slate-300 border border-zinc-700'
                        : employee.department === 'Segreteria'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                          : employee.department === 'Orientamento'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                            : employee.department === 'Reparto IT'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                              : 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
                        }`}>
                        {employee.department}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEmployee(employee);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 text-white border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-all duration-200 hover:scale-105"
                          title="Modifica"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="text-xs font-medium">Modifica</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(employee);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 text-green-300 border border-green-400/30 rounded-lg hover:bg-green-500/30 hover:border-green-400/50 transition-all duration-200 hover:scale-105"
                          title="Visualizza dettagli"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="text-xs font-medium">Dettagli</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetPassword(employee);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 rounded-lg hover:bg-yellow-500/30 hover:border-yellow-400/50 transition-all duration-200 hover:scale-105"
                          title="Reset Password"
                        >
                          <Key className="h-4 w-4" />
                          <span className="text-xs font-medium">Reset</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEmployee(employee.id);
                          }}
                          className="flex items-center space-x-2 px-3 py-2 bg-red-500/20 text-red-300 border border-red-400/30 rounded-lg hover:bg-red-500/30 hover:border-red-400/50 transition-all duration-200 hover:scale-105"
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="text-xs font-medium">Elimina</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Aggiungi Dipendente */}
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddEmployee={handleAddEmployee}
        onError={(message) => showAlert('error', 'Errore', message)}
        loading={false}
      />

      {/* Modal Modifica Dipendente */}
      {showEditModal && selectedEmployee && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md mx-4 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Modifica Dipendente</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nome</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Cognome</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Telefono</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Data di Nascita</label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dipartimento</label>
                <div className="relative">
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full h-[42px] bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                    <option value="">Seleziona dipartimento</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="has104"
                  checked={formData.has104}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-zinc-600 bg-zinc-800 border-zinc-700 rounded focus:ring-zinc-600"
                />
                <label className="ml-2 text-sm text-slate-300">Beneficiario Legge 104</label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700"
              >
                Annulla
              </button>
              <button
                onClick={handleUpdateEmployee}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-lg transition-colors flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dettagli Dipendente */}
      {showDetailsModal && selectedEmployee && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowDetailsModal(false)}
        >
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center">
                Dettagli Dipendente - {selectedEmployee.name}
                {selectedEmployee.has104 && (
                  <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-600 text-white border border-purple-400">
                    Legge 104
                  </span>
                )}
              </h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setDetailActiveTab('details');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg mb-6 border border-zinc-700">
              <button
                onClick={() => setDetailActiveTab('details')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${detailActiveTab === 'details'
                  ? 'bg-zinc-900 text-white border border-zinc-700'
                  : 'text-slate-300 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <User className="h-4 w-4 inline mr-2" />
                Dettagli
              </button>
              <button
                onClick={() => setDetailActiveTab('balance')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${detailActiveTab === 'balance'
                  ? 'bg-zinc-900 text-white border border-zinc-700'
                  : 'text-slate-300 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <DollarSign className="h-4 w-4 inline mr-2" />
                Banca Ore
              </button>
              <button
                onClick={() => setDetailActiveTab('schedule')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${detailActiveTab === 'schedule'
                  ? 'bg-zinc-900 text-white border border-zinc-700'
                  : 'text-slate-300 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <Clock className="h-4 w-4 inline mr-2" />
                Orario di Lavoro
              </button>
            </div>

            {/* Tab Content */}
            {detailActiveTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informazioni Personali */}
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2 text-slate-400" />
                    Informazioni Personali
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-slate-400 text-sm">Nome Completo:</span>
                      <p className="text-white font-bold">{selectedEmployee.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Email:</span>
                      <p className="text-white font-bold">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Telefono:</span>
                      <p className="text-white font-bold">{selectedEmployee.phone}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Data di Nascita:</span>
                      <p className="text-white font-bold">
                        {selectedEmployee.birthDate ?
                          new Date(selectedEmployee.birthDate).toLocaleDateString('it-IT') :
                          'Non specificata'
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Legge 104:</span>
                      <p className="text-white font-bold">{selectedEmployee.has104 ? 'Sì' : 'No'}</p>
                    </div>
                  </div>
                </div>

                {/* Informazioni Lavorative */}
                <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Briefcase className="h-5 w-5 mr-2 text-green-400" />
                    Informazioni Lavorative
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-slate-400 text-sm">Dipartimento:</span>
                      <p className="text-white font-bold">{selectedEmployee.department}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Data Assunzione:</span>
                      <p className="text-white font-bold">{new Date(selectedEmployee.hireDate).toLocaleDateString('it-IT')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Ore Settimanali:</span>
                      <p className="text-white font-bold">
                        {selectedEmployee.weeklyHours ? `${selectedEmployee.weeklyHours}h` : 'Non specificate'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Presenze e Ferie */}
                <div className="bg-slate-700 rounded-lg p-4 md:col-span-2">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-amber-400" />
                    Presenze e Ferie
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                      <div className="text-slate-400 text-sm">Ferie Godute</div>
                      <div className="text-2xl font-bold text-white">
                        {selectedEmployee.usedVacationDays || 0}
                      </div>
                      <div className="text-slate-400 text-xs">giorni</div>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                      <div className="text-slate-400 text-sm">Ferie Rimanenti</div>
                      <div className="text-2xl font-bold text-white">
                        {(selectedEmployee.totalVacationDays || 0) - (selectedEmployee.usedVacationDays || 0)}
                      </div>
                      <div className="text-slate-400 text-xs">giorni</div>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                      <div className="text-slate-400 text-sm">Totale Ferie</div>
                      <div className="text-2xl font-bold text-white">
                        {selectedEmployee.totalVacationDays || 0}
                      </div>
                      <div className="text-slate-400 text-xs">giorni annui</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailActiveTab === 'balance' && (
              <div className="space-y-6">
                {/* Banca Ore Attuale */}
                <div className="bg-slate-700 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-slate-400" />
                    Banca Ore Attuale
                  </h4>
                  <div className="flex items-center justify-center py-8">
                    {(() => {
                      const formatted = formatHoursValue(currentBalance);
                      return (
                        <div className={`text-6xl font-bold ${currentBalance > 0
                          ? 'text-green-400'
                          : currentBalance < 0
                            ? 'text-red-400'
                            : 'text-slate-400'
                          }`}>
                          {formatted.sign}
                          {formatted.hours}
                          <span className="text-4xl">h</span>
                          {formatted.minutes}
                          <span className="text-3xl">m</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-center mt-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${currentBalance > 0
                      ? 'bg-green-500/20 text-green-300 border border-green-400/30'
                      : currentBalance < 0
                        ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                        : 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
                      }`}>
                      {currentBalance > 0 && <TrendingUp className="h-4 w-4 mr-1" />}
                      {currentBalance < 0 && <TrendingDown className="h-4 w-4 mr-1" />}
                      {currentBalance === 0 ? 'In pari' : currentBalance > 0 ? 'In credito' : 'In debito'}
                    </span>
                  </div>
                </div>

                {/* Ultime Fluttuazioni */}
                <div className="bg-slate-700 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-amber-400" />
                    Ultime Fluttuazioni
                  </h4>
                  {(() => {
                    const today = new Date().toISOString().split('T')[0];
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();

                    // Verifica se la giornata è conclusa (controlla orario di fine lavoro)
                    let isWorkDayCompleted = false;
                    if (selectedEmployee?.workSchedule) {
                      const dayOfWeek = now.getDay();
                      const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
                      const todaySchedule = selectedEmployee.workSchedule[dayKey];

                      if (todaySchedule && todaySchedule.active) {
                        // Usa endTime o end_time con fallback a '18:00'
                        const endTime = todaySchedule.endTime || todaySchedule.end_time || '18:00';
                        if (endTime) {
                          const [endHour, endMin] = endTime.split(':').map(Number);
                          // La giornata è conclusa se l'ora attuale è dopo l'orario di fine
                          isWorkDayCompleted = currentHour > endHour || (currentHour === endHour && currentMinute >= endMin);
                        }
                      }
                    }

                    // Filtra: mostra giornate con balance != 0
                    // Include oggi solo se la giornata è conclusa O c'è un permesso approvato (balance già definitivo)
                    const completedRecords = balanceHistory.filter(record => {
                      const balance = record.balance_hours || 0;
                      const isToday = record.date === today;

                      // Se non è oggi, mostra solo se balance != 0
                      if (!isToday) {
                        return balance !== 0;
                      }

                      // Per oggi: escludi sempre a meno che:
                      // 1. La giornata sia conclusa (orario di fine passato)
                      // 2. OPPURE ci sia un permesso approvato (balance già definitivo)
                      if (isToday) {
                        // Controlla se ci sono note che indicano un permesso approvato
                        const hasPermission = record.notes && (
                          record.notes.includes('Permesso approvato') ||
                          record.notes.includes('Permesso creato dall\'admin') ||
                          record.notes.includes('Permesso 104') ||
                          record.notes.includes('permission_104')
                        );

                        // Include solo se (giornata conclusa O permesso approvato) E balance != 0
                        return balance !== 0 && (isWorkDayCompleted || hasPermission);
                      }

                      return false;
                    });
                    return completedRecords.length > 0 ? (
                      <div className="space-y-3">
                        {completedRecords.map((record, index) => {
                          // Estrai informazioni dalle note per audit trail
                          const notes = record.notes || '';
                          const hasManualCredit = notes.includes('Aggiunta manuale ore') || notes.includes('Ricarica banca ore');
                          const hasPermissionReduction = notes.includes('Riduzione permesso');

                          // Estrai dettagli dalle note se presenti
                          let manualCreditInfo = null;
                          let permissionReductionInfo = null;

                          if (hasManualCredit) {
                            const creditMatch = notes.match(/Aggiunta manuale ore: \+([\d.]+)h/);
                            if (creditMatch) {
                              manualCreditInfo = parseFloat(creditMatch[1]);
                            }
                          }

                          if (hasPermissionReduction) {
                            const permMatch = notes.match(/Riduzione permesso: ([\d.]+)h → ([\d.]+)h \(([\d.]+)h recuperate\)/);
                            if (permMatch) {
                              permissionReductionInfo = {
                                old: parseFloat(permMatch[1]),
                                new: parseFloat(permMatch[2]),
                                recovered: parseFloat(permMatch[3])
                              };
                            }
                          }

                          return (
                            <div key={index} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 text-slate-400 mr-3" />
                                  <div>
                                    <p className="text-white font-medium">
                                      {new Date(record.date).toLocaleDateString('it-IT', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                      })}
                                    </p>
                                    <p className="text-slate-400 text-sm">
                                      {(() => {
                                        const expectedFormatted = formatHoursValue(record.expected_hours || 0);
                                        return `Ore attese: ${expectedFormatted.hours}h ${expectedFormatted.minutes}m`;
                                      })()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {(() => {
                                    const balanceFormatted = formatHoursValue(record.balance_hours || 0);
                                    const actualFormatted = formatHoursValue(record.actual_hours || 0);
                                    return (
                                      <>
                                        <p className={`text-lg font-bold ${record.balance_hours > 0
                                          ? 'text-green-400'
                                          : record.balance_hours < 0
                                            ? 'text-red-400'
                                            : 'text-slate-400'
                                          }`}>
                                          {balanceFormatted.full}
                                        </p>
                                        <p className="text-slate-400 text-xs mt-1">
                                          Effettive: {actualFormatted.full}
                                        </p>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Mostra audit trail per aggiunte manuali */}
                              {hasManualCredit && (
                                <div className="mt-3 pt-3 border-t border-slate-500">
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1">
                                      {hasPermissionReduction && permissionReductionInfo ? (
                                        <>
                                          <p className="text-xs text-amber-300 font-semibold mb-1">
                                            💰 Aggiunta manuale: +{manualCreditInfo?.toFixed(2) || '0'}h
                                          </p>
                                          <p className="text-xs text-slate-400">
                                            🔐 Permesso ridotto: {permissionReductionInfo.old.toFixed(2)}h → {permissionReductionInfo.new.toFixed(2)}h
                                            <span className="text-green-300"> ({permissionReductionInfo.recovered.toFixed(2)}h recuperate)</span>
                                          </p>
                                        </>
                                      ) : (
                                        <p className="text-xs text-amber-300">
                                          💰 Ricarica banca ore: +{manualCreditInfo?.toFixed(2) || '0'}h
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Nessuna fluttuazione registrata</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {detailActiveTab === 'schedule' && (
              selectedEmployee.workSchedule ? (
                <div className="space-y-6">
                  {/* Orario Settimanale */}
                  <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-slate-400" />
                      Orario Settimanale
                    </h4>

                    {/* Giorni Lavorativi */}
                    <div className="mb-6">
                      <h5 className="text-md font-medium text-white mb-3 flex items-center">
                        <CheckSquare className="h-4 w-4 mr-2 text-green-400" />
                        Giorni Lavorativi
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dayOrder.map((dayKey) => {
                          const daySchedule = selectedEmployee.workSchedule[dayKey];
                          if (!daySchedule || !daySchedule.active) return null;

                          return (
                            <div key={dayKey} className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-medium text-white text-sm">{dayNames[dayKey]}</h6>
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              </div>

                              <div className="space-y-1">
                                {(() => {
                                  // Usa gli orari dinamici dal workSchedule
                                  const startTime = daySchedule.startTime || daySchedule.start_time || '09:00';
                                  const endTime = daySchedule.endTime || daySchedule.end_time || '18:00';
                                  const breakDuration = (daySchedule.breakDuration !== null && daySchedule.breakDuration !== undefined ? daySchedule.breakDuration : (daySchedule.break_duration !== null && daySchedule.break_duration !== undefined ? daySchedule.break_duration : 60));
                                  const totalHours = daySchedule.totalHours || 0;

                                  // Calcola orario pausa (default 13:00-14:00, ma potrebbe essere diverso)
                                  const breakStart = daySchedule.breakStartTime || daySchedule.break_start_time || '13:00';
                                  // Calcola correttamente la fine della pausa aggiungendo i minuti
                                  const calculateBreakEnd = (start, durationMinutes) => {
                                    if (!start || !durationMinutes) return '14:00';
                                    const [hours, minutes] = start.split(':').map(Number);
                                    const totalMinutes = hours * 60 + minutes + durationMinutes;
                                    const endHours = Math.floor(totalMinutes / 60);
                                    const endMins = totalMinutes % 60;
                                    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
                                  };
                                  const breakEnd = calculateBreakEnd(breakStart, breakDuration);

                                  // Formatta orari rimuovendo i secondi se presenti
                                  const formatTime = (timeStr) => {
                                    if (!timeStr) return '';
                                    return timeStr.substring(0, 5); // Prende solo HH:MM
                                  };

                                  if (daySchedule.workType === 'full_day' || daySchedule.work_type === 'full_day') {
                                    // Calcola fine mattina (inizio pausa) e inizio pomeriggio (fine pausa)
                                    const morningEnd = formatTime(breakStart);
                                    const afternoonStart = formatTime(breakEnd);

                                    // Determina se mostrare la mattina
                                    const showMorning = startTime < morningEnd;
                                    // Determina se mostrare il pomeriggio (solo se l'inizio pomeriggio è prima della fine turno)
                                    const showAfternoon = afternoonStart < endTime;

                                    return (
                                      <>
                                        {showMorning && (
                                          <div className="text-xs text-slate-300">{formatTime(startTime)} - {morningEnd} (Mattina)</div>
                                        )}
                                        {breakDuration > 0 && showMorning && showAfternoon && (
                                          <div className="text-xs text-slate-400">{morningEnd} - {afternoonStart} (Pausa)</div>
                                        )}
                                        {showAfternoon && (
                                          <div className="text-xs text-slate-300">{afternoonStart} - {formatTime(endTime)} (Pomeriggio)</div>
                                        )}
                                        {!showMorning && !showAfternoon && (
                                          <div className="text-xs text-slate-300">{formatTime(startTime)} - {formatTime(endTime)}</div>
                                        )}
                                        <div className="text-xs font-semibold text-green-400 mt-1">
                                          Totale: {totalHours > 0 ? formatHours(totalHours) : formatHours(7)}
                                        </div>
                                      </>
                                    );
                                  } else if (daySchedule.workType === 'morning' || daySchedule.work_type === 'morning' || daySchedule.workType === 'solo_mattina' || daySchedule.work_type === 'solo_mattina') {
                                    return (
                                      <>
                                        <div className="text-xs text-slate-300">{formatTime(startTime)} - {formatTime(endTime)} (Mattina)</div>
                                        <div className="text-xs font-semibold text-green-400 mt-1">
                                          Totale: {totalHours > 0 ? formatHours(totalHours) : formatHours(4)}
                                        </div>
                                      </>
                                    );
                                  } else if (daySchedule.workType === 'afternoon' || daySchedule.work_type === 'afternoon') {
                                    return (
                                      <>
                                        <div className="text-xs text-slate-300">{formatTime(startTime)} - {formatTime(endTime)} (Pomeriggio)</div>
                                        <div className="text-xs font-semibold text-green-400 mt-1">
                                          Totale: {totalHours > 0 ? formatHours(totalHours) : formatHours(4)}
                                        </div>
                                      </>
                                    );
                                  } else {
                                    return (
                                      <>
                                        <div className="text-xs text-slate-300">
                                          {formatTime(startTime)} - {formatTime(endTime)}
                                          {breakDuration > 0 && ` (pausa: ${breakDuration}min)`}
                                        </div>
                                        <div className="text-xs font-semibold text-green-400 mt-1">
                                          Totale: {totalHours > 0 ? formatHours(totalHours) : formatHours(daySchedule.hours || 8)}
                                        </div>
                                      </>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Giorni Non Lavorativi */}
                    <div>
                      <h5 className="text-md font-medium text-white mb-3 flex items-center">
                        <X className="h-4 w-4 mr-2 text-slate-400" />
                        Giorni Non Lavorativi
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dayOrder.map((dayKey) => {
                          const daySchedule = selectedEmployee.workSchedule[dayKey];
                          if (!daySchedule || daySchedule.active) return null;

                          return (
                            <div key={dayKey} className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-medium text-slate-400 text-sm">{dayNames[dayKey]}</h6>
                                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                              </div>
                              <div className="text-xs text-slate-500">Non lavorativo</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-700 rounded-lg p-6">
                  <div className="text-center">
                    <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-white mb-2">Orario Non Configurato</h4>
                    <p className="text-slate-400">
                      {selectedEmployee.name} non ha ancora configurato il suo orario di lavoro.
                    </p>
                    <p className="text-slate-500 text-sm mt-2">
                      Il dipendente può configurare l'orario nella sezione Profilo.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Custom Alert */}
      <CustomAlert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, employeeId: null, employeeName: '' })}
        onConfirm={confirmDeleteEmployee}
        title="Conferma Eliminazione"
        message={`Sei sicuro di voler eliminare ${confirmModal.employeeName}?

Questa azione eliminerà:
• Tutti i record di presenza
• Tutte le richieste di permesso
• Tutti i dati associati

L'azione è IRREVERSIBILE!`}
        confirmText="Elimina"
        cancelText="Annulla"
      />
    </div>
  );
};

export default Employees;