import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import AddEmployeeModal from '../components/AddEmployeeModal';
import { Users, Plus, Edit, Trash2, Search, Filter, X, Save, User, Mail, Phone, Calendar, Briefcase, CheckSquare, Eye, Clock, Sun, Moon, Coffee } from 'lucide-react';

const Employees = () => {
  const { user, apiCall } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    department: '',
    position: '',
    has104: false
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

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
      case 'afternoon': return <Moon className="h-4 w-4 text-blue-400" />;
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
        
        alert(`Dipendente ${employeeData.firstName} ${employeeData.lastName} aggiunto con successo!`);
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error}`);
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      alert('Errore durante l\'aggiunta del dipendente');
    }
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      birthDate: employee.birthDate,
      department: employee.department,
      position: employee.position,
      has104: employee.has104
    });
    setShowEditModal(true);
  };

  const handleUpdateEmployee = () => {
    // TODO: Sostituire con chiamata API PUT /api/employees/:id
    // const response = await fetch(`/api/employees/${selectedEmployee.id}`, {
    //   method: 'PUT',
    //   headers: { 
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${token}` 
    //   },
    //   body: JSON.stringify(formData)
    // });
    
    setEmployees(prev => prev.map(emp => 
      emp.id === selectedEmployee.id 
        ? {
            ...emp,
            firstName: formData.firstName,
            lastName: formData.lastName,
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            phone: formData.phone,
            birthDate: formData.birthDate,
            department: formData.department,
            position: formData.position,
            has104: formData.has104
          }
        : emp
    ));
    setShowEditModal(false);
    setSelectedEmployee(null);
    resetForm();
  };

  const handleDeleteEmployee = async (employeeId) => {
    const employee = employees.find(emp => emp.id === employeeId);
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'questo dipendente';
    
    if (window.confirm(`Sei sicuro di voler eliminare ${employeeName}?\n\nQuesta azione eliminerà:\n• Tutti i record di presenza\n• Tutte le richieste di permesso\n• Tutti i dati associati\n\nL'azione è IRREVERSIBILE!`)) {
      try {
        const response = await apiCall(`/api/employees/${employeeId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const data = await response.json();
          alert(data.message || 'Dipendente eliminato con successo!');
          setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
        } else {
          const error = await response.json();
          alert(error.error || 'Errore durante l\'eliminazione del dipendente');
        }
      } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Errore di connessione durante l\'eliminazione');
      }
    }
  };

  const handleViewDetails = (employee) => {
    console.log('Opening details for:', employee);
    setSelectedEmployee(employee);
    setShowDetailsModal(true);
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      birthDate: '',
      department: '',
      position: '',
      has104: false
    });
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96 text-white text-2xl font-bold">
        Accesso negato. Solo gli amministratori possono visualizzare questa pagina.
      </div>
    );
  }

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Users className="h-8 w-8 mr-3 text-indigo-400" />
              Gestione Dipendenti
            </h1>
            <p className="text-slate-400 mt-2">
              Gestisci i dipendenti e le loro informazioni
            </p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Aggiungi Dipendente
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca dipendenti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filtri
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Dipartimento
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Posizione
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-indigo-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {employee.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-white cursor-pointer hover:text-indigo-400" onClick={() => handleViewDetails(employee)}>
                          {employee.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">{employee.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-all hover:scale-105 ${
                      employee.department === 'Amministrazione' 
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' 
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {employee.position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-all hover:scale-105 ${
                      employee.status === 'active' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                        : 'bg-red-500/20 text-red-300 border border-red-400/30'
                    }`}>
                      {employee.status === 'active' ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditEmployee(employee)}
                        className="text-indigo-400 hover:text-indigo-300"
                        title="Modifica"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleViewDetails(employee)}
                        className="text-green-400 hover:text-green-300"
                        title="Visualizza dettagli"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteEmployee(employee.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Aggiungi Dipendente */}
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddEmployee={handleAddEmployee}
        loading={false}
      />

      {/* Modal Modifica Dipendente */}
      {showEditModal && selectedEmployee && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
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
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Cognome</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleziona dipartimento</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Posizione</label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="has104"
                  checked={formData.has104}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm text-slate-300">Beneficiario Legge 104</label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleUpdateEmployee}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center"
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
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Dettagli Dipendente - {selectedEmployee.name}</h3>
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
            <div className="flex space-x-1 bg-slate-700 p-1 rounded-lg mb-6">
              <button
                onClick={() => setDetailActiveTab('details')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  detailActiveTab === 'details'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-600'
                }`}
              >
                <User className="h-4 w-4 inline mr-2" />
                Dettagli
              </button>
              <button
                onClick={() => setDetailActiveTab('schedule')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  detailActiveTab === 'schedule'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-600'
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
                <div className="bg-slate-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2 text-indigo-400" />
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
                      <p className="text-white font-bold">{new Date(selectedEmployee.birthDate).toLocaleDateString('it-IT')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Legge 104:</span>
                      <p className="text-white font-bold">{selectedEmployee.has104 ? 'Sì' : 'No'}</p>
                    </div>
                  </div>
                </div>

                {/* Informazioni Lavorative */}
                <div className="bg-slate-700 rounded-lg p-4">
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
                      <span className="text-slate-400 text-sm">Posizione:</span>
                      <p className="text-white font-bold">{selectedEmployee.position}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Data Assunzione:</span>
                      <p className="text-white font-bold">{new Date(selectedEmployee.hireDate).toLocaleDateString('it-IT')}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Ore Settimanali:</span>
                      <p className="text-white font-bold">{selectedEmployee.weeklyHours}h</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-sm">Stato:</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ml-2 ${
                        selectedEmployee.status === 'active' 
                          ? 'bg-green-600 text-white' 
                          : 'bg-red-600 text-white'
                      }`}>
                        {selectedEmployee.status === 'active' ? 'Attivo' : 'Inattivo'}
                      </span>
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
                    <div className="bg-slate-600 rounded-lg p-3">
                      <div className="text-slate-400 text-sm">Ferie Godute</div>
                      <div className="text-2xl font-bold text-white">{selectedEmployee.usedVacationDays}</div>
                      <div className="text-slate-400 text-xs">giorni</div>
                    </div>
                    <div className="bg-slate-600 rounded-lg p-3">
                      <div className="text-slate-400 text-sm">Ferie Rimanenti</div>
                      <div className="text-2xl font-bold text-white">{selectedEmployee.totalVacationDays - selectedEmployee.usedVacationDays}</div>
                      <div className="text-slate-400 text-xs">giorni</div>
                    </div>
                    <div className="bg-slate-600 rounded-lg p-3">
                      <div className="text-slate-400 text-sm">Totale Ferie</div>
                      <div className="text-2xl font-bold text-white">{selectedEmployee.totalVacationDays}</div>
                      <div className="text-slate-400 text-xs">giorni annui</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailActiveTab === 'schedule' && (
              selectedEmployee.workSchedule ? (
              <div className="space-y-6">
                <div className="bg-slate-700 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-blue-400" />
                    Orario di Lavoro Settimanale
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dayOrder.map((dayKey) => {
                      const daySchedule = selectedEmployee.workSchedule[dayKey];
                      if (!daySchedule) return null;
                      
                      return (
                        <div key={dayKey} className="bg-slate-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-white">{dayNames[dayKey]}</h5>
                            <div className={`w-4 h-4 rounded-full ${
                              daySchedule.active ? 'bg-green-500' : 'bg-slate-500'
                            }`}></div>
                          </div>
                          
                          {daySchedule.active ? (
                            <div className="space-y-2">
                              {daySchedule.workType === 'full_day' ? (
                                <>
                                  <div className="space-y-1">
                                    <div className="flex items-center text-xs">
                                      <Sun className="h-3 w-3 text-yellow-400 mr-1" />
                                      <span className="text-slate-400">Mattina: 09:00 - 13:00</span>
                                    </div>
                                    <div className="flex items-center text-xs">
                                      <Coffee className="h-3 w-3 text-amber-400 mr-1" />
                                      <span className="text-slate-400">Pausa: 13:00 - 14:00</span>
                                    </div>
                                    <div className="flex items-center text-xs">
                                      <Moon className="h-3 w-3 text-blue-400 mr-1" />
                                      <span className="text-slate-400">Pomeriggio: 14:00 - 18:00</span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-2 font-medium">
                                    Totale: 8.0h
                                  </div>
                                </>
                              ) : daySchedule.workType === 'morning' ? (
                                <>
                                  <div className="flex items-center text-xs">
                                    <Sun className="h-3 w-3 text-yellow-400 mr-1" />
                                    <span className="text-slate-400">Mattina: 09:00 - 13:00</span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-2 font-medium">
                                    Totale: 4.0h
                                  </div>
                                </>
                              ) : daySchedule.workType === 'afternoon' ? (
                                <>
                                  <div className="flex items-center text-xs">
                                    <Moon className="h-3 w-3 text-blue-400 mr-1" />
                                    <span className="text-slate-400">Pomeriggio: 14:00 - 18:00</span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-2 font-medium">
                                    Totale: 4.0h
                                  </div>
                                </>
                              ) : (
                                /* Fallback per dati vecchi */
                                <>
                                  <div className="flex items-center text-sm">
                                    <Clock className="h-3 w-3 text-blue-400 mr-2" />
                                    <span className="text-slate-300">{daySchedule.hours || 8}h</span>
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    Giornata lavorativa
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <p className="text-slate-400 text-sm">Non lavorativo</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Riepilogo ore settimanali */}
                  <div className="bg-slate-700 rounded-lg p-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="text-slate-400 text-sm">Ore Settimanali</div>
                        <div className="text-2xl font-bold text-white">
                          {selectedEmployee.workSchedule ? 
                            Object.values(selectedEmployee.workSchedule)
                              .reduce((total, day) => {
                                if (!day.active) return total;
                                if (day.workType === 'full_day') return total + 8;
                                if (day.workType === 'morning' || day.workType === 'afternoon') return total + 4;
                                return total + (day.totalHours || day.hours || 8);
                              }, 0).toFixed(1) : 
                            selectedEmployee.weeklyHours}h
                        </div>
                        <div className="text-slate-400 text-xs">Totale settimana</div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="text-slate-400 text-sm">Tipo Contratto</div>
                        <div className="text-lg font-semibold text-white">
                          {selectedEmployee.contractType === 'full_time' ? 'Tempo Pieno' : 
                           selectedEmployee.contractType === 'part_time' ? 'Part Time' : 
                           selectedEmployee.contractType === 'apprenticeship' ? 'Apprendistato' : 
                           selectedEmployee.contractType === 'cococo' ? 'Co.Co.Co' : 
                           selectedEmployee.contractType}
                        </div>
                        <div className="text-slate-400 text-xs">Contratto attivo</div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-3">
                        <div className="text-slate-400 text-sm">Giorni Lavorativi</div>
                        <div className="text-2xl font-bold text-white">
                          {Object.values(selectedEmployee.workSchedule).filter(day => day.active).length}
                        </div>
                        <div className="text-slate-400 text-xs">Giorni/settimana</div>
                      </div>
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
    </div>
  );
};

export default Employees;