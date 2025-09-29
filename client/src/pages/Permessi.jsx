import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
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
    type: 'uscita_anticipata', // USCITA ANTICIPATA o ENTRATA_POSTICIPATA
    permissionDate: '',
    exitTime: '', // Orario di uscita per uscita anticipata
    entryTime: '', // Orario di entrata per entrata posticipata
    notes: ''
  });

  // Filtri temporali per admin
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Campo di ricerca
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stato per collassabile filtri
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Array vuoto per le richieste di permessi
  const [requests, setRequests] = useState([]);
  const [permissions104, setPermissions104] = useState({
    usedThisMonth: 0,
    maxPerMonth: 3,
    remaining: 3
  });

  // Hook per gestire chiusura modal con ESC e click fuori
  useModal(showNewRequest, () => setShowNewRequest(false));

  // Carica permessi 104 se l'utente li ha
  useEffect(() => {
    if (user?.has104) {
      fetchPermissions104();
    }
  }, [user?.has104]);

  const fetchPermissions104 = async () => {
    try {
      const response = await apiCall('/api/104-permissions/count');
      if (response.ok) {
        const data = await response.json();
        setPermissions104(data);
      }
    } catch (error) {
      console.error('Error fetching 104 permissions:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calcola automaticamente le ore di permesso
  const calculatePermissionHours = () => {
    if (formData.type === 'uscita_anticipata' && formData.exitTime) {
      // Orario normale: 9-18, se esce prima calcola la differenza
      const normalExitTime = 18; // 18:00
      const exitTime = parseFloat(formData.exitTime.replace(':', '.'));
      const hoursDiff = normalExitTime - exitTime;
      return Math.max(0, hoursDiff);
    } else if (formData.type === 'entrata_posticipata' && formData.entryTime) {
      // Orario normale: 9-18, se entra dopo calcola la differenza
      const normalEntryTime = 9; // 9:00
      const entryTime = parseFloat(formData.entryTime.replace(':', '.'));
      const hoursDiff = entryTime - normalEntryTime;
      return Math.max(0, hoursDiff);
    }
    return 0;
  };

  // Formatta le ore in modo leggibile (1h 42m invece di 1.7h)
  const formatHoursReadable = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Calcola automaticamente le ore di permesso
    const calculatedHours = calculatePermissionHours();
    
    if (calculatedHours <= 0) {
      alert('Inserisci un orario valido per calcolare le ore di permesso');
      return;
    }
    
    const newRequest = {
      type: formData.type,
      permissionDate: formData.permissionDate,
      permissionType: formData.type === 'uscita_anticipata' ? 'uscita_prima' : 'entrata_dopo',
      hours: calculatedHours,
      notes: formData.notes,
      id: Date.now(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
      submittedBy: user?.firstName + ' ' + user?.lastName
    };
    
    setRequests(prev => [newRequest, ...prev]);
    setFormData({
      type: 'uscita_anticipata',
      permissionDate: '',
      exitTime: '',
      entryTime: '',
      notes: ''
    });
    setShowNewRequest(false);
  };

  const handleCancel = () => {
    setFormData({
      type: 'uscita_anticipata',
      permissionDate: '',
      exitTime: '',
      entryTime: '',
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
        const requestDate = new Date(request.permissionDate || request.startDate);
        return requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear;
      });
    }
    
    // Filtro per ricerca
    if (searchTerm.trim()) {
      filtered = filtered.filter(request => {
        const searchLower = searchTerm.toLowerCase();
        return (
          request.notes?.toLowerCase().includes(searchLower) ||
          request.submittedBy?.toLowerCase().includes(searchLower) ||
          request.status?.toLowerCase().includes(searchLower) ||
          request.permissionType?.toLowerCase().includes(searchLower)
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

  // Ottieni il tipo di richiesta dettagliato per i permessi
  const getPermissionTypeText = (request) => {
    if (request.type === 'permission' || request.type === 'permission_104') {
      if (request.permissionType === 'uscita_prima') {
        return 'Uscita Anticipata';
      } else if (request.permissionType === 'entrata_dopo') {
        return 'Entrata Posticipata';
      }
    }
    return getTypeText(request.type);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Data non disponibile';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Data non valida';
      return date.toLocaleDateString('it-IT');
    } catch (error) {
      return 'Data non valida';
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  // Formatta ore con orario (es. "45 min | 10:45")
  const formatHoursWithTime = (hours, time) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    const timeStr = time ? ` | ${time}` : '';
    
    if (h > 0) {
      return `${h}h ${m}m${timeStr}`;
    } else {
      return `${m} min${timeStr}`;
    }
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
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowNewRequest(false)}
        >
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
                  <option value="uscita_anticipata">Uscita Anticipata</option>
                  <option value="entrata_posticipata">Entrata Posticipata</option>
                  {user?.has104 && (
                    <option value="permission_104">Permesso 104</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Permesso *
                </label>
                <input
                  type="date"
                  name="permissionDate"
                  value={formData.permissionDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {formData.type === 'uscita_anticipata' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Orario di Uscita *
                  </label>
                  <input
                    type="time"
                    name="exitTime"
                    value={formData.exitTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    Orario normale di uscita: 18:00. Le ore di permesso verranno calcolate automaticamente.
                  </p>
                </div>
              )}

              {formData.type === 'entrata_posticipata' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Orario di Entrata *
                  </label>
                  <input
                    type="time"
                    name="entryTime"
                    value={formData.entryTime}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    Orario normale di entrata: 09:00. Le ore di permesso verranno calcolate automaticamente.
                  </p>
                </div>
              )}

              {/* Mostra ore calcolate automaticamente */}
              {calculatePermissionHours() > 0 && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-indigo-400 mr-2" />
                    <span className="text-indigo-300 font-medium">
                      Ore di permesso calcolate: {formatHoursReadable(calculatePermissionHours())}
                    </span>
                  </div>
                </div>
              )}

              {/* Avviso permessi 104 */}
              {formData.type === 'permission_104' && user?.has104 && (
                <div className={`p-4 rounded-lg border ${
                  permissions104.remaining > 0 
                    ? 'bg-amber-500/10 border-amber-500/20' 
                    : 'bg-red-500/10 border-red-500/20'
                }`}>
                  <div className="flex items-center">
                    <CheckCircle className={`h-5 w-5 mr-2 ${
                      permissions104.remaining > 0 ? 'text-amber-400' : 'text-red-400'
                    }`} />
                    <div>
                      <p className={`text-sm font-medium ${
                        permissions104.remaining > 0 ? 'text-amber-200' : 'text-red-200'
                      }`}>
                        {permissions104.remaining > 0 
                          ? `Permessi 104: ${permissions104.usedThisMonth}/${permissions104.maxPerMonth} usati questo mese`
                          : 'Hai raggiunto il limite massimo di 3 permessi 104 al mese'
                        }
                      </p>
                      {permissions104.remaining > 0 && (
                        <p className="text-amber-300 text-xs mt-1">
                          Ti rimangono {permissions104.remaining} permessi 104 per questo mese
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
                      <h3 className="text-lg font-semibold text-white ml-2">{request.reason || getPermissionTypeText(request)}</h3>
                      <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                      <span className="ml-2 px-2 py-1 bg-slate-600 rounded text-xs text-slate-300">
                        {getPermissionTypeText(request)}
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
                        <span>
                          {request.hours ? 
                            formatHoursWithTime(request.hours, request.permissionDate ? new Date(request.permissionDate).toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'}) : null) :
                            `${calculateDays(request.startDate, request.endDate)} giorni`
                          }
                        </span>
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