import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import VacationCalendar from '../components/VacationCalendar';
import AdminCreateVacationModal from '../components/AdminCreateVacationModal';
import { FerieSkeleton } from '../components/Skeleton';
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
  Search,
  Calculator,
  TrendingUp,
  CalendarDays,
  List,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Info
} from 'lucide-react';
import {
  calculateVacationHoursForDay,
  formatHours,
  hoursToDays,
  daysToHours,
  CONTRACT_TYPES
} from '../utils/hoursCalculation';

const Vacation = () => {
  const { user, apiCall } = useAuthStore();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    notes: ''
  });

  // Filtri temporali per admin
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Campo di ricerca
  const [searchTerm, setSearchTerm] = useState('');

  // Stato per collassabile filtri
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Array vuoto per le richieste di ferie
  const [vacationRequests, setVacationRequests] = useState([]);

  // Vista attiva (calendar o list)
  const [activeView, setActiveView] = useState('calendar');
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Gestione periodi ferie (solo admin)
  const [showPeriodsManagement, setShowPeriodsManagement] = useState(false);
  const [vacationPeriods, setVacationPeriods] = useState([]);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [periodFormStep, setPeriodFormStep] = useState(1); // Step corrente (1-4)
  const [periodFormData, setPeriodFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    vacationStartDate: '',
    vacationEndDate: '',
    isOpen: true,
    maxConcurrentRequests: '',
    notes: ''
  });

  // Hook per gestire chiusura modal con ESC e click fuori
  useModal(showNewRequest, () => setShowNewRequest(false));

  // Real-time updates
  const { emitUpdate } = useRealTimeUpdates({
    onLeaveRequestUpdate: (data) => {
      console.log('📋 Nuova richiesta ferie ricevuta:', data);
      fetchVacationData(); // Ricarica i dati
    },
    onRequestDecision: (data) => {
      console.log('✅ Decisione richiesta ricevuta:', data);
      fetchVacationData(); // Ricarica i dati
    }
  });

  // Sistema basato su GIORNI (30 giorni per tutti, non ore)
  // Le ferie sono completamente separate dalla banca ore
  const [vacationBalance, setVacationBalance] = useState({
    totalDays: 30, // 30 giorni per tutti (full-time e part-time)
    usedDays: 0,
    remainingDays: 30,
    pendingDays: 0
  });
  const [availablePeriods, setAvailablePeriods] = useState([]); // Periodi di richiesta ferie aperti
  const [loading, setLoading] = useState(true);
  const [periodValidationError, setPeriodValidationError] = useState('');

  // Fetch real data on component mount
  useEffect(() => {
    fetchVacationData();
  }, []);

  const fetchVacationData = async () => {
    try {
      setLoading(true);

      // Fetch vacation requests
      const requestsResponse = await apiCall('/api/leave-requests?type=vacation');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setVacationRequests(requestsData);
      }

      // Fetch vacation balance (GIORNI, non ore)
      const balanceResponse = await apiCall('/api/vacation-balances');
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();

        setVacationBalance({
          totalDays: balanceData.total_days || 30,
          usedDays: balanceData.used_days || 0,
          remainingDays: balanceData.remaining_days || 30,
          pendingDays: balanceData.pending_days || 0
        });
      } else {
        // Fallback con dati di default
        setVacationBalance({
          totalDays: 30,
          usedDays: 0,
          remainingDays: 30,
          pendingDays: 0
        });
      }

      // Fetch available vacation periods (solo periodi aperti)
      const periodsResponse = await apiCall('/api/vacation-periods/available');
      if (periodsResponse.ok) {
        const periodsData = await periodsResponse.json();
        setAvailablePeriods(periodsData || []);
      }

      // Se admin, carica anche tutti i periodi (aperti e chiusi)
      if (user?.role === 'admin') {
        const allPeriodsResponse = await apiCall('/api/vacation-periods');
        if (allPeriodsResponse.ok) {
          const allPeriodsData = await allPeriodsResponse.json();
          setVacationPeriods(allPeriodsData || []);
        }
      }
    } catch (error) {
      console.error('Error fetching vacation data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funzioni per gestire approvazione/rifiuto richieste (solo admin)
  const handleApproveRequest = async (requestId, notes = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'approved',
          notes: notes
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('Richiesta approvata con successo');

        // Emetti aggiornamento real-time
        emitUpdate('request_decision', {
          requestId,
          status: 'approved',
          userId: result.userId,
          message: 'La tua richiesta di ferie è stata approvata'
        });

        fetchVacationData(); // Ricarica le richieste
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Errore durante l\'approvazione della richiesta');
    }
  };

  const handleRejectRequest = async (requestId, notes = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'rejected',
          notes: notes
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('Richiesta rifiutata');

        // Emetti aggiornamento real-time
        emitUpdate('request_decision', {
          requestId,
          status: 'rejected',
          userId: result.userId,
          message: 'La tua richiesta di ferie è stata rifiutata'
        });

        fetchVacationData(); // Ricarica le richieste
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error}`);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Errore durante il rifiuto della richiesta');
    }
  };

  // Validazione periodi quando cambiano le date nel form
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      validateVacationPeriod();
    } else {
      setPeriodValidationError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startDate, formData.endDate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Valida che le date siano in un periodo aperto
  const validateVacationPeriod = async () => {
    if (!formData.startDate || !formData.endDate) {
      setPeriodValidationError('');
      return;
    }

    try {
      const response = await apiCall('/api/vacation-periods/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: formData.startDate,
          endDate: formData.endDate
        })
      });

      if (response.ok) {
        const validation = await response.json();
        if (!validation.isValid) {
          setPeriodValidationError('Alcune date selezionate non sono disponibili nei periodi di richiesta ferie aperti');
          return false;
        } else {
          setPeriodValidationError('');
          return true;
        }
      }
    } catch (error) {
      console.error('Error validating period:', error);
      setPeriodValidationError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate) {
      alert('Seleziona le date di inizio e fine');
      return;
    }

    // Valida periodo prima di inviare
    const isValidPeriod = await validateVacationPeriod();
    if (!isValidPeriod && periodValidationError) {
      alert(periodValidationError);
      return;
    }

    // Verifica che ci sia almeno un periodo aperto
    if (availablePeriods.length === 0) {
      alert('Non ci sono periodi di richiesta ferie aperti al momento. Contatta l\'amministratore.');
      return;
    }

    try {
      // Calcola i GIORNI richiesti (1 giorno = 1 giorno per tutti, non ore)
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // Verifica saldo disponibile (giorni, non ore)
      if (daysRequested > vacationBalance.remainingDays) {
        alert(`Giorni di ferie insufficienti. Richiesti: ${daysRequested} giorni, Disponibili: ${vacationBalance.remainingDays} giorni`);
        return;
      }

      // Crea richiesta ferie (il backend validerà i periodi)
      const response = await apiCall('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vacation',
          startDate: formData.startDate,
          endDate: formData.endDate,
          notes: formData.notes
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Aggiorna stato locale
        const daysRequested = Math.ceil((new Date(formData.endDate) - new Date(formData.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const newRequest = {
          id: Date.now(),
          ...formData,
          status: 'pending',
          submittedAt: new Date().toISOString(),
          submittedBy: user?.firstName + ' ' + user?.lastName,
          daysRequested: daysRequested
        };

        setVacationRequests(prev => [newRequest, ...prev]);
        setFormData({
          startDate: '',
          endDate: '',
          notes: ''
        });
        setShowNewRequest(false);

        // Emetti aggiornamento real-time per admin
        emitUpdate('leave_request_update', {
          type: 'vacation',
          requestId: result.id || Date.now(),
          userId: user?.id,
          userName: user?.firstName + ' ' + user?.lastName,
          startDate: formData.startDate,
          endDate: formData.endDate,
          daysRequested: daysRequested,
          message: `Nuova richiesta ferie da ${user?.firstName} ${user?.lastName}`
        });

        // Refresh data
        fetchVacationData();

        alert(`Richiesta inviata con successo! Giorni richiesti: ${daysRequested} ${daysRequested === 1 ? 'giorno' : 'giorni'}`);
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting vacation request:', error);
      alert('Errore nella creazione della richiesta');
    }
  };

  const handleCancel = () => {
    setFormData({
      startDate: '',
      endDate: '',
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

    // Filtro per mese/anno (solo admin e solo nella vista lista)
    if (user?.role === 'admin' && activeView === 'list') {
      filtered = filtered.filter(request => {
        const requestDate = new Date(request.startDate);
        return requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear;
      });
    }

    // Filtro per ricerca
    if (searchTerm.trim()) {
      filtered = filtered.filter(request => {
        const searchLower = searchTerm.toLowerCase();
        if (activeView === 'calendar') {
          // Nella vista calendario, cerca principalmente per nome dipendente
          return request.submittedBy?.toLowerCase().includes(searchLower);
        } else {
          // Nella vista lista, cerca per tutti i campi
          return (
            request.notes?.toLowerCase().includes(searchLower) ||
            request.status?.toLowerCase().includes(searchLower) ||
            request.submittedBy?.toLowerCase().includes(searchLower)
          );
        }
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
        return 'bg-green-500/10 text-green-300 border-green-400/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-300 border-red-400/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-300 border-yellow-400/20';
      default:
        return 'bg-zinc-800/50 text-slate-300 border-zinc-700';
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

  // Funzioni gestione periodi ferie (solo admin)
  const handlePeriodInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPeriodFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCreatePeriod = () => {
    setEditingPeriod(null);
    setPeriodFormStep(1); // Reset a step 1
    setPeriodFormData({
      name: '',
      startDate: '',
      endDate: '',
      vacationStartDate: '',
      vacationEndDate: '',
      isOpen: true,
      maxConcurrentRequests: '',
      notes: ''
    });
    setShowPeriodModal(true);
  };

  const handleEditPeriod = (period) => {
    setEditingPeriod(period);
    setPeriodFormStep(1); // Reset a step 1
    setPeriodFormData({
      name: period.name,
      startDate: period.start_date,
      endDate: period.end_date,
      vacationStartDate: period.vacation_start_date,
      vacationEndDate: period.vacation_end_date,
      isOpen: period.is_open,
      maxConcurrentRequests: period.max_concurrent_requests || '',
      notes: period.notes || ''
    });
    setShowPeriodModal(true);
  };

  // Valida step corrente
  const validateStep = (step) => {
    switch (step) {
      case 1:
        return periodFormData.name.trim() !== '' &&
          periodFormData.startDate !== '' &&
          periodFormData.endDate !== '' &&
          periodFormData.startDate <= periodFormData.endDate;
      case 2:
        return periodFormData.vacationStartDate !== '' &&
          periodFormData.vacationEndDate !== '' &&
          periodFormData.vacationStartDate <= periodFormData.vacationEndDate;
      case 3:
        // Step 3 non ha campi obbligatori (opzionali)
        return true;
      case 4:
        // Step 4 (note) sempre valido
        return true;
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    if (validateStep(periodFormStep)) {
      setPeriodFormStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handlePrevStep = () => {
    setPeriodFormStep(prev => Math.max(prev - 1, 1));
  };

  const handleSavePeriod = async (e) => {
    e.preventDefault();
    try {
      const url = editingPeriod
        ? `/api/vacation-periods/${editingPeriod.id}`
        : '/api/vacation-periods';

      const method = editingPeriod ? 'PUT' : 'POST';

      const response = await apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: periodFormData.name,
          startDate: periodFormData.startDate,
          endDate: periodFormData.endDate,
          vacationStartDate: periodFormData.vacationStartDate,
          vacationEndDate: periodFormData.vacationEndDate,
          isOpen: periodFormData.isOpen,
          maxConcurrentRequests: periodFormData.maxConcurrentRequests ? parseInt(periodFormData.maxConcurrentRequests) : null,
          notes: periodFormData.notes
        })
      });

      if (response.ok) {
        alert(`Periodo ${editingPeriod ? 'aggiornato' : 'creato'} con successo!`);
        setShowPeriodModal(false);
        setPeriodFormStep(1); // Reset step
        fetchVacationData(); // Ricarica i periodi
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving period:', error);
      alert('Errore nel salvataggio del periodo');
    }
  };

  const handleDeletePeriod = async (periodId) => {
    if (!confirm('Sei sicuro di voler eliminare questo periodo?')) {
      return;
    }

    try {
      const response = await apiCall(`/api/vacation-periods/${periodId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('Periodo eliminato con successo!');
        fetchVacationData(); // Ricarica i periodi
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting period:', error);
      alert('Errore nell\'eliminazione del periodo');
    }
  };

  const handleTogglePeriod = async (period) => {
    try {
      const response = await apiCall(`/api/vacation-periods/${period.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isOpen: !period.is_open
        })
      });

      if (response.ok) {
        fetchVacationData(); // Ricarica i periodi
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error}`);
      }
    } catch (error) {
      console.error('Error toggling period:', error);
      alert('Errore nell\'aggiornamento del periodo');
    }
  };

  if (loading) {
    return <FerieSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-0">
      {/* Header Mobile-First: Design completamente diverso su mobile */}
      {/* Mobile: Header compatto sticky con toggle vista */}
      <div className="lg:hidden bg-zinc-900 rounded-lg p-4 sticky top-16 z-20 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Plane className="h-5 w-5 text-slate-400 flex-shrink-0" />
            <h1 className="text-lg font-bold text-white truncate">
              {user?.role === 'admin' ? 'Ferie' : 'Le Mie Ferie'}
            </h1>
          </div>
          <button
            onClick={() => user?.role === 'admin' ? setShowAdminCreateModal(true) : setShowNewRequest(true)}
            disabled={user?.role !== 'admin' && availablePeriods.length === 0}
            className={`p-2 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center shadow-lg ${user?.role !== 'admin' && availablePeriods.length === 0
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white'
              }`}
            aria-label="Aggiungi ferie"
            title={user?.role !== 'admin' && availablePeriods.length === 0 ? 'Nessun periodo aperto per le ferie' : 'Aggiungi ferie'}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Toggle Vista - Full width su mobile */}
        <div className="flex bg-slate-700 rounded-lg p-1 mb-2">
          <button
            onClick={() => setActiveView('list')}
            className={`flex-1 px-3 py-2 rounded-md transition-colors flex items-center justify-center text-sm touch-manipulation min-h-[44px] ${activeView === 'list'
              ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white'
              : 'text-slate-400'
              }`}
          >
            <List className="h-4 w-4 mr-2" />
            Lista
          </button>
          <button
            onClick={() => setActiveView('calendar')}
            className={`flex-1 px-3 py-2 rounded-md transition-colors flex items-center justify-center text-sm touch-manipulation min-h-[44px] ${activeView === 'calendar'
              ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white'
              : 'text-slate-400'
              }`}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Calendario
          </button>
        </div>

        {/* Bottoni admin aggiuntivi su mobile - Stack verticale se presenti */}
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowPeriodsManagement(!showPeriodsManagement)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center text-sm touch-manipulation min-h-[44px] mt-2"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Gestisci Periodi
          </button>
        )}
      </div>

      {/* Desktop: Header tradizionale */}
      <div className="hidden lg:block bg-zinc-900 rounded-lg p-6">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Plane className="h-8 w-8 mr-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{user?.role === 'admin' ? 'Gestione Ferie' : 'Le Mie Ferie'}</span>
            </h1>
            <p className="text-slate-400 mt-2 text-base">
              {user?.role === 'admin'
                ? 'Visualizza e gestisci tutte le richieste di ferie dei dipendenti'
                : 'Gestisci le tue richieste di ferie e visualizza il bilancio ferie'
              }
            </p>
          </div>
          <div className="flex flex-row items-center gap-4 flex-shrink-0">
            {/* Toggle Vista */}
            <div className="flex bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setActiveView('list')}
                className={`px-4 py-2 rounded-md transition-colors flex items-center text-sm ${activeView === 'list'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <List className="h-4 w-4 mr-2" />
                Lista
              </button>
              <button
                onClick={() => setActiveView('calendar')}
                className={`px-4 py-2 rounded-md transition-colors flex items-center text-sm ${activeView === 'calendar'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Calendario
              </button>
            </div>

            {user?.role === 'admin' ? (
              <>
                <button
                  onClick={() => setShowPeriodsManagement(!showPeriodsManagement)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center text-base"
                >
                  <Calendar className="h-5 w-5 mr-2" />
                  Periodi di Ferie
                </button>
                <button
                  onClick={() => setShowAdminCreateModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center text-base"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Aggiungi manualmente
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowNewRequest(true)}
                disabled={availablePeriods.length === 0}
                className={`px-6 py-3 rounded-lg transition-colors flex items-center ${availablePeriods.length === 0
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white'
                  }`}
                title={availablePeriods.length === 0 ? 'Nessun periodo aperto per le ferie' : 'Nuova Richiesta'}
              >
                <Plus className="h-5 w-5 mr-2" />
                Nuova Richiesta
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vacation Balance - GIORNI (non ore) - Solo per dipendenti */}
      {user?.role !== 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">Totale Giorni</h3>
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400 flex-shrink-0" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-300">{vacationBalance.totalDays}</p>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Giorni di ferie annuali</p>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">Giorni Utilizzati</h3>
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 flex-shrink-0" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-400">{vacationBalance.usedDays}</p>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Ferie già godute</p>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">Giorni Rimanenti</h3>
              <Sun className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400 flex-shrink-0" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-400">{vacationBalance.remainingDays}</p>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Disponibili per richieste</p>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">In Attesa</h3>
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-400 flex-shrink-0" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-orange-400">{vacationBalance.pendingDays}</p>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Richieste pendenti</p>
          </div>
        </div>
      )}

      {/* Avviso periodi disponibili */}
      {user?.role !== 'admin' && availablePeriods.length === 0 && (
        <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
            <p className="text-yellow-300">
              Non ci sono periodi di richiesta ferie aperti al momento. Contatta l'amministratore per maggiori informazioni.
            </p>
          </div>
        </div>
      )}

      {/* Mostra periodi disponibili */}
      {user?.role !== 'admin' && availablePeriods.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Calendar className="h-5 w-5 text-slate-400 mr-2" />
            <p className="text-slate-300 font-semibold">Periodi di richiesta ferie aperti:</p>
          </div>
          <div className="space-y-2 mt-2">
            {availablePeriods.map(period => (
              <div key={period.id} className="text-slate-300 text-sm">
                • <strong>{period.name}</strong>: puoi richiedere ferie dal {new Date(period.vacation_start_date).toLocaleDateString('it-IT')} al {new Date(period.vacation_end_date).toLocaleDateString('it-IT')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestione Periodi Ferie (solo admin) */}
      {user?.role === 'admin' && showPeriodsManagement && (
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center">
              <Calendar className="h-6 w-6 mr-3 text-purple-400" />
              Gestione Periodi Richiesta Ferie
            </h2>
            <button
              onClick={handleCreatePeriod}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuovo Periodo
            </button>
          </div>

          {vacationPeriods.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">Nessun periodo configurato</p>
              <p className="text-slate-500 text-sm mt-2">Crea un nuovo periodo per permettere ai dipendenti di richiedere ferie</p>
            </div>
          ) : (
            <div className="space-y-4">
              {vacationPeriods.map(period => (
                <div key={period.id} className="bg-slate-700 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-semibold text-white mr-3">{period.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${period.is_open
                          ? 'bg-green-500/20 text-green-300 border-green-400/30'
                          : 'bg-red-500/20 text-red-300 border-red-400/30'
                          }`}>
                          {period.is_open ? 'Aperto' : 'Chiuso'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300 mt-4">
                        <div>
                          <p className="text-slate-400 mb-1">Periodo richieste:</p>
                          <p className="text-white">Dal {formatDate(period.start_date)} al {formatDate(period.end_date)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-1">Periodo ferie disponibili:</p>
                          <p className="text-white">Dal {formatDate(period.vacation_start_date)} al {formatDate(period.vacation_end_date)}</p>
                        </div>
                        {period.max_concurrent_requests && (
                          <div>
                            <p className="text-slate-400 mb-1">Max richieste contemporanee:</p>
                            <p className="text-white">{period.max_concurrent_requests}</p>
                          </div>
                        )}
                        {period.notes && (
                          <div>
                            <p className="text-slate-400 mb-1">Note:</p>
                            <p className="text-white">{period.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleTogglePeriod(period)}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${period.is_open
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                      >
                        {period.is_open ? 'Chiudi' : 'Apri'}
                      </button>
                      <button
                        onClick={() => handleEditPeriod(period)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => handleDeletePeriod(period.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Creazione/Modifica Periodo - WIZARD A STEP */}
      {showPeriodModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPeriodModal(false);
              setPeriodFormStep(1);
            }
          }}
        >
          <div className="bg-slate-800 rounded-lg p-4 sm:p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Calendar className="h-6 w-6 mr-2 text-purple-400" />
                {editingPeriod ? 'Modifica Periodo' : 'Nuovo Periodo'}
              </h2>
              <button
                onClick={() => {
                  setShowPeriodModal(false);
                  setPeriodFormStep(1);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Indicatori Step */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {[1, 2, 3, 4].map((step) => (
                  <React.Fragment key={step}>
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${periodFormStep === step
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : periodFormStep > step
                          ? 'bg-green-600 border-green-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-400'
                        }`}>
                        {periodFormStep > step ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <span className="font-bold">{step}</span>
                        )}
                      </div>
                      <span className={`ml-2 text-sm font-medium hidden sm:block ${periodFormStep === step ? 'text-white' : 'text-slate-400'
                        }`}>
                        {step === 1 && 'Informazioni Base'}
                        {step === 2 && 'Periodo Ferie'}
                        {step === 3 && 'Impostazioni'}
                        {step === 4 && 'Riepilogo'}
                      </span>
                    </div>
                    {step < 4 && (
                      <div className={`flex-1 h-0.5 mx-2 ${periodFormStep > step ? 'bg-green-600' : 'bg-slate-700'
                        }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <form onSubmit={handleSavePeriod} className="space-y-4">
              {/* STEP 1: Informazioni Base */}
              {periodFormStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <Info className="h-5 w-5 text-purple-400 mr-2 mt-0.5" />
                      <div className="text-sm text-purple-200">
                        <p className="font-semibold mb-1">Step 1: Informazioni Base</p>
                        <p>Definisci il nome del periodo e quando i dipendenti possono inviare richieste di ferie.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Nome Periodo *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={periodFormData.name}
                      onChange={handlePeriodInputChange}
                      required
                      placeholder="Es: Periodo Estivo 2025"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Un nome descrittivo per identificare questo periodo</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Data Inizio Richieste *
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={periodFormData.startDate}
                        onChange={handlePeriodInputChange}
                        required
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">Da quando si possono inviare richieste</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Data Fine Richieste *
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={periodFormData.endDate}
                        onChange={handlePeriodInputChange}
                        required
                        min={periodFormData.startDate || ''}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">Fino a quando si possono inviare richieste</p>
                      {periodFormData.startDate && periodFormData.endDate && periodFormData.startDate > periodFormData.endDate && (
                        <p className="text-xs text-red-400 mt-1">⚠️ La data di fine deve essere successiva alla data di inizio</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Periodo Ferie Effettivo */}
              {periodFormStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <Info className="h-5 w-5 text-purple-400 mr-2 mt-0.5" />
                      <div className="text-sm text-purple-200">
                        <p className="font-semibold mb-1">Step 2: Periodo Ferie Effettivo</p>
                        <p>Definisci il periodo effettivo in cui i dipendenti possono prendere le ferie.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Data Inizio Ferie *
                      </label>
                      <input
                        type="date"
                        name="vacationStartDate"
                        value={periodFormData.vacationStartDate}
                        onChange={handlePeriodInputChange}
                        required
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">Da quando si possono prendere le ferie</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Data Fine Ferie *
                      </label>
                      <input
                        type="date"
                        name="vacationEndDate"
                        value={periodFormData.vacationEndDate}
                        onChange={handlePeriodInputChange}
                        required
                        min={periodFormData.vacationStartDate || ''}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">Fino a quando si possono prendere le ferie</p>
                      {periodFormData.vacationStartDate && periodFormData.vacationEndDate && periodFormData.vacationStartDate > periodFormData.vacationEndDate && (
                        <p className="text-xs text-red-400 mt-1">⚠️ La data di fine deve essere successiva alla data di inizio</p>
                      )}
                    </div>
                  </div>

                  {periodFormData.vacationStartDate && periodFormData.vacationEndDate && periodFormData.startDate && periodFormData.endDate && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 mt-4">
                      <p className="text-slate-300 text-sm">
                        ℹ️ I dipendenti possono richiedere ferie dal <strong>{new Date(periodFormData.vacationStartDate).toLocaleDateString('it-IT')}</strong> al <strong>{new Date(periodFormData.vacationEndDate).toLocaleDateString('it-IT')}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Impostazioni Avanzate */}
              {periodFormStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <Info className="h-5 w-5 text-purple-400 mr-2 mt-0.5" />
                      <div className="text-sm text-purple-200">
                        <p className="font-semibold mb-1">Step 3: Impostazioni Avanzate</p>
                        <p>Configura opzioni aggiuntive per il periodo (tutte opzionali).</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Max Richieste Contemporanee
                      </label>
                      <input
                        type="number"
                        name="maxConcurrentRequests"
                        value={periodFormData.maxConcurrentRequests}
                        onChange={handlePeriodInputChange}
                        min="1"
                        placeholder="Lasciare vuoto per illimitato"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">Limite massimo di dipendenti in ferie contemporaneamente (opzionale)</p>
                    </div>

                    <div className="flex flex-col justify-center">
                      <label className="flex items-center cursor-pointer mb-4">
                        <input
                          type="checkbox"
                          name="isOpen"
                          checked={periodFormData.isOpen}
                          onChange={handlePeriodInputChange}
                          className="h-5 w-5 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                        />
                        <span className="ml-3 text-slate-300 font-medium">Periodo aperto</span>
                      </label>
                      <p className="text-xs text-slate-400">
                        {periodFormData.isOpen
                          ? '✅ I dipendenti possono richiedere ferie per questo periodo'
                          : '❌ Il periodo è chiuso, i dipendenti non possono richiedere ferie'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Note e Riepilogo */}
              {periodFormStep === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <Info className="h-5 w-5 text-purple-400 mr-2 mt-0.5" />
                      <div className="text-sm text-purple-200">
                        <p className="font-semibold mb-1">Step 4: Note e Riepilogo</p>
                        <p>Aggiungi note opzionali e verifica il riepilogo prima di salvare.</p>
                      </div>
                    </div>
                  </div>

                  {/* Riepilogo */}
                  <div className="bg-slate-700 rounded-lg p-4 mb-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Riepilogo Periodo</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Nome:</span>
                        <span className="text-white font-medium">{periodFormData.name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Periodo Richieste:</span>
                        <span className="text-white">
                          {periodFormData.startDate && periodFormData.endDate
                            ? `${new Date(periodFormData.startDate).toLocaleDateString('it-IT')} - ${new Date(periodFormData.endDate).toLocaleDateString('it-IT')}`
                            : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Periodo Ferie:</span>
                        <span className="text-white">
                          {periodFormData.vacationStartDate && periodFormData.vacationEndDate
                            ? `${new Date(periodFormData.vacationStartDate).toLocaleDateString('it-IT')} - ${new Date(periodFormData.vacationEndDate).toLocaleDateString('it-IT')}`
                            : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Stato:</span>
                        <span className={`font-medium ${periodFormData.isOpen ? 'text-green-400' : 'text-red-400'}`}>
                          {periodFormData.isOpen ? 'Aperto' : 'Chiuso'}
                        </span>
                      </div>
                      {periodFormData.maxConcurrentRequests && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Max Contemporanee:</span>
                          <span className="text-white">{periodFormData.maxConcurrentRequests}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Note (opzionale)
                    </label>
                    <textarea
                      name="notes"
                      value={periodFormData.notes}
                      onChange={handlePeriodInputChange}
                      rows={3}
                      placeholder="Note aggiuntive sul periodo..."
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Campi nascosti per validazione form HTML */}
              <div className="hidden">
                <input type="date" name="startDate" value={periodFormData.startDate} required readOnly />
                <input type="date" name="endDate" value={periodFormData.endDate} required readOnly />
                <input type="date" name="vacationStartDate" value={periodFormData.vacationStartDate} required readOnly />
                <input type="date" name="vacationEndDate" value={periodFormData.vacationEndDate} required readOnly />
              </div>

              {/* Pulsanti Navigazione */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-700 mt-6">
                <div>
                  {periodFormStep > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors flex items-center"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Indietro
                    </button>
                  )}
                  {periodFormStep === 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPeriodModal(false);
                        setPeriodFormStep(1);
                      }}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors flex items-center"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Annulla
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-sm text-slate-400">
                    Step {periodFormStep} di 4
                  </span>
                  {periodFormStep < 4 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={!validateStep(periodFormStep)}
                      className="px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center text-xs sm:text-sm touch-manipulation min-h-[44px]"
                    >
                      Avanti
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {editingPeriod ? 'Salva Modifiche' : 'Crea Periodo'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* New Request Modal */}
      {showNewRequest && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowNewRequest(false)}
        >
          <div className="bg-slate-800 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
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

              {formData.startDate && formData.endDate && (() => {
                const start = new Date(formData.startDate);
                const end = new Date(formData.endDate);
                const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

                const remainingAfterRequest = vacationBalance.remainingDays - daysRequested;
                const canRequest = remainingAfterRequest >= 0;

                return (
                  <div className={`border rounded-lg p-4 ${canRequest ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <div className="flex items-center mb-2">
                      <Calculator className="h-4 w-4 mr-2 text-blue-400" />
                      <p className="text-blue-300 text-sm font-semibold">Calcolo Giorni Richiesti</p>
                    </div>
                    <p className="text-blue-300 text-sm">
                      <strong>Periodo:</strong> {daysRequested} {daysRequested === 1 ? 'giorno' : 'giorni'}
                    </p>
                    <p className="text-blue-300 text-sm">
                      <strong>Giorni rimanenti dopo questa richiesta:</strong> {remainingAfterRequest} {remainingAfterRequest === 1 ? 'giorno' : 'giorni'}
                    </p>
                    {!canRequest && (
                      <p className="text-red-300 text-sm mt-2 font-semibold">
                        ⚠️ Giorni di ferie insufficienti per questa richiesta
                      </p>
                    )}
                    {periodValidationError && (
                      <p className="text-red-300 text-sm mt-2 font-semibold">
                        ⚠️ {periodValidationError}
                      </p>
                    )}
                    {availablePeriods.length > 0 && !periodValidationError && (
                      <div className="mt-3 pt-3 border-t border-blue-500/20">
                        <p className="text-blue-200 text-xs mb-2">Periodi disponibili:</p>
                        {availablePeriods.map(period => (
                          <div key={period.id} className="text-blue-300 text-xs mb-1">
                            • {period.name}: dal {new Date(period.vacation_start_date).toLocaleDateString('it-IT')} al {new Date(period.vacation_end_date).toLocaleDateString('it-IT')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}



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

      {/* Filtri Collassabili - Solo nella vista lista */}
      {activeView === 'list' && (
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
              {/* Filtro temporale per admin - solo nella vista lista */}
              {user?.role === 'admin' && activeView === 'list' && (
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
                  placeholder={activeView === 'calendar' ? "Cerca per nome dipendente..." : "Cerca per note o stato..."}
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
      )}

      {/* Vista Calendario */}
      {activeView === 'calendar' && (
        <VacationCalendar
          vacationRequests={vacationRequests}
          onDateClick={(date, requests) => {
            console.log('Data selezionata:', date, 'Richieste:', requests);
            // Qui puoi aggiungere logica per mostrare dettagli della data
          }}
        />
      )}

      {/* Requests List */}
      {activeView === 'list' && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center">
            <FileText className="h-6 w-6 mr-3 text-slate-400" />
            {user?.role === 'admin' ? 'Gestione Richieste Ferie' : 'Storico Richieste Ferie'}
          </h2>

          {(() => {
            // Logica di filtraggio e raggruppamento simile a Permessi.jsx

            // 1. Richieste "Da Approvare" (Pending) - Globali (ignorano filtro mese, rispettano filtro ricerca)
            const pendingRequests = vacationRequests.filter(req => {
              const matchesSearch = !searchTerm || (
                (req.notes && req.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (req.submittedBy && req.submittedBy.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (req.status && req.status.toLowerCase().includes(searchTerm.toLowerCase()))
              );
              return req.status === 'pending' && matchesSearch;
            });

            // 2. Richieste Approvate/Rifiutate - Divise in "In Programma" e "Storico"
            // Queste rispettano SIA il filtro ricerca SIA il filtro mese/anno (se admin)

            const approvedRequests = vacationRequests.filter(req => {
              // Escludi pending
              if (req.status === 'pending') return false;

              // Filtro ricerca
              const matchesSearch = !searchTerm || (
                (req.notes && req.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (req.submittedBy && req.submittedBy.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (req.status && req.status.toLowerCase().includes(searchTerm.toLowerCase()))
              );
              if (!matchesSearch) return false;

              // Filtro mese/anno (solo per admin, come da logica originale)
              // Se utente normale, mostra tutto (o logica diversa?)
              // Nella logica originale: if (user?.role === 'admin' && activeView === 'list') { filter by date }
              if (user?.role === 'admin') {
                const requestDate = new Date(req.startDate);
                return requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear;
              }

              return true;
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const upcomingRequests = approvedRequests.filter(req => new Date(req.endDate) >= today);
            const pastRequests = approvedRequests.filter(req => new Date(req.endDate) < today);

            // Funzione helper per renderizzare una card
            const renderRequestCard = (request, isPast = false) => (
              <div key={request.id} className={`${isPast ? 'bg-slate-800 border border-slate-700 opacity-75 hover:opacity-100' : 'bg-slate-700'} rounded-lg p-6 hover:bg-slate-600 transition-all duration-200 mb-4`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      {/* Icona stato diversa per passato */}
                      {isPast && request.status === 'approved' ? (
                        <CheckCircle className="h-5 w-5 text-slate-400" />
                      ) : (
                        getStatusIcon(request.status)
                      )}

                      <h3 className={`text-lg font-semibold ml-2 ${isPast ? 'text-slate-400' : 'text-white'}`}>
                        {isPast ? 'Ferie Passate' : 'Richiesta Ferie'}
                      </h3>

                      <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium border ${isPast ? 'bg-slate-700 text-slate-400 border-slate-600' : getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                    </div>
                    {user?.role === 'admin' && request.submittedBy && (
                      <div className="mb-3">
                        <div className="flex items-center text-sm text-slate-300">
                          <Users className="h-4 w-4 mr-2 text-slate-400" />
                          <span className="font-medium text-white">{request.submittedBy}</span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                        <span className={isPast ? 'text-slate-400' : 'text-white'}>Dal {formatDate(request.startDate)} al {formatDate(request.endDate)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-slate-400" />
                        <span>{calculateDays(request.startDate, request.endDate)} giorni</span>
                      </div>
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
                      <div className="mt-3 p-3 bg-slate-600/50 rounded-lg">
                        <p className="text-slate-300 text-sm">
                          <strong>Note:</strong> {request.notes}
                        </p>
                      </div>
                    )}

                    {/* Pulsanti di approvazione per admin - solo per richieste pending (che non dovrebbero essere qui se isPast=true ma per sicurezza) */}
                    {user?.role === 'admin' && request.status === 'pending' && (
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => {
                            const notes = prompt('Note per l\'approvazione (opzionale):');
                            handleApproveRequest(request.id, notes || '');
                          }}
                          className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approva
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt('Motivo del rifiuto (opzionale):');
                            handleRejectRequest(request.id, notes || '');
                          }}
                          className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Rifiuta
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );

            if (pendingRequests.length === 0 && upcomingRequests.length === 0 && pastRequests.length === 0) {
              return (
                <div className="text-center py-12">
                  <Plane className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">
                    {user?.role === 'admin'
                      ? `Nessuna richiesta per ${monthNames[currentMonth]} ${currentYear}`
                      : 'Nessuna richiesta di ferie presente'
                    }
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    Clicca su "Nuova Richiesta" per iniziare
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-8">
                {/* 1. SEZIONE DA APPROVARE (Priorità Alta) */}
                {pendingRequests.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-yellow-500/30">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      <h3 className="text-lg font-bold text-yellow-500">Da Approvare ({pendingRequests.length})</h3>
                    </div>
                    {pendingRequests.map(req => renderRequestCard(req))}
                  </div>
                )}

                {/* 2. SEZIONE IN PROGRAMMA */}
                {upcomingRequests.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <h3 className="text-lg font-bold text-white">In Programma ({upcomingRequests.length})</h3>
                    </div>
                    {upcomingRequests.map(req => renderRequestCard(req))}
                  </div>
                )}

                {/* 3. SEZIONE STORICO PASSATE (Collassabile) */}
                {pastRequests.length > 0 && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setHistoryExpanded(!historyExpanded)}
                      className="w-full flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-700 hover:bg-slate-800/50 p-2 rounded transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <List className="h-5 w-5 text-slate-500 group-hover:text-slate-400" />
                        <h3 className="text-lg font-bold text-slate-500 group-hover:text-slate-400">Storico Passate ({pastRequests.length})</h3>
                      </div>
                      {historyExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-500" />
                      )}
                    </button>

                    {historyExpanded && (
                      <div className="animate-fadeIn space-y-4 pl-0 sm:pl-4 border-l-2 border-slate-800">
                        {pastRequests.map(req => renderRequestCard(req, true))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal Admin Crea Ferie per Dipendente */}
      <AdminCreateVacationModal
        isOpen={showAdminCreateModal}
        onClose={() => setShowAdminCreateModal(false)}
        onSuccess={() => {
          fetchVacationRequests();
          // Mostra un alert di successo se disponibile
        }}
      />
    </div>
  );
};

export default Vacation;
