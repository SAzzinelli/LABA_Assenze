import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
import CustomAlert from '../components/CustomAlert';
import { 
  Accessibility, 
  Plus, 
  Calendar, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Info,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

const Permessi104 = () => {
  const { user, apiCall } = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [alert, setAlert] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [absence104Balance, setAbsence104Balance] = useState({
    has104: false,
    totalDays: 3,
    usedDays: 0,
    pendingDays: 0,
    remainingDays: 3
  });

  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    notes: ''
  });

  const [validationError, setValidationError] = useState('');

  useModal(showNewRequest, () => setShowNewRequest(false));

  useEffect(() => {
    if (user?.has_104 || user?.has104) {
      fetchRequests();
      fetchAbsence104Balance();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/leave-requests?type=permission_104');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching 104 requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAbsence104Balance = async () => {
    try {
      const response = await apiCall('/api/absence-104-balance');
      if (response.ok) {
        const data = await response.json();
        setAbsence104Balance(data);
      } else {
        // Se non ha la 104, imposta stato di default
        setAbsence104Balance({
          has104: false,
          totalDays: 0,
          usedDays: 0,
          pendingDays: 0,
          remainingDays: 0
        });
      }
    } catch (error) {
      console.error('Error fetching absence 104 balance:', error);
      setAbsence104Balance({
        has104: false,
        totalDays: 0,
        usedDays: 0,
        pendingDays: 0,
        remainingDays: 0
      });
    }
  };

  // Valida giorni richiesti quando cambiano le date
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      if (end < start) {
        setValidationError('La data di fine deve essere successiva alla data di inizio');
        return;
      }

      // Calcola giorni richiesti (anche mezza giornata conta come 1 giorno intero)
      const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const daysRequestedFor104 = Math.max(1, daysRequested); // Minimo 1 giorno

      if (daysRequestedFor104 > absence104Balance.remainingDays) {
        setValidationError(`Giorni insufficienti. Richiesti: ${daysRequestedFor104} giorni, Disponibili: ${absence104Balance.remainingDays} giorni`);
      } else {
        setValidationError('');
      }
    } else {
      setValidationError('');
    }
  }, [formData.startDate, formData.endDate, absence104Balance.remainingDays]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate) {
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        message: 'Seleziona data di inizio e fine'
      });
      return;
    }

    // Calcola giorni richiesti (anche mezza giornata conta come 1 giorno intero)
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const daysRequested = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);

    // Verifica limite mensile (giorni, non permessi)
    if (daysRequested > absence104Balance.remainingDays) {
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Limite Raggiunto',
        message: `Hai già utilizzato tutti i giorni disponibili per le assenze 104 questo mese. Giorni richiesti: ${daysRequested}, Disponibili: ${absence104Balance.remainingDays}`
      });
      return;
    }

    if (validationError) {
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore di Validazione',
        message: validationError
      });
      return;
    }

    try {
      const response = await apiCall('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'permission_104',
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: 'Assenza Legge 104 - Assistenza familiare',
          notes: formData.notes || 'Assenza Legge 104'
        })
      });

      if (response.ok) {
        setAlert({
          isOpen: true,
          type: 'success',
          title: 'Assenza 104 Registrata!',
          message: `L'assenza 104 per ${daysRequested} ${daysRequested === 1 ? 'giorno' : 'giorni'} è stata registrata con successo`
        });
        setShowNewRequest(false);
        setFormData({ startDate: '', endDate: '', notes: '' });
        setValidationError('');
        fetchRequests();
        fetchAbsence104Balance();
      } else {
        const error = await response.json();
        setAlert({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          message: error.error || 'Errore nella registrazione dell\'assenza 104'
        });
      }
    } catch (error) {
      console.error('Error creating 104 request:', error);
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        message: 'Errore di connessione'
      });
    }
  };

  if (!user?.has_104 && !user?.has104) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg">
              Non hai accesso ai permessi Legge 104
            </p>
          </div>
        </div>
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
              <Accessibility className="h-8 w-8 mr-3 text-blue-400" />
              Assenze Legge 104
            </h1>
            <p className="text-slate-400 mt-2">
              3 giorni interi al mese per assistenza a familiare con handicap grave (non influenzano la banca ore)
            </p>
          </div>
          
          <button
            onClick={() => setShowNewRequest(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={absence104Balance.remainingDays === 0}
          >
            <Plus className="h-5 w-5 mr-2" />
            Richiedi Assenza 104
          </button>
        </div>
      </div>

      {/* Status Card - GIORNI (non permessi) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border-2 border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">TOTALE GIORNI</p>
              <p className="text-3xl font-bold text-blue-400">
                {absence104Balance.totalDays}
              </p>
              <p className="text-xs text-slate-500 mt-1">al mese</p>
            </div>
            <div className="p-3 rounded-full bg-blue-900/20 text-blue-400">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">GIORNI UTILIZZATI</p>
              <p className="text-3xl font-bold text-amber-400">
                {absence104Balance.usedDays}
              </p>
              <p className="text-xs text-slate-500 mt-1">questo mese</p>
            </div>
            <div className="p-3 rounded-full bg-amber-900/20 text-amber-400">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">IN ATTESA</p>
              <p className="text-3xl font-bold text-yellow-400">
                {absence104Balance.pendingDays}
              </p>
              <p className="text-xs text-slate-500 mt-1">richieste pendenti</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-900/20 text-yellow-400">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">GIORNI RIMANENTI</p>
              <p className={`text-3xl font-bold ${
                absence104Balance.remainingDays > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {absence104Balance.remainingDays}
              </p>
              <p className="text-xs text-slate-500 mt-1">disponibili</p>
            </div>
            <div className={`p-3 rounded-full ${
              absence104Balance.remainingDays > 0 ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
            }`}>
              <Users className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-semibold mb-2">ℹ️ Informazioni sulle Assenze Legge 104:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Hai diritto a <strong>3 giorni interi</strong> di assenza 104 al mese</li>
              <li>Le assenze 104 sono <strong>auto-approvate</strong> (non serve attendere conferma)</li>
              <li><strong>Non influenzano la banca ore</strong> (separate dalla banca ore)</li>
              <li>Mezza giornata = <strong>1 giorno intero</strong> (arrotondamento per eccesso)</li>
              <li>Risulti <strong>assente giustificato</strong> nelle presenze</li>
              <li>Il limite si azzera ogni mese (non si accumulano)</li>
            </ul>
          </div>
        </div>
      </div>

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
            {/* Filtro temporale */}
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

            {/* Campo di ricerca */}
            <div className="flex items-center space-x-4">
              <Search className="h-5 w-5 text-blue-400" />
              <input
                type="text"
                placeholder="Cerca per note o data..."
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

      {/* Lista Richieste */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Storico Assenze 104</h2>
          <span className="text-sm text-slate-400">
            {requests.filter(r => {
              const matchesSearch = (r.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
              return matchesSearch;
            }).length} {requests.length === 1 ? 'richiesta' : 'richieste'} totale
          </span>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : requests.filter(r=>{
              const matchesSearch= (r.notes||'').toLowerCase().includes(searchTerm.toLowerCase());
              return matchesSearch;
            }).length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Nessuna assenza 104 richiesta</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.filter(r=>{
                const matchesSearch= (r.notes||'').toLowerCase().includes(searchTerm.toLowerCase());
                return matchesSearch;
              }).sort((a, b) => new Date(b.startDate || b.submittedAt) - new Date(a.startDate || a.submittedAt)).map((request) => (
              <div key={request.id} className="bg-slate-700 rounded-lg p-4 border border-blue-500/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <span className="font-semibold text-white">
                        {request.startDate === request.endDate ? (
                          new Date(request.startDate).toLocaleDateString('it-IT', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })
                        ) : (
                          <>
                            dal {new Date(request.startDate).toLocaleDateString('it-IT', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })} al {new Date(request.endDate).toLocaleDateString('it-IT', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </>
                        )}
                      </span>
                      {request.days_requested && (
                        <span className="text-xs text-blue-300 ml-2">
                          ({request.days_requested} {request.days_requested === 1 ? 'giorno' : 'giorni'})
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        request.status === 'approved' 
                          ? 'bg-green-900/30 text-green-400 border border-green-500/30' 
                          : 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30'
                      }`}>
                        {request.status === 'approved' ? 'Approvato' : 'In Attesa'}
                      </span>
                    </div>
                    
                    {request.notes && (
                      <p className="text-sm text-slate-400 ml-8">
                        Note: {request.notes}
                      </p>
                    )}
                    
                    <p className="text-xs text-slate-500 ml-8 mt-1">
                      Richiesto il: {new Date(request.submittedAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nuova Richiesta */}
      {showNewRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Accessibility className="h-6 w-6 mr-2 text-blue-400" />
              Richiedi Assenza 104
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Status Rimanenti */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-200 text-sm">
                  <strong>Giorni disponibili questo mese:</strong> {absence104Balance.remainingDays}/3
                </p>
                {absence104Balance.pendingDays > 0 && (
                  <p className="text-yellow-200 text-xs mt-1">
                    {absence104Balance.pendingDays} {absence104Balance.pendingDays === 1 ? 'giorno' : 'giorni'} in attesa di approvazione
                  </p>
                )}
              </div>

              {/* Data Inizio */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Inizio *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value || formData.endDate })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Data Fine */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Fine *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Puoi richiedere anche più giorni consecutivi (max {absence104Balance.remainingDays} giorni disponibili)
                </p>
              </div>

              {/* Calcolo Giorni Richiesti */}
              {formData.startDate && formData.endDate && !validationError && (() => {
                const start = new Date(formData.startDate);
                const end = new Date(formData.endDate);
                const daysRequested = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
                const remainingAfter = absence104Balance.remainingDays - daysRequested;

                return (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-200 text-sm">
                      <strong>Giorni richiesti:</strong> {daysRequested} {daysRequested === 1 ? 'giorno' : 'giorni'} intero/i
                    </p>
                    <p className="text-green-200 text-sm mt-1">
                      <strong>Giorni rimanenti dopo questa richiesta:</strong> {remainingAfter} {remainingAfter === 1 ? 'giorno' : 'giorni'}
                    </p>
                  </div>
                );
              })()}

              {/* Errore Validazione */}
              {validationError && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-200 text-sm">
                    ⚠️ {validationError}
                  </p>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Note (opzionale)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Es. Assistenza per visita medica..."
                />
              </div>

              {/* Info Auto-approvazione */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <p className="text-sm text-green-200">
                    Questa assenza 104 verrà <strong>auto-approvata</strong> immediatamente. Non è necessaria l'approvazione dell'admin. <strong>Non influenzano la banca ore.</strong>
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewRequest(false);
                    setFormData({ startDate: '', endDate: '', notes: '' });
                    setValidationError('');
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center"
                  disabled={absence104Balance.remainingDays === 0 || !!validationError}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Conferma Assenza 104
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert */}
      <CustomAlert
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
    </div>
  );
};

export default Permessi104;

