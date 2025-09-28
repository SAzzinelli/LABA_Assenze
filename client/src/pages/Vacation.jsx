import React, { useState } from 'react';
import { useAuthStore } from '../utils/store';
import { 
  Plane, 
  Plus, 
  Calendar, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Save,
  X,
  MapPin,
  Sun,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Search
} from 'lucide-react';

const Vacation = () => {
  const { user } = useAuthStore();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
    notes: ''
  });

  // Filtri temporali per admin
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Campo di ricerca
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stato per collassabile filtri
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Mock data per le richieste di ferie
  const [vacationRequests, setVacationRequests] = useState([
    {
      id: 1,
      startDate: '2025-12-23',
      endDate: '2025-12-31',
      reason: 'Vacanze Natalizie',
      status: 'approved',
      submittedAt: '2025-11-15T10:30:00Z',
      approvedAt: '2025-11-16T09:15:00Z',
      approvedBy: 'Admin',
      notes: 'Vacanze con la famiglia'
    },
    {
      id: 2,
      startDate: '2025-10-15',
      endDate: '2025-10-18',
      reason: 'Ponte del 1° Novembre',
      status: 'pending',
      submittedAt: '2025-09-20T14:20:00Z',
      notes: 'Weekend lungo'
    },
    {
      id: 3,
      startDate: '2025-08-05',
      endDate: '2025-08-20',
      reason: 'Vacanze Estive',
      status: 'approved',
      submittedAt: '2025-07-01T11:45:00Z',
      approvedAt: '2025-07-02T08:30:00Z',
      approvedBy: 'Admin',
      notes: 'Vacanze al mare con amici'
    }
  ]);

  // Calcolo dinamico del bilancio ferie
  const [vacationBalance, setVacationBalance] = useState({
    totalDays: 26, // Base legale italiana
    usedDays: 15,
    remainingDays: 11,
    pendingDays: 4,
    bonusDays: 0, // Bonus per anzianità
    rolDays: 0, // Giorni ROL da ore extra
    has104: user?.has104 || false // Bonus legge 104
  });

  // Calcolo dinamico basato su dati reali
  React.useEffect(() => {
    // Simulazione calcolo dinamico
    const baseDays = 26;
    let bonusDays = 0;
    
    // Bonus anzianità (esempio)
    if (user?.hireDate) {
      const hireYear = new Date(user.hireDate).getFullYear();
      const yearsWorked = new Date().getFullYear() - hireYear;
      if (yearsWorked >= 10) bonusDays += 2;
      if (yearsWorked >= 15) bonusDays += 2;
      if (yearsWorked >= 20) bonusDays += 2;
    }
    
    // Bonus legge 104
    if (user?.has104) {
      bonusDays += 3; // Giorni aggiuntivi per legge 104
    }
    
    setVacationBalance(prev => ({
      ...prev,
      totalDays: baseDays + bonusDays,
      bonusDays: bonusDays,
      has104: user?.has104 || false
    }));
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newRequest = {
      id: Date.now(),
      ...formData,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      submittedBy: user?.firstName + ' ' + user?.lastName
    };
    
    setVacationRequests(prev => [newRequest, ...prev]);
    setFormData({
      startDate: '',
      endDate: '',
      reason: '',
      destination: '',
      emergencyContact: '',
      notes: ''
    });
    setShowNewRequest(false);
  };

  const handleCancel = () => {
    setFormData({
      startDate: '',
      endDate: '',
      reason: '',
      destination: '',
      emergencyContact: '',
      notes: ''
    });
    setShowNewRequest(false);
  };

  // Funzioni per filtri temporali
  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Filtra le richieste per il mese/anno selezionato e ricerca
  const getFilteredRequests = () => {
    let filtered = vacationRequests;
    
    // Filtro per mese/anno (solo admin)
    if (user?.role === 'admin') {
      filtered = filtered.filter(request => {
        const requestDate = new Date(request.startDate);
        return requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear;
      });
    }
    
    // Filtro per ricerca
    if (searchTerm.trim()) {
      filtered = filtered.filter(request => {
        const searchLower = searchTerm.toLowerCase();
        return (
          request.reason?.toLowerCase().includes(searchLower) ||
          request.notes?.toLowerCase().includes(searchLower) ||
          request.status?.toLowerCase().includes(searchLower) ||
          request.submittedBy?.toLowerCase().includes(searchLower) ||
          request.destination?.toLowerCase().includes(searchLower)
        );
      });
    }
    
    return filtered;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved':
        return 'Approvata';
      case 'rejected':
        return 'Rifiutata';
      case 'pending':
        return 'In attesa';
      default:
        return 'Sconosciuto';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Plane className="h-8 w-8 mr-3 text-blue-400" />
              {user?.role === 'admin' ? 'Gestione Ferie' : 'Le Mie Ferie'}
            </h1>
            <p className="text-slate-400 mt-2">
              {user?.role === 'admin' 
                ? 'Visualizza e gestisci tutte le richieste di ferie dei dipendenti'
                : 'Gestisci le tue richieste di ferie e visualizza il bilancio ferie'
              }
            </p>
          </div>
          {user?.role !== 'admin' && (
            <button
              onClick={() => setShowNewRequest(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuova Richiesta
            </button>
          )}
        </div>
      </div>

      {/* Vacation Balance */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Totale Giorni</h3>
            <Calendar className="h-8 w-8 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-400">{vacationBalance.totalDays}</p>
          <p className="text-slate-400 text-sm">Giorni di ferie annuali</p>
          <div className="mt-2 text-xs text-slate-500">
            <p>Base: 26 giorni</p>
            {vacationBalance.bonusDays > 0 && (
              <p>Bonus: +{vacationBalance.bonusDays} giorni</p>
            )}
            {vacationBalance.has104 && (
              <p className="text-amber-400">+ Legge 104</p>
            )}
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Giorni Utilizzati</h3>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">{vacationBalance.usedDays}</p>
          <p className="text-slate-400 text-sm">Ferie già godute</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Giorni Rimanenti</h3>
            <Sun className="h-8 w-8 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-400">{vacationBalance.remainingDays}</p>
          <p className="text-slate-400 text-sm">Disponibili per richieste</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">In Attesa</h3>
            <AlertCircle className="h-8 w-8 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-400">{vacationBalance.pendingDays}</p>
          <p className="text-slate-400 text-sm">Richieste pendenti</p>
        </div>
      </div>

      {/* New Request Modal */}
      {showNewRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Plane className="h-6 w-6 mr-2 text-blue-400" />
                Nuova Richiesta Ferie
              </h2>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data Inizio Ferie *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data Fine Ferie *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formData.startDate && formData.endDate && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    <strong>Durata richiesta:</strong> {calculateDays(formData.startDate, formData.endDate)} giorni
                  </p>
                  <p className="text-blue-300 text-sm">
                    <strong>Giorni rimanenti dopo questa richiesta:</strong> {vacationBalance.remainingDays - calculateDays(formData.startDate, formData.endDate)} giorni
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Motivo delle Ferie *
                </label>
                <input
                  type="text"
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  placeholder="Es. Vacanze estive, famiglia, riposo..."
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Destinazione
                </label>
                <input
                  type="text"
                  name="destination"
                  value={formData.destination}
                  onChange={handleInputChange}
                  placeholder="Dove andrai in ferie?"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Contatto di Emergenza
                </label>
                <input
                  type="tel"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                  placeholder="Numero di telefono per emergenze"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Note Aggiuntive
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Note aggiuntive sulle ferie..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 mr-2 inline" />
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Save className="h-4 w-4 mr-2 inline" />
                  Invia Richiesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filtri Collassabili */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setFiltersCollapsed(!filtersCollapsed)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Filter className="h-5 w-5 text-blue-400" />
            <span className="text-white font-medium">Filtri e Ricerca</span>
          </div>
          {filtersCollapsed ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          )}
        </button>
        
        {!filtersCollapsed && (
          <div className="border-t border-slate-700 p-4 space-y-4">
            {/* Filtro temporale per admin */}
            {user?.role === 'admin' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Calendar className="h-5 w-5 text-blue-400" />
                  <span className="text-white font-medium">Filtro per periodo:</span>
                  <button
                    onClick={goToToday}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    OGGI
                  </button>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-white font-semibold min-w-[120px] text-center">
                    {monthNames[currentMonth]} {currentYear}
                  </div>
                  <button
                    onClick={goToNextMonth}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Campo di ricerca */}
            <div className="flex items-center space-x-4">
              <Search className="h-5 w-5 text-green-400" />
              <input
                type="text"
                placeholder="Cerca per motivo, destinazione, note o stato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Requests List */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <FileText className="h-6 w-6 mr-3 text-slate-400" />
          {user?.role === 'admin' ? 'Gestione Richieste Ferie' : 'Storico Richieste Ferie'}
        </h2>

        {(() => {
          const filteredRequests = getFilteredRequests();
          return filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Plane className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">
                {user?.role === 'admin' 
                  ? `Nessuna richiesta per ${monthNames[currentMonth]} ${currentYear}`
                  : 'Nessuna richiesta di ferie presente'
                }
              </p>
              <p className="text-slate-500 text-sm mt-2">
                {user?.role === 'admin' 
                  ? 'Prova a cambiare mese o aggiungere nuove richieste'
                  : 'Clicca su "Nuova Richiesta" per iniziare'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
              <div key={request.id} className="bg-slate-700 rounded-lg p-6 hover:bg-slate-600 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      {getStatusIcon(request.status)}
                      <h3 className="text-lg font-semibold text-white ml-2">{request.reason}</h3>
                      <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                        <span>Dal {formatDate(request.startDate)} al {formatDate(request.endDate)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-slate-400" />
                        <span>{calculateDays(request.startDate, request.endDate)} giorni</span>
                      </div>
                      {request.destination && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-slate-400" />
                          <span>Destinazione: {request.destination}</span>
                        </div>
                      )}
                      {request.emergencyContact && (
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2 text-slate-400" />
                          <span>Contatto: {request.emergencyContact}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-slate-400" />
                        <span>Richiesta: {formatDateTime(request.submittedAt)}</span>
                      </div>
                      {request.approvedAt && (
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 mr-2 text-slate-400" />
                          <span>Approvata: {formatDateTime(request.approvedAt)}</span>
                        </div>
                      )}
                    </div>
                    {request.notes && (
                      <div className="mt-3 p-3 bg-slate-600 rounded-lg">
                        <p className="text-slate-300 text-sm">
                          <strong>Note:</strong> {request.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Vacation;
