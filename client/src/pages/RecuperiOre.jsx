import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useOvertimeBalance } from '../hooks/useOvertimeBalance';
import { formatHours, calculateNetWorkHours } from '../utils/hoursCalculation';
import { RecuperiOreSkeleton } from '../components/Skeleton';
import {
  RefreshCw,
  Plus,
  AlertCircle,
  Timer,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Users,
  Wallet,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  ArrowDownUp,
  FileText,
  CheckCircle2,
  Trash2,
  Edit2,
  Ban,
  Info
} from 'lucide-react';

const RecuperiOre = () => {
  const { user, apiCall } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Dati per recupero ore (dipendente)
  // Usa hook centralizzato per saldo banca ore
  const currentYear = new Date().getFullYear();
  const { balance: totalBalance, status: balanceStatus, debtHours, creditHours, refetch: refetchBalance } = useOvertimeBalance({
    year: currentYear,
    autoFetch: user?.role === 'employee'
  });
  const [recoveryRequests, setRecoveryRequests] = useState([]); // Richieste recupero
  const [showRecoveryModal, setShowRecoveryModal] = useState(false); // Modal crea richiesta recupero
  const [recoveryStep, setRecoveryStep] = useState(1); // Step corrente del wizard (1: Data, 2: Ore, 3: Orario)
  const [recoveryFormData, setRecoveryFormData] = useState({
    recoveryDate: '', // Step 1: Data recupero
    hours: '', // Step 2: Ore da recuperare (numero intero)
    minutes: '0', // Step 2: Minuti da recuperare (0 o 30)
    startTime: '', // Step 3: Orario inizio
    endTime: '', // Step 3: Orario fine
    reason: '',
    notes: ''
  });
  const [suggestedTimeSlots, setSuggestedTimeSlots] = useState([]); // Slot orari suggeriti

  // Dati per admin gestione recuperi
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'completed'
  const [pendingRecoveryRequests, setPendingRecoveryRequests] = useState([]); // Richieste in attesa (admin)
  const [completedRecoveryRequests, setCompletedRecoveryRequests] = useState([]); // Richieste completate/passate (admin)
  const [showApproveRecoveryModal, setShowApproveRecoveryModal] = useState(false);
  const [showRejectRecoveryModal, setShowRejectRecoveryModal] = useState(false);
  const [selectedRecoveryId, setSelectedRecoveryId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [userWorkSchedule, setUserWorkSchedule] = useState([]); // Orario di lavoro dell'utente loggato

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (user?.role === 'admin') {
          await fetchPendingRecoveryRequests();
        } else {
          // Il saldo viene caricato automaticamente dall'hook useOvertimeBalance
          // Carica sempre le richieste di recupero, anche se non c'è debito
          // (potrebbero esserci recuperi già approvati o in attesa)
          await fetchRecoveryRequests();
          await fetchUserSchedule();
        }
      } catch (error) {
        console.error('Error loading recovery data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Polling automatico per dipendenti: aggiorna balance ogni 30 secondi
    // così vedono subito quando l'admin aggiunge crediti ore
    let balancePollingInterval = null;
    if (user?.role === 'employee') {
      balancePollingInterval = setInterval(() => {
        console.log('🔄 Polling automatico balance per dipendente...');
        refetchBalance();
      }, 30000); // Ogni 30 secondi
    }

    return () => {
      if (balancePollingInterval) {
        clearInterval(balancePollingInterval);
      }
    };
  }, [user]); // Rimuovo refetchBalance dalle dipendenze per evitare loop infinito

  // Fetch richieste recupero ore
  const fetchRecoveryRequests = async () => {
    try {
      const response = await apiCall('/api/recovery-requests');
      if (response.ok) {
        const data = await response.json();
        setRecoveryRequests(data || []);
      }
    } catch (error) {
      console.error('Error fetching recovery requests:', error);
    }
  };

  // Fetch orario di lavoro dell'utente per calcolo pause
  const fetchUserSchedule = async () => {
    try {
      const response = await apiCall('/api/work-schedules');
      if (response.ok) {
        const data = await response.json();
        setUserWorkSchedule(data || []);
      }
    } catch (error) {
      console.error('Error fetching user schedule:', error);
    }
  };

  // Fetch richieste recupero in attesa (admin)
  const fetchPendingRecoveryRequests = async () => {
    try {
      const [pendingResponse, proposedResponse, approvedResponse, completedResponse] = await Promise.all([
        apiCall('/api/recovery-requests?status=pending'),
        apiCall('/api/recovery-requests?status=proposed'),
        apiCall('/api/recovery-requests?status=approved'),
        apiCall('/api/recovery-requests?status=completed')
      ]);

      const pendingData = pendingResponse.ok ? await pendingResponse.json() : [];
      const proposedData = proposedResponse.ok ? await proposedResponse.json() : [];
      const approvedData = approvedResponse.ok ? await approvedResponse.json() : [];
      const completedData = completedResponse.ok ? await completedResponse.json() : [];

      // Separa approved in future (non processati) e completed (processati o passati)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const pendingApproved = (approvedData || []).filter(r => {
        if (r.balance_added) return false; // Già processati vanno in completed
        const recoveryDate = new Date(r.recovery_date);
        recoveryDate.setHours(0, 0, 0, 0);
        const isFuture = recoveryDate > today || (recoveryDate.getTime() === today.getTime() && r.end_time > currentTime);
        return isFuture; // Solo future o in corso
      });

      // I recuperi completati includono:
      // 1. Recuperi con status='completed' (già processati)
      // 2. Recuperi con status='approved' ma balance_added=true (processati)
      // 3. Recuperi con status='approved' ma data/orario passati (non ancora processati ma passati)
      const completedFromApproved = (approvedData || []).filter(r => {
        if (r.balance_added) return true; // Già processati
        const recoveryDate = new Date(r.recovery_date);
        recoveryDate.setHours(0, 0, 0, 0);
        const isPast = recoveryDate < today || (recoveryDate.getTime() === today.getTime() && r.end_time <= currentTime);
        return isPast; // Passati o completati oggi
      });

      const allCompleted = [...(completedData || []), ...completedFromApproved];

      const allRequests = [
        ...(pendingData || []),
        ...(proposedData || []),
        ...pendingApproved
      ];
      setPendingRecoveryRequests(allRequests);
      setCompletedRecoveryRequests(allCompleted);
    } catch (error) {
      console.error('Error fetching pending recovery requests:', error);
    }
  };


  // Approva richiesta recupero (admin)
  const handleApproveRecovery = async () => {
    try {
      if (!selectedRecoveryId) return;

      const response = await apiCall(`/api/recovery-requests/${selectedRecoveryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'approved'
        })
      });

      if (response.ok) {
        alert('Richiesta recupero approvata con successo!');
        setShowApproveRecoveryModal(false);
        setSelectedRecoveryId(null);
        await fetchPendingRecoveryRequests();
      } else {
        const error = await response.json();
        alert(error.error || 'Errore nell\'approvazione della richiesta');
      }
    } catch (error) {
      console.error('Error approving recovery request:', error);
      alert('Errore nell\'approvazione della richiesta');
    }
  };

  // Rifiuta richiesta recupero (admin)

  const handleRejectRecovery = async () => {
    try {
      if (!selectedRecoveryId) return;

      const response = await apiCall(`/api/recovery-requests/${selectedRecoveryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'rejected',
          rejectionReason: rejectionReason || ''
        })
      });

      if (response.ok) {
        alert('Richiesta recupero rifiutata');
        setShowRejectRecoveryModal(false);
        setSelectedRecoveryId(null);
        setRejectionReason('');
        await fetchPendingRecoveryRequests();
      } else {
        const error = await response.json();
        alert(error.error || 'Errore nel rifiuto della richiesta');
      }
    } catch (error) {
      console.error('Error rejecting recovery request:', error);
      alert('Errore nel rifiuto della richiesta');
    }
  };

  // Funzione helper per calcolare endTime da startTime + ore
  const calculateEndTime = (startTime, hours) => {
    if (!startTime || !hours) return '';
    const hoursToAdd = parseFloat(hours);

    // Recupera la pausa dell'utente per il giorno selezionato
    const dateStr = recoveryFormData.recoveryDate || proposalFormData.recoveryDate;
    const dayOfWeek = dateStr ? new Date(dateStr).getDay() : null;
    const daySchedule = dayOfWeek !== null ? userWorkSchedule.find(s => s.day_of_week === dayOfWeek) : null;

    const breakStart = daySchedule?.break_start_time || '13:00';
    const breakDuration = (daySchedule?.break_duration !== null && daySchedule?.break_duration !== undefined) ? daySchedule.break_duration : 60;

    const parseTimeToMinutes = (t) => {
      if (!t) return 0;
      const tStr = String(t);
      const [h, m] = tStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    let currentMinutes = parseTimeToMinutes(startTime);
    let remainingMinutes = Math.round(hoursToAdd * 60);

    const bStart = parseTimeToMinutes(breakStart);
    const bDuration = parseInt(breakDuration, 10) || 0;
    const bEnd = bStart + bDuration;

    // Forza timeout di sicurezza
    let iterations = 0;
    while (remainingMinutes > 0 && iterations < 1440) {
      iterations++;
      // Se siamo prima della pausa e il prossimo pezzetto di lavoro incrocia o tocca la pausa
      if (bDuration > 0 && currentMinutes < bStart) {
        const minutesUntilBreak = bStart - currentMinutes;
        const canWork = Math.min(minutesUntilBreak, remainingMinutes);
        currentMinutes += canWork;
        remainingMinutes -= canWork;
      }
      // Se siamo esattamente all'inizio della pausa o dentro, saltiamo alla fine
      else if (bDuration > 0 && currentMinutes >= bStart && currentMinutes < bEnd) {
        currentMinutes = bEnd;
      }
      // Altrimenti lavoriamo tutto il resto
      else {
        currentMinutes += remainingMinutes;
        remainingMinutes = 0;
      }
    }

    const endH = Math.floor(currentMinutes / 60) % 24;
    const endM = currentMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  // Funzione helper per calcolare ore da startTime e endTime
  const calculateHours = (startTime, endTime) => {
    if (!startTime || !endTime) return '';

    const dateStr = recoveryFormData.recoveryDate || proposalFormData.recoveryDate;
    const dayOfWeek = dateStr ? new Date(dateStr).getDay() : null;
    const daySchedule = dayOfWeek !== null ? userWorkSchedule.find(s => s.day_of_week === dayOfWeek) : null;

    const breakStart = daySchedule?.break_start_time || '13:00';
    const breakDuration = (daySchedule?.break_duration !== null && daySchedule?.break_duration !== undefined) ? daySchedule.break_duration : 60;

    const hours = calculateNetWorkHours(startTime, endTime, breakStart, breakDuration);
    return hours > 0 ? hours.toFixed(2) : '';
  };

  // Funzione helper per formattare ore in "Xh Ymin"
  const formatHoursFromDecimal = (hours) => {
    if (!hours || hours === '') return '';
    const h = Math.floor(Math.abs(parseFloat(hours)));
    const m = Math.round((Math.abs(parseFloat(hours)) - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  // Converte ore e minuti in decimale (per invio al backend)
  const hoursMinutesToDecimal = (hours, minutes) => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    return h + (m / 60);
  };

  // Converte decimale in ore e minuti (per visualizzazione/modifica)
  const decimalToHoursMinutes = (decimal) => {
    if (!decimal || decimal === '') return { hours: '', minutes: '0' };
    const total = Math.abs(parseFloat(decimal));
    const h = Math.floor(total);
    const m = Math.round((total - h) * 60);
    // Arrotonda i minuti a 0 o 30
    const roundedMinutes = m <= 15 ? 0 : m >= 45 ? 0 : 30;
    return { hours: h.toString(), minutes: roundedMinutes.toString() };
  };

  // Genera slot orari suggeriti basati sulle ore selezionate
  const generateTimeSlots = (hours) => {
    if (!hours || parseFloat(hours) <= 0) return [];

    const hoursNum = parseFloat(hours);
    const slots = [];

    // Genera slot ogni ora dalle 8:00 alle 18:00
    for (let startHour = 8; startHour <= 18 - Math.ceil(hoursNum); startHour++) {
      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const endTime = calculateEndTime(startTime, hoursNum.toString());
      if (endTime) {
        slots.push({ startTime, endTime, label: `${startTime} - ${endTime}` });
      }
    }

    return slots;
  };

  // Avanza al prossimo step del wizard (dipendente)
  const handleNextStep = () => {
    if (recoveryStep === 1) {
      // Validazione step 1: data
      if (!recoveryFormData.recoveryDate) {
        alert('Seleziona una data per il recupero');
        return;
      }
      setRecoveryStep(2);
    } else if (recoveryStep === 2) {
      // Validazione step 2: ore da recuperare
      const hours = parseInt(recoveryFormData.hours) || 0;
      const minutes = parseInt(recoveryFormData.minutes) || 0;
      
      if (!recoveryFormData.hours || hours <= 0) {
        alert('Inserisci le ore da recuperare');
        return;
      }
      
      if (totalBalance >= 0) {
        alert('Non hai debiti da recuperare');
        return;
      }
      
      const totalHoursDecimal = hoursMinutesToDecimal(hours, minutes);
      const maxHours = Math.abs(totalBalance);
      
      if (totalHoursDecimal > maxHours) {
        alert(`Puoi recuperare massimo ${formatHoursFromDecimal(maxHours.toString())} (il tuo debito attuale)`);
        return;
      }
      
      // Genera slot suggeriti
      setSuggestedTimeSlots(generateTimeSlots(totalHoursDecimal));
      setRecoveryStep(3);
    }
  };

  // Avanza al prossimo step del wizard (admin)
  const handleProposalNextStep = () => {
    if (proposalStep === 1) {
      // Validazione step 1: data
      if (!proposalFormData.recoveryDate) {
        alert('Seleziona una data per il recupero');
        return;
      }
      setProposalStep(2);
    } else if (proposalStep === 2) {
      // Validazione step 2: ore da recuperare
      const hours = parseInt(proposalFormData.hours) || 0;
      const minutes = parseInt(proposalFormData.minutes) || 0;
      
      if (!proposalFormData.hours || hours <= 0) {
        alert('Inserisci le ore da recuperare');
        return;
      }
      if (!selectedEmployeeForProposal) return;

      const totalHoursDecimal = hoursMinutesToDecimal(hours, minutes);

      // Se è nella tab "Debiti", limita alle ore di debito
      // Se è nella tab "Proposte", non c'è limite (può proporre straordinari anche in positivo)
      if (activeTab === 'debt') {
        const employeeDebt = Math.abs(selectedEmployeeForProposal.debtHours || selectedEmployeeForProposal.totalBalance || 0);
        if (totalHoursDecimal > employeeDebt) {
          alert(`Il dipendente può recuperare massimo ${formatHoursFromDecimal(employeeDebt.toString())} (il suo debito attuale)`);
          return;
        }
      }
      // Per la tab "Proposte", non c'è limite - può proporre qualsiasi quantità di straordinari

      // Genera slot suggeriti
      setProposalSuggestedTimeSlots(generateTimeSlots(totalHoursDecimal));
      setProposalStep(3);
    }
  };

  // Torna allo step precedente (admin)
  const handleProposalPrevStep = () => {
    if (proposalStep > 1) {
      setProposalStep(proposalStep - 1);
    }
  };

  // Seleziona uno slot orario suggerito (admin)
  const handleSelectProposalTimeSlot = (slot) => {
    setProposalFormData({
      ...proposalFormData,
      startTime: slot.startTime,
      endTime: slot.endTime
    });
  };

  // Torna allo step precedente
  const handlePrevStep = () => {
    if (recoveryStep > 1) {
      setRecoveryStep(recoveryStep - 1);
    }
  };

  // Seleziona uno slot orario suggerito
  const handleSelectTimeSlot = (slot) => {
    setRecoveryFormData({
      ...recoveryFormData,
      startTime: slot.startTime,
      endTime: slot.endTime
    });
  };

  // Crea richiesta recupero ore
  const handleCreateRecoveryRequest = async () => {
    try {
      const { recoveryDate, startTime, endTime, hours, minutes, reason, notes } = recoveryFormData;

      // Validazione finale
      if (!recoveryDate || !startTime || !endTime) {
        alert('Compila tutti i campi obbligatori');
        return;
      }

      // Converti ore e minuti in decimale
      const requestedHoursDecimal = hoursMinutesToDecimal(hours, minutes);

      // Verifica che le ore selezionate corrispondano ESATTAMENTE al range orario
      const calculatedHours = parseFloat(calculateHours(startTime, endTime));

      if (Math.abs(calculatedHours - requestedHoursDecimal) > 0.01) {
        alert(`Il range orario selezionato (${formatHoursFromDecimal(calculatedHours.toString())}) deve corrispondere ESATTAMENTE alle ore richieste (${formatHoursFromDecimal(requestedHoursDecimal.toString())}). Le ore devono tornare matematicamente.`);
        return;
      }

      const response = await apiCall('/api/recovery-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recoveryDate,
          startTime,
          endTime: endTime,
          hours: requestedHoursDecimal, // Invia come decimale
          reason,
          notes
        })
      });

      if (response.ok) {
        alert('Richiesta recupero ore creata con successo!');
        setShowRecoveryModal(false);
        setRecoveryStep(1);
        setRecoveryFormData({
          recoveryDate: '',
          startTime: '',
          endTime: '',
          hours: '',
          minutes: '0',
          reason: '',
          notes: ''
        });
        setSuggestedTimeSlots([]);
        await fetchRecoveryRequests();
        await refetchBalance();
      } else {
        const error = await response.json();
        alert(error.error || 'Errore nella creazione della richiesta');
      }
    } catch (error) {
      console.error('Error creating recovery request:', error);
      alert('Errore nella creazione della richiesta');
    }
  };

  if (loading) {
    return <RecuperiOreSkeleton />;
  }

  // Vista Dipendente
  if (user?.role === 'employee') {
    const approvedRecoveries = recoveryRequests.filter(r => r.status === 'approved' && !r.balance_added);
    const pendingRecoveries = recoveryRequests.filter(r => r.status === 'pending');
    const proposedRecoveries = recoveryRequests.filter(r => r.status === 'proposed');

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center mb-2">
              <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-amber-400" />
              Recupero Ore
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              Richiedi di recuperare le ore di debito attraverso straordinari concordati
            </p>
          </div>
        </div>

        {/* KPI Cards - Layout migliorato */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Saldo Banca Ore - Card principale */}
          <div className={`rounded-xl p-6 border-2 transition-all ${totalBalance < 0 
            ? 'bg-red-900/50 border-red-500 shadow-lg shadow-red-500/5' 
            : totalBalance > 0 
            ? 'bg-gradient-to-br from-green-900/15 to-green-800/10 border-green-500/30 shadow-lg shadow-green-500/5' 
            : 'bg-zinc-900 border-zinc-800'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Saldo Banca Ore</h3>
              <div className={`p-2 rounded-lg ${totalBalance < 0 ? 'bg-red-500/10' : totalBalance > 0 ? 'bg-green-500/10' : 'bg-zinc-800'}`}>
                <Wallet className={`h-5 w-5 ${totalBalance < 0 ? 'text-red-400' : totalBalance > 0 ? 'text-green-400' : 'text-slate-400'}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold mb-1 ${totalBalance < 0 ? 'text-red-400' : totalBalance > 0 ? 'text-green-400' : 'text-white'}`}>
              {totalBalance < 0 ? '-' : totalBalance > 0 ? '+' : ''}{formatHours(Math.abs(totalBalance))}
            </p>
            <p className={`text-xs font-medium ${totalBalance < 0 ? 'text-red-300/80' : totalBalance > 0 ? 'text-green-300/80' : 'text-slate-400'}`}>
              {totalBalance < 0 ? 'Debito da recuperare' : totalBalance > 0 ? 'Credito disponibile' : 'Saldo in pari'}
            </p>
          </div>

          {/* Recuperi Attivi */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Recuperi Attivi</h3>
              <div className="p-2 rounded-lg bg-zinc-800/50">
                <Timer className="h-5 w-5 text-slate-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-300 mb-1">
              {approvedRecoveries.length + pendingRecoveries.length + proposedRecoveries.length}
            </p>
            <p className="text-xs text-slate-400 font-medium">Richieste programmate</p>
          </div>

          {/* Pulsante CTA - Solo se c'è debito */}
          {totalBalance < 0 && (
            <div className="sm:col-span-2 lg:col-span-1 flex items-center">
              <button
                onClick={() => setShowRecoveryModal(true)}
                className="w-full h-full flex flex-col items-center justify-center px-6 py-4 bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl transition-all font-semibold shadow-lg hover:shadow-xl border border-amber-500/50 min-h-[120px]"
              >
                <Plus className="h-8 w-8 mb-2" />
                <span className="text-base">Nuova Richiesta</span>
                <span className="text-xs opacity-90">Recupero Ore</span>
              </button>
            </div>
          )}
        </div>

        {/* Alert Box - Solo se c'è debito */}
        {totalBalance < 0 && (
          <div className="bg-orange-600/20 border-l-4 border-orange-400 rounded-lg p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-amber-400 mt-0.5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">Hai un debito da recuperare</h3>
                <p className="text-amber-100 text-sm leading-relaxed">
                  Il tuo saldo banca ore è <span className="font-bold text-amber-300">{formatHours(Math.abs(totalBalance))}</span> in negativo.
                  Puoi richiedere di recuperare queste ore attraverso straordinari concordati con l'amministratore.
                  Una volta approvata la richiesta, potrai lavorare negli orari indicati per compensare il debito.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messaggio se in regola */}
        {totalBalance >= 0 && (approvedRecoveries.length === 0 && pendingRecoveries.length === 0 && proposedRecoveries.length === 0) && (
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/20 border-l-4 border-green-500 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-400 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Banca Ore in Regola</h3>
                <p className="text-slate-300 text-sm">
                  Non hai debiti da recuperare. Il tuo saldo è {totalBalance > 0 ? `positivo di ${formatHours(totalBalance)}` : 'in pari'}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Spiegazione Processo Recupero Ore */}
        {totalBalance < 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center mb-4">
              <Info className="h-6 w-6 mr-3 text-slate-400" />
              <h3 className="text-lg font-bold text-white">Come Funziona il Recupero Ore</h3>
            </div>
            
            <div className="space-y-4">
              {/* Timeline Richiesta Dipendente */}
              <div className="border-l-2 border-zinc-700 pl-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">Fai una Richiesta</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Compila il form con data, ore e orario desiderato. La richiesta viene inviata all'amministratore per l'approvazione.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">In Attesa di Approvazione</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      La tua richiesta è in attesa. L'amministratore la esaminerà e potrà approvarla o rifiutarla.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">Approvata</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Una volta approvata, lavora negli orari indicati. Le ore recuperate verranno aggiunte automaticamente al tuo saldo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Separatore */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-700"></div>
                <span className="text-xs text-slate-500 font-medium">OPPURE</span>
                <div className="flex-1 h-px bg-slate-700"></div>
              </div>

              {/* Timeline Proposta Admin */}
              <div className="border-l-2 border-purple-500 pl-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">L'Admin Propone un Recupero</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      L'amministratore può proporti direttamente un recupero ore con data, orario e durata specifici.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">Accetta o Rifiuta</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Puoi accettare la proposta (diventa automaticamente approvata) o rifiutarla se non ti va bene.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white mb-1">Recupero Confermato</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Se accetti, lavora negli orari proposti. Le ore verranno aggiunte al tuo saldo dopo il recupero.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recuperi Programmati */}
        {(approvedRecoveries.length > 0 || pendingRecoveries.length > 0 || proposedRecoveries.length > 0) ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white flex items-center mb-2">
                <Timer className="h-6 w-6 mr-3 text-slate-400" />
                Recuperi Programmati
              </h3>
              <p className="text-sm text-slate-400 ml-9">
                Le tue richieste di recupero ore e le proposte dell'amministratore
              </p>
            </div>

            {approvedRecoveries.length > 0 && (
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <h4 className="text-base font-semibold text-green-400">Approvati ({approvedRecoveries.length})</h4>
                </div>
                {approvedRecoveries.map((recovery) => (
                  <div key={recovery.id} className="bg-green-500/10 border-l-4 border-green-500 rounded-lg p-4 hover:bg-green-500/15 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-green-400" />
                          <div className="text-white font-semibold">
                            {new Date(recovery.recovery_date).toLocaleDateString('it-IT', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-green-300 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>Dalle {recovery.start_time} alle {recovery.end_time}</span>
                          <span className="text-green-400 font-semibold ml-2">({formatHours(recovery.hours)})</span>
                        </div>
                        {recovery.reason && (
                          <div className="text-slate-400 text-xs mt-2 pl-6">{recovery.reason}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        <div className="bg-green-500/20 px-3 py-1 rounded-full">
                          <span className="text-green-400 font-bold text-lg">+{formatHours(recovery.hours)}</span>
                        </div>
                        <span className="text-xs text-green-400/70">Approvato</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingRecoveries.length > 0 && (
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="h-5 w-5 text-yellow-400" />
                  <h4 className="text-base font-semibold text-yellow-400">In attesa di approvazione ({pendingRecoveries.length})</h4>
                </div>
                {pendingRecoveries.map((recovery) => (
                  <div key={recovery.id} className="bg-yellow-500/10 border-l-4 border-yellow-500 rounded-lg p-4 hover:bg-yellow-500/15 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-yellow-400" />
                          <div className="text-white font-semibold">
                            {new Date(recovery.recovery_date).toLocaleDateString('it-IT', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-yellow-300 text-sm">
                          <Clock className="h-4 w-4" />
                          <span>Dalle {recovery.start_time} alle {recovery.end_time}</span>
                          <span className="text-yellow-400 font-semibold ml-2">({formatHours(recovery.hours)})</span>
                        </div>
                        {recovery.reason && (
                          <div className="text-slate-400 text-xs mt-2 pl-6">{recovery.reason}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        <div className="bg-yellow-500/20 px-3 py-1 rounded-full">
                          <span className="text-yellow-400 font-bold text-lg">{formatHours(recovery.hours)}</span>
                        </div>
                        <span className="text-xs text-yellow-400/70">In attesa</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {proposedRecoveries.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-slate-400" />
                  <h4 className="text-base font-semibold text-slate-300">Proposte dall'amministratore ({proposedRecoveries.length})</h4>
                </div>
                {proposedRecoveries.map((recovery) => (
                  <div key={recovery.id} className="bg-zinc-900 border-l-4 border-zinc-700 rounded-lg p-4 hover:bg-zinc-900/80 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <div className="text-white font-semibold">
                            {new Date(recovery.recovery_date).toLocaleDateString('it-IT', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 text-sm mb-2">
                          <Clock className="h-4 w-4" />
                          <span>Dalle {recovery.start_time} alle {recovery.end_time}</span>
                          <span className="text-slate-300 font-semibold ml-2">({formatHours(recovery.hours)})</span>
                        </div>
                        {recovery.reason && (
                          <div className="text-slate-400 text-xs mt-2 pl-6">{recovery.reason}</div>
                        )}
                        {recovery.notes && (
                          <div className="text-slate-300 text-xs mt-2 pl-6 italic bg-zinc-800 p-2 rounded">{recovery.notes}</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={async () => {
                            try {
                              const response = await apiCall(`/api/recovery-requests/${recovery.id}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  status: 'approved'
                                })
                              });

                              if (response.ok) {
                                alert('Proposta recupero accettata!');
                                await fetchRecoveryRequests();
                              } else {
                                const error = await response.json();
                                alert(error.error || 'Errore nell\'accettazione della proposta');
                              }
                            } catch (error) {
                              console.error('Error accepting proposal:', error);
                              alert('Errore nell\'accettazione della proposta');
                            }
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors min-h-[44px]"
                        >
                          Accetta
                        </button>
                        <button
                          onClick={async () => {
                            const reason = prompt('Motivo del rifiuto (opzionale):');
                            try {
                              const response = await apiCall(`/api/recovery-requests/${recovery.id}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  status: 'rejected',
                                  rejectionReason: reason || ''
                                })
                              });

                              if (response.ok) {
                                alert('Proposta recupero rifiutata');
                                await fetchRecoveryRequests();
                              } else {
                                const error = await response.json();
                                alert(error.error || 'Errore nel rifiuto della proposta');
                              }
                            } catch (error) {
                              console.error('Error rejecting proposal:', error);
                              alert('Errore nel rifiuto della proposta');
                            }
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors min-h-[44px]"
                        >
                          Rifiuta
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Modal Crea Richiesta Recupero */}
        {showRecoveryModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRecoveryModal(false);
                setRecoveryStep(1);
                setRecoveryFormData({
                  recoveryDate: '',
                  hours: '',
                  minutes: '0',
                  reason: '',
                  notes: ''
                });
              }
            }}
          >
            <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => {
                  setShowRecoveryModal(false);
                  setRecoveryStep(1);
                  setRecoveryFormData({
                    recoveryDate: '',
                    hours: '',
                    minutes: '0',
                    reason: '',
                    notes: ''
                  });
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                aria-label="Chiudi"
              >
                <XCircle className="h-6 w-6" />
              </button>
              <h3 className="text-xl font-bold text-white mb-4 pr-8">Nuova Richiesta Recupero Ore</h3>

              {/* Indicatore step */}
              <div className="flex items-center justify-center mb-6 gap-2">
                <div className={`flex items-center ${recoveryStep >= 1 ? 'text-amber-400' : 'text-slate-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${recoveryStep >= 1 ? 'bg-amber-500' : 'bg-slate-600'}`}>
                    {recoveryStep > 1 ? '✓' : '1'}
                  </div>
                  <span className="ml-2 text-sm font-medium">Data</span>
                </div>
                <div className={`w-12 h-0.5 ${recoveryStep >= 2 ? 'bg-amber-500' : 'bg-slate-600'}`}></div>
                <div className={`flex items-center ${recoveryStep >= 2 ? 'text-amber-400' : 'text-slate-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${recoveryStep >= 2 ? 'bg-amber-500' : 'bg-slate-600'}`}>
                    {recoveryStep > 2 ? '✓' : '2'}
                  </div>
                  <span className="ml-2 text-sm font-medium">Ore</span>
                </div>
                <div className={`w-12 h-0.5 ${recoveryStep >= 3 ? 'bg-amber-500' : 'bg-slate-600'}`}></div>
                <div className={`flex items-center ${recoveryStep >= 3 ? 'text-amber-400' : 'text-slate-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${recoveryStep >= 3 ? 'bg-amber-500' : 'bg-slate-600'}`}>
                    3
                  </div>
                  <span className="ml-2 text-sm font-medium">Orario</span>
                </div>
              </div>

              {/* Step 1: Data recupero */}
              {recoveryStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Quale giorno vuoi recuperare? *
                    </label>
                    <input
                      type="date"
                      value={recoveryFormData.recoveryDate}
                      onChange={(e) => setRecoveryFormData({ ...recoveryFormData, recoveryDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 text-lg"
                    />
                  </div>

                  {recoveryFormData.recoveryDate && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                      <p className="text-sm text-slate-300">
                        📅 Data selezionata: <strong>{new Date(recoveryFormData.recoveryDate).toLocaleDateString('it-IT')}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Ore da recuperare */}
              {recoveryStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Quante ore vuoi recuperare? *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Ore</label>
                        <select
                          value={recoveryFormData.hours}
                          onChange={(e) => setRecoveryFormData({ ...recoveryFormData, hours: e.target.value === '' ? '' : parseInt(e.target.value) || '' })}
                          className="w-full h-[42px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 text-base"
                        >
                          <option value="">Seleziona ore</option>
                          {Array.from({ length: Math.min(8, Math.floor(Math.abs(totalBalance))) }, (_, i) => i + 1).map(hours => (
                            <option key={hours} value={hours}>{hours} {hours === 1 ? 'ora' : 'ore'}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Minuti</label>
                        <select
                          value={recoveryFormData.minutes}
                          onChange={(e) => setRecoveryFormData({ ...recoveryFormData, minutes: e.target.value })}
                          className="w-full h-[42px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 text-base"
                        >
                          <option value="0">0 min</option>
                          <option value="30">30 min</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Debito attuale: <span className="text-red-400 font-semibold">{formatHours(Math.abs(totalBalance))}</span>
                    </p>
                  </div>

                  {recoveryFormData.hours && parseInt(recoveryFormData.hours) > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      <p className="text-sm text-amber-400 font-medium">
                        ✅ Hai selezionato <strong>{formatHoursFromDecimal(hoursMinutesToDecimal(recoveryFormData.hours, recoveryFormData.minutes).toString())}</strong> per il <strong>{recoveryFormData.recoveryDate ? new Date(recoveryFormData.recoveryDate).toLocaleDateString('it-IT') : '...'}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Orario */}
              {recoveryStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Seleziona l'orario ({formatHoursFromDecimal(hoursMinutesToDecimal(recoveryFormData.hours, recoveryFormData.minutes).toString())})
                    </label>

                    {/* Slot suggeriti */}
                    {suggestedTimeSlots.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-400 mb-2">Suggerimenti automatici:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {suggestedTimeSlots.map((slot, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSelectTimeSlot(slot)}
                              className={`px-3 py-2 rounded-lg border transition-colors text-sm ${recoveryFormData.startTime === slot.startTime && recoveryFormData.endTime === slot.endTime
                                ? 'bg-amber-500 border-amber-400 text-white'
                                : 'bg-zinc-800 border-zinc-700 text-slate-300 hover:bg-zinc-700'
                                }`}
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Input manuale */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Da</label>
                        <input
                          type="time"
                          value={recoveryFormData.startTime}
                          onChange={(e) => {
                            const newStartTime = e.target.value;
                            const totalHoursDecimal = hoursMinutesToDecimal(recoveryFormData.hours, recoveryFormData.minutes);
                            const newEndTime = calculateEndTime(newStartTime, totalHoursDecimal.toString());
                            setRecoveryFormData({
                              ...recoveryFormData,
                              startTime: newStartTime,
                              endTime: newEndTime || ''
                            });
                          }}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">A</label>
                        <input
                          type="time"
                          value={recoveryFormData.endTime}
                          onChange={(e) => {
                            const newEndTime = e.target.value;
                            const calculatedHours = calculateHours(recoveryFormData.startTime, newEndTime);
                            const requestedHoursDecimal = hoursMinutesToDecimal(recoveryFormData.hours, recoveryFormData.minutes);

                            if (calculatedHours && Math.abs(parseFloat(calculatedHours) - requestedHoursDecimal) > 0.01) {
                              alert(`Il range orario deve corrispondere ESATTAMENTE alle ${formatHoursFromDecimal(requestedHoursDecimal.toString())} richieste. Range selezionato: ${formatHoursFromDecimal(calculatedHours)}`);
                              // Reimposta endTime calcolato automaticamente
                              const autoEndTime = calculateEndTime(recoveryFormData.startTime, requestedHoursDecimal.toString());
                              setRecoveryFormData({
                                ...recoveryFormData,
                                endTime: autoEndTime || ''
                              });
                              return;
                            }

                            setRecoveryFormData({
                              ...recoveryFormData,
                              endTime: newEndTime
                            });
                          }}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                        />
                      </div>
                    </div>

                    {recoveryFormData.startTime && recoveryFormData.endTime && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                        <p className="text-sm text-green-400 font-medium">
                          ✅ Range selezionato: <strong>{recoveryFormData.startTime} - {recoveryFormData.endTime}</strong> ({formatHoursFromDecimal(calculateHours(recoveryFormData.startTime, recoveryFormData.endTime) || '0')})
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Motivo e Note (solo nello step 3) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Motivo</label>
                    <textarea
                      value={recoveryFormData.reason}
                      onChange={(e) => setRecoveryFormData({ ...recoveryFormData, reason: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                      placeholder="Motivo della richiesta di recupero ore..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Note</label>
                    <textarea
                      value={recoveryFormData.notes}
                      onChange={(e) => setRecoveryFormData({ ...recoveryFormData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                      placeholder="Note aggiuntive..."
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-between mt-6">
                {recoveryStep > 1 ? (
                  <button
                    onClick={handlePrevStep}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
                  >
                    Indietro
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowRecoveryModal(false);
                      setRecoveryStep(1);
                      setRecoveryFormData({
                        recoveryDate: '',
                        startTime: '',
                        endTime: '',
                        hours: '',
                        minutes: '0',
                        reason: '',
                        notes: ''
                      });
                      setSuggestedTimeSlots([]);
                    }}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
                  >
                    Annulla
                  </button>
                )}

                {recoveryStep < 3 ? (
                  <button
                    onClick={handleNextStep}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[44px] ml-auto"
                  >
                    Avanti
                  </button>
                ) : (
                  <button
                    onClick={handleCreateRecoveryRequest}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[44px] ml-auto"
                  >
                    Invia Richiesta
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vista Admin
  const toApproveRequests = pendingRecoveryRequests.filter(r => r && (r.status === 'pending' || r.status === 'proposed'));
  const approvedFutureRequests = pendingRecoveryRequests.filter(r => r && r.status === 'approved' && !r.balance_added);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
          <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-amber-400" />
          Recuperi
        </h1>
      </div>

      {/* Tab Navigation Principale */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="flex gap-2 border-b border-slate-700 p-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'pending'
              ? 'text-amber-400 border-amber-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
          >
            <Clock className="h-4 w-4 inline mr-2" />
            Da approvare ({toApproveRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'approved'
              ? 'text-green-400 border-green-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
          >
            <CheckCircle className="h-4 w-4 inline mr-2" />
            Approvate ({approvedFutureRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'completed'
              ? 'text-blue-400 border-blue-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
          >
            <CheckCircle2 className="h-4 w-4 inline mr-2" />
            Completate ({completedRecoveryRequests.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Tab: Da Approvare */}
          {activeTab === 'pending' && (
            <div>
              {toApproveRequests.length > 0 ? (
                <div className="space-y-3">
                  {toApproveRequests.map((recovery) => {
                    const dateObj = new Date(recovery.recovery_date);
                    const day = dateObj.getDate();
                    const month = dateObj.toLocaleString('it-IT', { month: 'short' }).replace('.', '').toUpperCase();

                    return (
                      <div key={recovery.id} className="group bg-zinc-900 rounded-lg border border-zinc-800/50 p-3 hover:border-amber-500/30 transition-all hover:shadow-lg hover:shadow-amber-500/5 hover:bg-zinc-900/80 border-l-4 border-l-amber-500">
                        <div className="flex items-center gap-3">
                          {/* SINISTRA: Data Icon */}
                          <div className="flex-shrink-0">
                            <div className="p-1.5 rounded-lg flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shadow-inner transition-transform bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <span className="text-lg sm:text-xl font-bold leading-none">{day}</span>
                              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-80">{month}</span>
                            </div>
                          </div>

                          {/* CENTRO: Dettagli */}
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                  Recupero Ore
                                </span>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                  {recovery.status === 'pending' ? 'In Attesa Admin' : 'In Attesa Dipendente'}
                                </span>
                              </div>

                              <h3 className="text-sm font-semibold text-white mb-0.5 group-hover:text-amber-300 transition-colors truncate">
                                {recovery.users?.first_name} {recovery.users?.last_name}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-0.5 rounded">
                                  <Clock className="w-3 h-3 text-slate-300" />
                                  <span className="font-medium text-slate-200">{formatHours(recovery.hours)}</span>
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-0.5 rounded">
                                  <Clock className="w-3 h-3 text-slate-300" />
                                  <span className="font-medium text-slate-200">
                                    {recovery.start_time.substring(0, 5)} - {recovery.end_time.substring(0, 5)}
                                  </span>
                                </span>
                              </div>

                              {recovery.reason && (
                                <div className="mt-1 text-[10px] bg-zinc-950/30 p-1.5 rounded border border-zinc-800/50 max-w-md">
                                  <p className="text-slate-400 line-clamp-1">
                                    <span className="font-semibold text-slate-500 mr-1 uppercase tracking-tighter text-[8px]">Motivo:</span>
                                    {recovery.reason}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* DESTRA: Azioni */}
                            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                              {recovery.status === 'pending' && (
                                <div className="flex flex-col gap-1.5">
                                  <button
                                    onClick={() => {
                                      setSelectedRecoveryId(recovery.id);
                                      setShowApproveRecoveryModal(true);
                                    }}
                                    className="flex items-center justify-center px-3 py-1.5 bg-green-600/90 hover:bg-green-600 text-white rounded-lg transition-all font-semibold text-[11px] gap-1.5 active:scale-95"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Approva
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedRecoveryId(recovery.id);
                                      setRejectionReason('');
                                      setShowRejectRecoveryModal(true);
                                    }}
                                    className="flex items-center justify-center px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-all font-semibold text-[11px] gap-1.5 active:scale-95"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Rifiuta
                                  </button>
                                </div>
                              )}

                              {recovery.status === 'proposed' && (
                                <div className="text-xs text-slate-400 font-medium text-center py-2 italic">
                                  In attesa del dipendente
                                </div>
                              )}

                              <button
                                onClick={async () => {
                                  if (window.confirm('Sei sicuro di voler eliminare questa richiesta?')) {
                                    try {
                                      const response = await apiCall(`/api/recovery-requests/${recovery.id}`, {
                                        method: 'DELETE'
                                      });
                                      if (response.ok) {
                                        alert('Richiesta eliminata con successo');
                                        await fetchPendingRecoveryRequests();
                                      } else {
                                        const error = await response.json();
                                        alert(error.error || 'Errore nell\'eliminazione');
                                      }
                                    } catch (e) {
                                      console.error('Delete error:', e);
                                      alert('Errore nell\'eliminazione');
                                    }
                                  }
                                }}
                                className="flex items-center justify-center px-3 py-1.5 bg-zinc-800 hover:bg-red-900/40 text-slate-300 hover:text-red-400 rounded-lg transition-all border border-zinc-700 font-medium text-[10px] gap-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                Elimina
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Nessuna richiesta da approvare</p>
                  <p className="text-sm">Tutte le richieste sono state processate</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Approvate (Future) */}
          {activeTab === 'approved' && (
            <div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-slate-400 mr-3 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-300 mb-1">Elaborazione Banca Ore</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Le ore delle richieste approvate verranno aggiunte automaticamente al saldo banca ore del dipendente solo <strong>dopo il passaggio della data e dell'orario di fine</strong> della sessione di recupero/straordinario.
                    </p>
                  </div>
                </div>
              </div>

              {approvedFutureRequests.length > 0 ? (
                <div className="space-y-3">
                  {approvedFutureRequests.map((recovery) => {
                    const dateObj = new Date(recovery.recovery_date);
                    const day = dateObj.getDate();
                    const month = dateObj.toLocaleString('it-IT', { month: 'short' }).replace('.', '').toUpperCase();

                    return (
                      <div key={recovery.id} className="group bg-zinc-900/40 rounded-lg border border-green-500/10 p-3 hover:border-green-500/30 transition-all border-l-2 border-l-green-500/50">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="p-1.5 rounded-lg flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-green-500/10 text-green-400 border border-green-500/20">
                              <span className="text-lg sm:text-xl font-bold leading-none">{day}</span>
                              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-80">{month}</span>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-green-500/10 text-green-400 border-green-500/20">
                                  Recupero Ore
                                </span>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-green-500/10 text-green-400 border-green-500/20">
                                  Approvata (Programmata)
                                </span>
                              </div>

                              <h3 className="text-sm font-semibold text-white mb-0.5 group-hover:text-green-300 transition-colors truncate">
                                {recovery.users?.first_name} {recovery.users?.last_name}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-0.5 rounded">
                                  <Clock className="w-3 h-3 text-green-400" />
                                  <span className="font-semibold text-slate-200">{formatHours(recovery.hours)}</span>
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-0.5 rounded">
                                  <Clock className="w-3 h-3 text-green-400" />
                                  <span className="font-semibold text-slate-200">
                                    {recovery.start_time.substring(0, 5)} - {recovery.end_time.substring(0, 5)}
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="flex-shrink-0">
                              <button
                                onClick={async () => {
                                  if (window.confirm('Sei sicuro di voler eliminare questa richiesta?')) {
                                    try {
                                      const response = await apiCall(`/api/recovery-requests/${recovery.id}`, {
                                        method: 'DELETE'
                                      });
                                      if (response.ok) {
                                        alert('Richiesta eliminata con successo');
                                        await fetchPendingRecoveryRequests();
                                      } else {
                                        const error = await response.json();
                                        alert(error.error || 'Errore nell\'eliminazione');
                                      }
                                    } catch (e) {
                                      console.error('Delete error:', e);
                                      alert('Errore nell\'eliminazione');
                                    }
                                  }
                                }}
                                className="flex items-center justify-center px-3 py-1.5 bg-zinc-800 hover:bg-red-900/40 text-slate-300 hover:text-red-400 rounded-lg transition-all border border-zinc-700 font-medium text-[10px] gap-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                Elimina
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Nessuna richiesta approvata programmata</p>
                  <p className="text-sm">Le richieste approvate future appariranno qui</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Completate (Past) */}
          {activeTab === 'completed' && (
            <div>
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-white mb-1">Recuperi Completati</h4>
                <p className="text-sm text-slate-400">Recuperi passati e già elaborati, ordinati dal più recente</p>
              </div>

              {completedRecoveryRequests.length > 0 ? (
                <div className="space-y-3">
                  {completedRecoveryRequests
                    .sort((a, b) => new Date(b.recovery_date) - new Date(a.recovery_date)) // Ordina per data decrescente
                    .map((recovery) => {
                      const dateObj = new Date(recovery.recovery_date);
                      const day = dateObj.getDate();
                      const month = dateObj.toLocaleString('it-IT', { month: 'short' }).replace('.', '').toUpperCase();

                      return (
                        <div key={recovery.id} className="group bg-zinc-900/40 rounded-lg border border-blue-500/10 p-3 hover:border-blue-500/30 transition-all border-l-2 border-l-blue-500/50">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              <div className="p-1.5 rounded-lg flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <span className="text-lg sm:text-xl font-bold leading-none">{day}</span>
                                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-80">{month}</span>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-blue-500/10 text-blue-400 border-blue-500/20">
                                    Recupero Ore
                                  </span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-blue-500/10 text-blue-400 border-blue-500/20">
                                    {recovery.balance_added ? 'Completata' : 'Elaborazione in corso'}
                                  </span>
                                </div>

                                <h3 className="text-sm font-semibold text-white mb-0.5 group-hover:text-blue-300 transition-colors truncate">
                                  {recovery.users?.first_name} {recovery.users?.last_name}
                                </h3>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                  <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-0.5 rounded">
                                    <Clock className="w-3 h-3 text-blue-400" />
                                    <span className="font-semibold text-slate-200">{formatHours(recovery.hours)}</span>
                                  </span>
                                  <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-0.5 rounded">
                                    <Clock className="w-3 h-3 text-blue-400" />
                                    <span className="font-semibold text-slate-200">
                                      {recovery.start_time.substring(0, 5)} - {recovery.end_time.substring(0, 5)}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Nessun recupero completato</p>
                  <p className="text-sm">I recuperi passati appariranno qui in ordine cronologico</p>
                </div>
              )}
            </div>
          )}


        </div>
      </div>

      {/* Modal Approva Recupero */}
      {
        showApproveRecoveryModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowApproveRecoveryModal(false);
                setSelectedRecoveryId(null);
              }
            }}
          >
            <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md relative">
              <button
                onClick={() => {
                  setShowApproveRecoveryModal(false);
                  setSelectedRecoveryId(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                aria-label="Chiudi"
              >
                <XCircle className="h-6 w-6" />
              </button>
              <h3 className="text-xl font-bold text-white mb-4 pr-8">Approva Richiesta Recupero</h3>
              <p className="text-slate-300 mb-6">Sei sicuro di voler approvare questa richiesta di recupero ore?</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowApproveRecoveryModal(false);
                    setSelectedRecoveryId(null);
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Annulla
                </button>
                <button
                  onClick={handleApproveRecovery}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Approva
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal Rifiuta Recupero */}
      {
        showRejectRecoveryModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRejectRecoveryModal(false);
                setSelectedRecoveryId(null);
                setRejectionReason('');
              }
            }}
          >
            <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md relative">
              <button
                onClick={() => {
                  setShowRejectRecoveryModal(false);
                  setSelectedRecoveryId(null);
                  setRejectionReason('');
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                aria-label="Chiudi"
              >
                <XCircle className="h-6 w-6" />
              </button>
              <h3 className="text-xl font-bold text-white mb-4 pr-8">Rifiuta Richiesta Recupero</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Motivo del rifiuto</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Motivo del rifiuto (opzionale)..."
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowRejectRecoveryModal(false);
                    setSelectedRecoveryId(null);
                    setRejectionReason('');
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Annulla
                </button>
                <button
                  onClick={handleRejectRecovery}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Rifiuta
                </button>
              </div>
            </div>
          </div>
        )
      }

    </div>
  );
};

export default RecuperiOre;
