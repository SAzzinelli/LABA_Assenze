import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { Users, Plus, Edit, Trash2, Search, Filter, X, Save, User, Mail, Phone, Calendar, Briefcase, CheckSquare, Eye } from 'lucide-react';

const Employees = () => {
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
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
  }, []);

  const fetchEmployees = async () => {
    try {
      // Simulazione dati per ora (poi collegheremo al database)
      const mockEmployees = [
        { 
          id: 1, 
          firstName: 'Marco', 
          lastName: 'Rossi', 
          name: 'Marco Rossi', 
          email: 'marco.rossi@labafirenze.com', 
          phone: '+39 333 123 4567',
          birthDate: '1985-03-15',
          department: 'Amministrazione', 
          position: 'Manager', 
          status: 'active',
          has104: false,
          hireDate: '2020-01-15',
          weeklyHours: 40,
          usedVacationDays: 15,
          totalVacationDays: 26
        },
        { 
          id: 2, 
          firstName: 'Anna', 
          lastName: 'Bianchi', 
          name: 'Anna Bianchi', 
          email: 'anna.bianchi@labafirenze.com', 
          phone: '+39 333 234 5678',
          birthDate: '1990-07-22',
          department: 'Segreteria', 
          position: 'Segretaria', 
          status: 'active',
          has104: false,
          hireDate: '2021-03-01',
          weeklyHours: 35,
          usedVacationDays: 8,
          totalVacationDays: 26
        },
        { 
          id: 3, 
          firstName: 'Luca', 
          lastName: 'Verdi', 
          name: 'Luca Verdi', 
          email: 'luca.verdi@labafirenze.com', 
          phone: '+39 333 345 6789',
          birthDate: '1988-11-10',
          department: 'Orientamento', 
          position: 'Consulente', 
          status: 'active',
          has104: true,
          hireDate: '2019-09-01',
          weeklyHours: 40,
          usedVacationDays: 20,
          totalVacationDays: 26
        },
        { 
          id: 4, 
          firstName: 'Sofia', 
          lastName: 'Neri', 
          name: 'Sofia Neri', 
          email: 'sofia.neri@labafirenze.com', 
          phone: '+39 333 456 7890',
          birthDate: '1992-05-08',
          department: 'Reparto IT', 
          position: 'Sviluppatore', 
          status: 'active',
          has104: false,
          hireDate: '2022-01-10',
          weeklyHours: 40,
          usedVacationDays: 5,
          totalVacationDays: 26
        },
      ];
      setEmployees(mockEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddEmployee = () => {
    const newEmployee = {
      id: Date.now(),
      firstName: formData.firstName,
      lastName: formData.lastName,
      name: `${formData.firstName} ${formData.lastName}`,
      email: formData.email,
      phone: formData.phone,
      birthDate: formData.birthDate,
      department: formData.department,
      position: formData.position,
      status: 'active',
      has104: formData.has104,
      hireDate: new Date().toISOString().split('T')[0],
      weeklyHours: 40,
      usedVacationDays: 0,
      totalVacationDays: 26
    };
    
    setEmployees(prev => [...prev, newEmployee]);
    setShowAddModal(false);
    resetForm();
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

  const handleDeleteEmployee = (employeeId) => {
    if (window.confirm('Sei sicuro di voler eliminare questo dipendente?')) {
      setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
    }
  };

  const handleViewDetails = (employee) => {
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
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {employee.department}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {employee.position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      employee.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
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
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Aggiungi Dipendente</h3>
              <button 
                onClick={() => setShowAddModal(false)}
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
                    placeholder="Nome"
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
                    placeholder="Cognome"
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
                  placeholder="email@labafirenze.com"
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
                  placeholder="+39 333 123 4567"
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
                  <option value="Amministrazione">Amministrazione</option>
                  <option value="Segreteria">Segreteria</option>
                  <option value="Orientamento">Orientamento</option>
                  <option value="Reparto IT">Reparto IT</option>
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
                  placeholder="Es. Manager, Sviluppatore, Segretaria"
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
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleAddEmployee}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modifica Dipendente */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  <option value="Amministrazione">Amministrazione</option>
                  <option value="Segreteria">Segreteria</option>
                  <option value="Orientamento">Orientamento</option>
                  <option value="Reparto IT">Reparto IT</option>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Dettagli Dipendente</h3>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
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
                    <p className="text-white">{selectedEmployee.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Email:</span>
                    <p className="text-white">{selectedEmployee.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Telefono:</span>
                    <p className="text-white">{selectedEmployee.phone}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Data di Nascita:</span>
                    <p className="text-white">{new Date(selectedEmployee.birthDate).toLocaleDateString('it-IT')}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Legge 104:</span>
                    <p className="text-white">{selectedEmployee.has104 ? 'Sì' : 'No'}</p>
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
                    <p className="text-white">{selectedEmployee.department}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Posizione:</span>
                    <p className="text-white">{selectedEmployee.position}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Data Assunzione:</span>
                    <p className="text-white">{new Date(selectedEmployee.hireDate).toLocaleDateString('it-IT')}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Ore Settimanali:</span>
                    <p className="text-white">{selectedEmployee.weeklyHours}h</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Stato:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedEmployee.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
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
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;