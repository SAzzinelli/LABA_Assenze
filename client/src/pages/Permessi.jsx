import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
import CustomAlert from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import AdminCreatePermissionModal from '../components/AdminCreatePermissionModal';
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
  Search,
  UserPlus
} from 'lucide-react';

const LeaveRequests = () => {
  const { user, apiCall } = useAuthStore();
  const { alert, showSuccess, showError, showConfirm, hideAlert } = useCustomAlert();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'uscita_anticipata', // USCITA ANTICIPATA o ENTRATA_POSTICIPATA
    permissionDate: '',
    exitTime: '', // Orario di uscita per uscita anticipata
    entryTime: '', // Orario di entrata per entrata posticipata
    notes: ''
  });
  
  // Orario di lavoro reale per il calcolo corretto
  const [workSchedule, setWorkSchedule] = useState(null);

  // Filtri temporali per admin
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Campo di ricerca
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stato per collassabile filtri
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Array vuoto per le richieste di permessi
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tab per admin
  const [activeTab, setActiveTab] = useState('imminenti'); // 'imminenti' | 'cronologia'
  
  // Stati per dialog di approvazione/rifiuto/annullamento
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [permissions104, setPermissions104] = useState({
    usedThisMonth: 0,
    maxPerMonth: 3,
    remaining: 3
  });

  // Hook per gestire chiusura modal con ESC e click fuori
  useModal(showNewRequest, () => setShowNewRequest(false));

  // Funzione per recuperare le richieste dal backend
  const fetchRequests = async () => {
    try {
      setLoading(true);
      // Filtra solo le richieste di tipo "permission" (permessi orari)
      const response = await apiCall('/api/leave-requests?type=permission');
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        console.error('Errore nel recupero delle richieste');
      }
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carica le richieste al mount
  useEffect(() => {
    fetchRequests();
  }, []);

  // Carica permessi 104 se l'utente li ha
  useEffect(() => {
    if (user?.has104) {
      fetchPermissions104();
    }
  }, [user?.has104]);

  // Carica l'orario di lavoro quando cambia la data del permesso
  useEffect(() => {
    const fetchWorkSchedule = async () => {
      if (!formData.permissionDate) {
        setWorkSchedule(null);
        return;
      }
      
      try {
        const date = new Date(formData.permissionDate);
        const dayOfWeek = date.getDay(); // 0 = Domenica, 1 = Lunedì, etc.
        
        const response = await apiCall('/api/work-schedules');
        if (response.ok) {
          const schedules = await response.json();
          // Trova l'orario per il giorno specifico
          const schedule = schedules.find(s => 
            s.day_of_week === dayOfWeek && s.is_working_day
          );
          
          if (schedule) {
            setWorkSchedule({
              start_time: schedule.start_time,
              end_time: schedule.end_time
            });
          } else {
            setWorkSchedule(null);
          }
        }
      } catch (error) {
        console.error('Error fetching work schedule:', error);
        setWorkSchedule(null);
      }
    };
    
    fetchWorkSchedule();
  }, [formData.permissionDate, apiCall]);

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

  // Funzioni per gestire approvazione/rifiuto richieste (solo admin)
  const handleApproveRequest = async (requestId, notes = '') => {
    try {
      const response = await apiCall(`/api/leave-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'approved',
          notes: notes
        })
      });

      if (response.ok) {
        showSuccess('Richiesta approvata con successo');
        fetchRequests(); // Ricarica le richieste
      } else {
        const error = await response.json();
        showError(`Errore: ${error.error || 'Errore durante l\'approvazione'}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      showError('Errore durante l\'approvazione della richiesta');
    }
  };

  const handleRejectRequest = async (requestId, notes = '') => {
    try {
      const response = await apiCall(`/api/leave-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'rejected',
          notes: notes
        })
      });

      if (response.ok) {
        showSuccess('Richiesta rifiutata');
        fetchRequests(); // Ricarica le richieste
      } else {
        const error = await response.json();
        showError(`Errore: ${error.error || 'Errore durante il rifiuto'}`);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      showError('Errore durante il rifiuto della richiesta');
    }
  };

  // Funzioni per gestire i dialog
  const openApproveDialog = (requestId) => {
    setSelectedRequestId(requestId);
    setApprovalNotes('');
    setShowApproveDialog(true);
  };

  const openRejectDialog = (requestId) => {
    setSelectedRequestId(requestId);
    setRejectionNotes('');
    setShowRejectDialog(true);
  };

  const openCancelDialog = (requestId) => {
    setSelectedRequestId(requestId);
    setCancellationReason('');
    setShowCancelDialog(true);
  };

  const confirmApprove = () => {
    handleApproveRequest(selectedRequestId, approvalNotes);
    setShowApproveDialog(false);
  };

  const confirmReject = () => {
    handleRejectRequest(selectedRequestId, rejectionNotes);
    setShowRejectDialog(false);
  };

  const confirmCancel = () => {
    handleCancelRequest(selectedRequestId, cancellationReason);
    setShowCancelDialog(false);
  };

  // Funzione per annullare richieste approvate (solo admin, solo permessi)
  const handleCancelRequest = async (requestId, reason = '') => {
    try {
      const { token } = useAuthStore.getState();
      
      if (!token) {
        showError('Token non trovato. Effettua il login.');
        return;
      }
      
      console.log('🔍 Cancelling request with token:', token.substring(0, 20) + '...');
      
      const response = await fetch(`/api/hours/admin/leave-requests/${requestId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason
        })
      });

      if (response.ok) {
        const data = await response.json();
        showSuccess('Richiesta annullata con successo!');
        fetchRequests(); // Ricarica le richieste
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Errore durante l\'annullamento della richiesta');
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      showError('Errore durante l\'annullamento della richiesta');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calcola automaticamente le ore di permesso usando l'orario reale
  const calculatePermissionHours = () => {
    if (!formData.permissionDate) return 0;
    
    // Se abbiamo l'orario di lavoro per quel giorno, usalo
    if (workSchedule) {
      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      if (formData.type === 'uscita_anticipata' && formData.exitTime) {
        // Uscita anticipata: calcola da exitTime alla fine standard
        const exitMinutes = timeToMinutes(formData.exitTime);
        const standardEndMinutes = timeToMinutes(workSchedule.end_time);
        const minutesDiff = standardEndMinutes - exitMinutes;
        return Math.max(0, parseFloat((minutesDiff / 60).toFixed(2)));
      } else if (formData.type === 'entrata_posticipata' && formData.entryTime) {
        // Entrata posticipata: calcola dall'inizio standard a entryTime
        const entryMinutes = timeToMinutes(formData.entryTime);
        const standardStartMinutes = timeToMinutes(workSchedule.start_time);
        const minutesDiff = entryMinutes - standardStartMinutes;
        return Math.max(0, parseFloat((minutesDiff / 60).toFixed(2)));
      }
    }
    
    // Fallback: se non abbiamo l'orario, usa valori di default (non dovrebbe accadere)
    return 0;
  };

  // Formatta le ore in modo leggibile (1h 42m invece di 1.7h)
  const formatHoursReadable = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Calcola automaticamente le ore di permesso
    const calculatedHours = calculatePermissionHours();
    
    if (calculatedHours <= 0) {
      alert('Inserisci un orario valido per calcolare le ore di permesso');
      return;
    }
    
    try {
      const response = await apiCall('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'permission',
          startDate: formData.permissionDate,
          endDate: formData.permissionDate,
          reason: formData.type === 'uscita_anticipata' ? 'Uscita Anticipata' : 'Entrata Posticipata',
          notes: formData.notes,
          permissionType: formData.type === 'uscita_anticipata' ? 'early_exit' : 'late_entry',
          hours: calculatedHours,
          exitTime: formData.exitTime,
          entryTime: formData.entryTime
        })
      });
      
      if (response.ok) {
        // Ricarica le richieste dal backend
        await fetchRequests();
        setFormData({
          type: 'uscita_anticipata',
          permissionDate: '',
          exitTime: '',
          entryTime: '',
          notes: ''
        });
        setShowNewRequest(false);
        alert('Richiesta inviata con successo!');
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error || 'Errore nel salvataggio'}`);
      }
    } catch (error) {
      console.error('Errore:', error);
      alert('Errore nel salvataggio della richiesta');
    }
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

  // Filtra le richieste per il mese/anno selezionato, ricerca e tab attiva
  const parseRequestDate = (request, includeTime = false) => {
    const rawDate = request.permissionDate || request.startDate;
    if (!rawDate) return null;
    const date = new Date(rawDate);
    if (isNaN(date.getTime())) return null;

    if (includeTime) {
      const timeStr = request.exitTime || request.entryTime;
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
          date.setHours(hours, minutes, 0, 0);
        }
      }
    }

    return date;
  };

  const canCancelRequest = (request) => {
    if (request.status !== 'approved') return false;
    const dateWithTime = parseRequestDate(request, true);
    if (!dateWithTime) return true;
    return dateWithTime > new Date();
  };

  const getFilteredRequests = () => {
    let filtered = requests;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filtro per tab (solo admin)
    if (user?.role === 'admin') {
      if (activeTab === 'imminenti') {
        filtered = filtered
          .filter(request => {
            if (request.status === 'pending') return true;
            if (request.status !== 'approved') return false;

            const requestDate = parseRequestDate(request);
            if (!requestDate) return false;

            if (requestDate > todayStart) {
              return true;
            }

            if (requestDate < todayStart) {
              return false;
            }

            const requestMoment = parseRequestDate(request, true);
            return requestMoment ? requestMoment > now : false;
          })
          .sort((a, b) => {
            const dateA = parseRequestDate(a, true)?.getTime() || 0;
            const dateB = parseRequestDate(b, true)?.getTime() || 0;
            return dateA - dateB;
          });
      } else {
        filtered = filtered.filter(request => {
          const requestDate = parseRequestDate(request);
          if (!requestDate) return false;
          const isInCurrentMonth = requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear;
          const requestMoment = parseRequestDate(request, true);
          const isUpcomingApproved = request.status === 'approved' && requestMoment && requestMoment > now;
          const isPending = request.status === 'pending';
          return isInCurrentMonth && !isPending && !isUpcomingApproved;
        });
      }
    } else {
      // Per dipendenti: filtra per mese/anno
      filtered = filtered.filter(request => {
        const requestDate = parseRequestDate(request);
        if (!requestDate) return false;
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
      case 'cancelled':
        return 'Annullata';
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
      case 'cancelled':
        return 'bg-orange-500/20 text-orange-300 border-orange-400/30';
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
      if (request.permissionType === 'uscita_anticipata') {
        return 'Uscita Anticipata';
      } else if (request.permissionType === 'entrata_posticipata') {
        return 'Entrata Posticipata';
      } else if (request.permissionType === 'permesso_104') {
        return 'Permesso 104';
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
          
          {/* Tab e Pulsante per Admin */}
          {user?.role === 'admin' && (
            <div className="flex items-center space-x-4">
              <div className="flex bg-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('imminenti')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'imminenti'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Imminenti
                </button>
                <button
                  onClick={() => setActiveTab('cronologia')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'cronologia'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cronologia
                </button>
              </div>
              <button
                onClick={() => setShowAdminCreateModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center text-sm sm:text-base"
              >
                <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                Aggiungi
              </button>
            </div>
          )}
          {user?.role !== 'admin' && (
            <button
              onClick={() => setShowNewRequest(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Aggiungi
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
                    {workSchedule 
                      ? `Orario normale di uscita: ${workSchedule.end_time}. Le ore di permesso verranno calcolate automaticamente.`
                      : 'Caricamento orario di lavoro...'}
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
                    {workSchedule 
                      ? `Orario normale di entrata: ${workSchedule.start_time}. Le ore di permesso verranno calcolate automaticamente.`
                      : 'Caricamento orario di lavoro...'}
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
        <h2 className="text-xl font-bold text-white flex items-center mb-6">
          <Clock className="h-6 w-6 mr-3 text-slate-400" />
          {user?.role === 'admin' ? 'Gestione Richieste Permessi' : 'Storico Richieste Permessi'}
        </h2>

        {(() => {
          const filteredRequests = getFilteredRequests();
          return filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">
                {user?.role === 'admin' 
                  ? (activeTab === 'imminenti' 
                      ? 'Nessuna richiesta imminente'
                      : `Nessuna richiesta per ${monthNames[currentMonth]} ${currentYear}`)
                  : 'Nessuna richiesta di permesso presente'
                }
              </p>
              <p className="text-slate-500 text-sm mt-2">
                {user?.role === 'admin' 
                  ? (activeTab === 'imminenti'
                      ? 'Le richieste approvate con date future appariranno qui'
                      : 'Prova a cambiare mese o aggiungere nuove richieste')
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
                      <h3 className="text-lg font-semibold text-white ml-2">{getPermissionTypeText(request)}</h3>
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
                          {request.permissionDate ? formatDate(request.permissionDate) : 'Data non disponibile'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-slate-400" />
                        <span>
                          {request.hours ? 
                            formatHoursReadable(request.hours) :
                            `${calculateDays(request.startDate, request.endDate)} giorni`
                          }
                        </span>
                      </div>
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-slate-400" />
                        <span>Tipo: {getPermissionTypeText(request)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-slate-400" />
                        <span>Richiesta: {formatDateTime(request.submittedAt)}</span>
                      </div>
                      {request.approvedAt && (
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 mr-2 text-slate-400" />
                          <span>Approvato da: {request.approver?.name || request.approvedBy} alle {formatDateTime(request.approvedAt)}</span>
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
                    
                    {/* Pulsanti di approvazione per admin - solo per richieste pending */}
                    {user?.role === 'admin' && request.status === 'pending' && (
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => openApproveDialog(request.id)}
                          className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approva
                        </button>
                        <button
                          onClick={() => openRejectDialog(request.id)}
                          className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Rifiuta
                        </button>
                      </div>
                    )}

                    {/* Pulsante di annullamento per admin - solo per richieste approvate */}
                    {user?.role === 'admin' && canCancelRequest(request) && (
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => openCancelDialog(request.id)}
                          className="flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Annulla
                        </button>
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

      {/* Dialog di approvazione */}
      {showApproveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApproveDialog(false)} />
          <div className="relative bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Approva Richiesta</h3>
            <p className="text-slate-300 mb-4">Inserisci le note per l'approvazione (opzionale):</p>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={3}
              placeholder="Note per l'approvazione..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowApproveDialog(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmApprove}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Approva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog di rifiuto */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRejectDialog(false)} />
          <div className="relative bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Rifiuta Richiesta</h3>
            <p className="text-slate-300 mb-4">Inserisci il motivo del rifiuto (opzionale):</p>
            <textarea
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={3}
              placeholder="Motivo del rifiuto..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowRejectDialog(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Rifiuta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog di annullamento */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCancelDialog(false)} />
          <div className="relative bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Annulla Richiesta</h3>
            <p className="text-slate-300 mb-4">Inserisci il motivo dell'annullamento (opzionale):</p>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={3}
              placeholder="Motivo dell'annullamento..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                Conferma Annullamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert custom */}
      <CustomAlert
        isOpen={alert.isOpen}
        onClose={hideAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onConfirm={alert.onConfirm}
        showCancel={alert.showCancel}
        confirmText={alert.confirmText}
        cancelText={alert.cancelText}
      />

      {/* Modal Admin Crea Permesso per Dipendente */}
      <AdminCreatePermissionModal
        isOpen={showAdminCreateModal}
        onClose={() => setShowAdminCreateModal(false)}
        onSuccess={() => {
          fetchRequests();
          showSuccess('Permesso registrato!', 'Il permesso è stato registrato e il dipendente è stato notificato.');
        }}
      />
    </div>
  );
};

export default LeaveRequests;