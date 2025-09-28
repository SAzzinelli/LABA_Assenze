import React, { useState } from 'react';
import { useAuthStore } from '../utils/store';
import { 
  FileText, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  Save,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  User,
  Search
} from 'lucide-react';

const LeaveRequests = () => {
  const { user } = useAuthStore();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [formData, setFormData] = useState({
    type: 'permission',
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

  // Mock data per le richieste di permessi (per admin: tutti i dipendenti, per employee: solo le proprie)
  const [requests, setRequests] = useState([
    {
      id: 1,
      type: 'permission',
      startDate: '2025-09-25',
      endDate: '2025-09-25',
      reason: 'Visita medica',
      status: 'approved',
      submittedAt: '2025-09-24T10:30:00Z',
      submittedBy: user?.firstName + ' ' + user?.lastName,
      employeeId: user?.id,
      approvedAt: '2025-09-24T14:20:00Z',
      approvedBy: 'Admin',
      notes: 'Controllo periodico'
    },
    {
      id: 2,
      type: 'permission',
      startDate: '2025-09-20',
      endDate: '2025-09-20',
      reason: 'Motivi familiari',
      status: 'pending',
      submittedAt: '2025-09-19T16:45:00Z',
      submittedBy: user?.firstName + ' ' + user?.lastName,
      employeeId: user?.id,
      notes: 'Appuntamento urgente'
    },
    {
      id: 3,
      type: 'permission',
      startDate: '2025-09-15',
      endDate: '2025-09-15',
      reason: 'Permesso ROL',
      status: 'approved',
      submittedAt: '2025-09-14T09:15:00Z',
      submittedBy: user?.firstName + ' ' + user?.lastName,
      employeeId: user?.id,
      approvedAt: '2025-09-14T11:30:00Z',
      approvedBy: 'Admin',
      notes: 'Permesso per recupero ore'
    },
    {
      id: 4,
      type: 'permission',
      startDate: '2025-09-10',
      endDate: '2025-09-11',
      reason: 'Formazione professionale',
      status: 'rejected',
      submittedAt: '2025-09-09T13:20:00Z',
      submittedBy: user?.firstName + ' ' + user?.lastName,
      employeeId: user?.id,
      rejectedAt: '2025-09-09T16:45:00Z',
      rejectedBy: 'Admin',
      notes: 'Corso di aggiornamento',
      rejectionReason: 'Conflitto con altri permessi già approvati'
    },
    // Richieste di altri dipendenti (solo per admin)
    ...(user?.role === 'admin' ? [
      {
        id: 5,
        type: 'permission',
        startDate: '2025-10-10',
        endDate: '2025-10-10',
        reason: 'Appuntamento dentista',
        status: 'pending',
        submittedAt: '2025-09-30T14:20:00Z',
        submittedBy: 'Marco Rossi',
        employeeId: 'emp001',
        notes: 'Controllo semestrale'
      },
      {
        id: 6,
        type: 'permission',
        startDate: '2025-10-12',
        endDate: '2025-10-12',
        reason: 'Motivi familiari',
        status: 'approved',
        submittedAt: '2025-09-28T11:30:00Z',
        submittedBy: 'Anna Bianchi',
        employeeId: 'emp002',
        approvedBy: 'Admin LABA',
        approvedAt: '2025-09-29T09:15:00Z',
        notes: 'Festa di compleanno figlio'
      },
      {
        id: 7,
        type: 'permission',
        startDate: '2025-10-15',
        endDate: '2025-10-15',
        reason: 'Visita specialistica',
        status: 'pending',
        submittedAt: '2025-10-01T08:45:00Z',
        submittedBy: 'Luca Verdi',
        employeeId: 'emp003',
        notes: 'Controllo cardiologico'
      },
      {
        id: 8,
        type: 'permission',
        startDate: '2025-11-05',
        endDate: '2025-11-05',
        reason: 'Formazione aziendale',
        status: 'approved',
        submittedAt: '2025-10-15T16:30:00Z',
        submittedBy: 'Sofia Neri',
        employeeId: 'emp004',
        approvedBy: 'Admin LABA',
        approvedAt: '2025-10-16T10:20:00Z',
        notes: 'Corso di sicurezza sul lavoro'
      }
    ] : [])
  ]);

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
    
    setRequests(prev => [newRequest, ...prev]);
    setFormData({
      type: 'permission',
      startDate: '',
      endDate: '',
      reason: '',
      notes: ''
    });
    setShowNewRequest(false);
  };

  const handleCancel = () => {
    setFormData({
      type: 'permission',
      startDate: '',
      endDate: '',
      reason: '',
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
    let filtered = requests;
    
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
          request.submittedBy?.toLowerCase().includes(searchLower) ||
          request.notes?.toLowerCase().includes(searchLower) ||
          request.status?.toLowerCase().includes(searchLower)
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

  const getTypeText = (type) => {
    switch (type) {
      case 'permission':
        return 'Permesso';
      case 'leave':
        return 'Congedo';
      case 'emergency':
        return 'Emergenza';
      default:
        return 'Permesso';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  const calculateDays = (startDate, endDate) => {
    if (startDate === endDate) return 1;
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
              <FileText className="h-8 w-8 mr-3 text-indigo-400" />
              {user?.role === 'admin' ? 'Gestione Permessi' : 'I Miei Permessi'}
            </h1>
            <p className="text-slate-400 mt-2">
              {user?.role === 'admin' 
                ? 'Visualizza e gestisci tutte le richieste di permessi dei dipendenti'
                : 'Gestisci le tue richieste di permessi e visualizza lo storico'
              }
            </p>
          </div>
          {user?.role !== 'admin' && (
            <button
              onClick={() => setShowNewRequest(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuova Richiesta
            </button>
          )}
        </div>
      </div>

      {/* Filtri Collassabili */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setFiltersCollapsed(!filtersCollapsed)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Filter className="h-5 w-5 text-indigo-400" />
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
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
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
                placeholder="Cerca per motivo, dipendente, note o stato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

      {/* New Request Modal */}
      {showNewRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <FileText className="h-6 w-6 mr-2 text-indigo-400" />
                Nuova Richiesta Permesso
              </h2>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tipo di Permesso *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="permission">Permesso</option>
                  <option value="leave">Congedo</option>
                  <option value="emergency">Emergenza</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data Inizio *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Data Fine *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {formData.startDate && formData.endDate && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                  <p className="text-indigo-300 text-sm">
                    <strong>Durata richiesta:</strong> {calculateDays(formData.startDate, formData.endDate)} giorni
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Motivo del Permesso *
                </label>
                <input
                  type="text"
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  placeholder="Es. Visita medica, motivi familiari, formazione..."
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  placeholder="Note aggiuntive sul permesso..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  <Save className="h-4 w-4 mr-2 inline" />
                  Invia Richiesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <Clock className="h-6 w-6 mr-3 text-slate-400" />
          Storico Richieste Permessi
        </h2>

        {(() => {
          const filteredRequests = getFilteredRequests();
          return filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">
                {user?.role === 'admin' 
                  ? `Nessuna richiesta per ${monthNames[currentMonth]} ${currentYear}`
                  : 'Nessuna richiesta di permesso presente'
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
                      {user?.role === 'admin' && (
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-slate-400" />
                          <span>Dipendente: {request.submittedBy}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                        <span>
                          {request.startDate === request.endDate 
                            ? formatDate(request.startDate)
                            : `Dal ${formatDate(request.startDate)} al ${formatDate(request.endDate)}`
                          }
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-slate-400" />
                        <span>{calculateDays(request.startDate, request.endDate)} giorni</span>
                      </div>
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-slate-400" />
                        <span>Tipo: {getTypeText(request.type)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-slate-400" />
                        <span>Richiesta: {formatDateTime(request.submittedAt)}</span>
                      </div>
                      {request.approvedAt && (
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 mr-2 text-slate-400" />
                          <span>Approvato da: {request.approvedBy} alle {formatDateTime(request.approvedAt)}</span>
                        </div>
                      )}
                      {request.rejectedAt && (
                        <div className="flex items-center">
                          <XCircle className="h-4 w-4 mr-2 text-slate-400" />
                          <span>Rifiutata: {formatDateTime(request.rejectedAt)}</span>
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
                    {request.rejectionReason && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-300 text-sm">
                          <strong>Motivo rifiuto:</strong> {request.rejectionReason}
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

export default LeaveRequests;