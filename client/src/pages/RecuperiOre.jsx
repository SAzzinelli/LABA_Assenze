import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useOvertimeBalance } from '../hooks/useOvertimeBalance';
import { formatHours } from '../utils/hoursCalculation';
import { RecuperiOreSkeleton } from '../components/Skeleton';
import { 
  RefreshCw, 
  Plus, 
  AlertCircle, 
  Timer, 
  Clock,
  CheckCircle,
  XCircle,
  Calendar
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
    hours: '', // Step 2: Ore da recuperare
    startTime: '', // Step 3: Orario inizio
    endTime: '', // Step 3: Orario fine
    reason: '',
    notes: ''
  });
  const [suggestedTimeSlots, setSuggestedTimeSlots] = useState([]); // Slot orari suggeriti
  
  // Dati per admin gestione recuperi
  const [activeTab, setActiveTab] = useState('debt'); // 'debt', 'proposals' o 'add-hours'
  const [pendingRecoveryRequests, setPendingRecoveryRequests] = useState([]); // Richieste in attesa (admin)
  const [employeesWithDebt, setEmployeesWithDebt] = useState([]); // Dipendenti con debito (admin)
  const [allEmployees, setAllEmployees] = useState([]); // Tutti i dipendenti per la tab "Proposte"
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showApproveRecoveryModal, setShowApproveRecoveryModal] = useState(false);
  const [showRejectRecoveryModal, setShowRejectRecoveryModal] = useState(false);
  const [showProposeRecoveryModal, setShowProposeRecoveryModal] = useState(false);
  const [showAddHoursModal, setShowAddHoursModal] = useState(false); // Modal per aggiungere ore a credito
  const [selectedRecoveryId, setSelectedRecoveryId] = useState(null);
  const [selectedEmployeeForProposal, setSelectedEmployeeForProposal] = useState(null);
  const [selectedEmployeeForAddHours, setSelectedEmployeeForAddHours] = useState(null); // Dipendente selezionato per aggiungere ore
  const [rejectionReason, setRejectionReason] = useState('');
  const [proposalStep, setProposalStep] = useState(1); // Step corrente del wizard admin (1: Data, 2: Ore, 3: Orario)
  const [proposalFormData, setProposalFormData] = useState({
    recoveryDate: '', // Step 1: Data recupero
    hours: '', // Step 2: Ore da recuperare
    startTime: '', // Step 3: Orario inizio
    endTime: '', // Step 3: Orario fine
    reason: '',
    notes: ''
  });
  const [proposalSuggestedTimeSlots, setProposalSuggestedTimeSlots] = useState([]); // Slot orari suggeriti per admin
  const [addHoursFormData, setAddHoursFormData] = useState({
    hours: '', // Ore (numero intero)
    minutes: '', // Minuti (0-59)
    date: new Date().toISOString().split('T')[0], // Data di riferimento
    reason: '', // Motivo dell'aggiunta
    notes: '' // Note aggiuntive
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (user?.role === 'admin') {
          await fetchPendingRecoveryRequests();
          await fetchDebtSummary();
          await fetchAllEmployees();
        } else {
          // Il saldo viene caricato automaticamente dall'hook useOvertimeBalance
          // Carica sempre le richieste di recupero, anche se non c'è debito
          // (potrebbero esserci recuperi già approvati o in attesa)
          await fetchRecoveryRequests();
        }
      } catch (error) {
        console.error('Error loading recovery data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

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

  // Fetch richieste recupero in attesa (admin)
  const fetchPendingRecoveryRequests = async () => {
    try {
      const [pendingResponse, proposedResponse] = await Promise.all([
        apiCall('/api/recovery-requests?status=pending'),
        apiCall('/api/recovery-requests?status=proposed')
      ]);

      const pendingData = pendingResponse.ok ? await pendingResponse.json() : [];
      const proposedData = proposedResponse.ok ? await proposedResponse.json() : [];
      
      const allRequests = [...(pendingData || []), ...(proposedData || [])];
      setPendingRecoveryRequests(allRequests);
    } catch (error) {
      console.error('Error fetching pending recovery requests:', error);
    }
  };

  // Fetch dipendenti con debito (admin)
  const fetchDebtSummary = async () => {
    try {
      if (user?.role !== 'admin') return;
      
      const response = await apiCall('/api/recovery-requests/debt-summary');
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Debt summary response:', {
          success: data.success,
          totalEmployeesWithDebt: data.totalEmployeesWithDebt,
          totalDebtHours: data.totalDebtHours,
          employeesWithDebt: data.employeesWithDebt?.map(e => ({
            id: e.id,
            name: e.name || `${e.first_name} ${e.last_name}`,
            totalBalance: e.totalBalance,
            debtHours: e.debtHours
          }))
        });
        setEmployeesWithDebt(data.employeesWithDebt || []);
        console.log('✅ Debt summary loaded:', data.employeesWithDebt?.length || 0, 'employees with debt');
      } else {
        const errorText = await response.text();
        console.error('❌ Error fetching debt summary:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Error fetching debt summary:', error);
      setEmployeesWithDebt([]);
    }
  };

  // Fetch tutti i dipendenti per la tab "Proposte" (admin)
  const fetchAllEmployees = async () => {
    try {
      if (user?.role !== 'admin') return;
      
      setLoadingEmployees(true);
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        // Filtra solo dipendenti attivi
        const activeEmployees = data.filter(emp => emp.isActive !== false);
        
        // Carica il saldo banca ore per ogni dipendente
        // Aggiungi timestamp per forzare refresh cache
        const timestamp = Date.now();
        const employeesWithBalance = await Promise.all(
          activeEmployees.map(async (emp) => {
            try {
              // Aggiungi timestamp per evitare cache
              const balanceResponse = await apiCall(`/api/hours/overtime-balance?userId=${emp.id}&_t=${timestamp}`);
              if (balanceResponse.ok) {
                const balanceData = await balanceResponse.json();
                console.log(`💰 Balance ${emp.firstName || emp.first_name}: ${balanceData.balance}h`);
                return {
                  ...emp,
                  balance: balanceData.balance || 0,
                  status: balanceData.status || 'zero',
                  debtHours: balanceData.debtHours || 0,
                  creditHours: balanceData.creditHours || 0
                };
              }
              return { ...emp, balance: 0, status: 'zero', debtHours: 0, creditHours: 0 };
            } catch (error) {
              console.error(`Error fetching balance for ${emp.id}:`, error);
              return { ...emp, balance: 0, status: 'zero', debtHours: 0, creditHours: 0 };
            }
          })
        );
        
        setAllEmployees(employeesWithBalance);
        console.log('✅ All employees loaded for proposals:', employeesWithBalance.length);
      } else {
        console.error('❌ Error fetching all employees:', response.status);
        setAllEmployees([]);
      }
    } catch (error) {
      console.error('❌ Error fetching all employees:', error);
      setAllEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Proponi recupero ore a dipendente (admin)
  const handleProposeRecovery = async () => {
    try {
      if (!selectedEmployeeForProposal) return;
      const { recoveryDate, startTime, endTime, hours, reason, notes } = proposalFormData;

      // Validazione: serve data + (startTime+endTime) OPPURE (startTime+hours)
      if (!recoveryDate || !startTime) {
        alert('Compila data e orario di inizio');
        return;
      }

      let finalEndTime = endTime;
      let finalHours = hours;

      // Se è stato inserito il campo "ore", calcola endTime
      if (hours && hours !== '') {
        finalEndTime = calculateEndTime(startTime, hours);
        if (!finalEndTime) {
          alert('Errore nel calcolo dell\'orario di fine');
          return;
        }
      } 
      // Se è stato inserito endTime, calcola le ore
      else if (endTime && endTime !== '') {
        finalHours = calculateHours(startTime, endTime);
        if (!finalHours || parseFloat(finalHours) <= 0) {
          alert('L\'orario di fine deve essere successivo all\'orario di inizio');
          return;
        }
      } else {
        alert('Inserisci o l\'orario di fine o le ore da recuperare');
        return;
      }

      const response = await apiCall('/api/recovery-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedEmployeeForProposal.id,
          recoveryDate,
          startTime,
          endTime: finalEndTime,
          reason,
          notes
        })
      });

      if (response.ok) {
        alert('Proposta recupero ore inviata con successo!');
        setShowProposeRecoveryModal(false);
        setProposalStep(1);
        setProposalFormData({
          recoveryDate: '',
          startTime: '',
          endTime: '',
          hours: '',
          reason: '',
          notes: ''
        });
        setProposalSuggestedTimeSlots([]);
        setSelectedEmployeeForProposal(null);
        await fetchPendingRecoveryRequests();
        await fetchDebtSummary();
      } else {
        const error = await response.json();
        alert(error.error || 'Errore nell\'invio della proposta');
      }
    } catch (error) {
      console.error('Error proposing recovery:', error);
      alert('Errore nell\'invio della proposta');
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
        await fetchDebtSummary();
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
  // Aggiungi ore a credito direttamente (admin)
  const handleAddHours = async () => {
    try {
      if (!selectedEmployeeForAddHours) return;
      const { hours, minutes, date, reason, notes } = addHoursFormData;

      // Validazione
      const hoursNum = parseInt(hours) || 0;
      const minutesNum = parseInt(minutes) || 0;

      if (hoursNum < 0 || minutesNum < 0 || minutesNum >= 60) {
        alert('Inserisci valori validi: ore >= 0, minuti tra 0 e 59');
        return;
      }

      if (hoursNum === 0 && minutesNum === 0) {
        alert('Inserisci almeno 1 minuto da aggiungere');
        return;
      }

      if (!date) {
        alert('Seleziona una data');
        return;
      }

      // Converti ore + minuti in formato decimale (es. 2h 30min = 2.5)
      const totalHoursDecimal = hoursNum + (minutesNum / 60);

      const response = await apiCall('/api/recovery-requests/add-credit-hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedEmployeeForAddHours.id,
          hours: totalHoursDecimal,
          date: date,
          reason: reason || 'Ore aggiunte manualmente dall\'amministratore',
          notes: notes || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        const hoursText = hoursNum > 0 ? `${hoursNum}h` : '';
        const minutesText = minutesNum > 0 ? `${minutesNum}min` : '';
        const totalText = [hoursText, minutesText].filter(Boolean).join(' ');
        
        console.log('✅ Ore aggiunte con successo:', data);
        console.log('💰 Nuovo balance:', data.newBalance);
        
        // Forza refresh completo con delay per assicurarsi che il database sia aggiornato
        // Refresh multiplo per essere sicuri che i dati vengano aggiornati
        setTimeout(async () => {
          console.log('🔄 Ricarica dati dopo aggiunta ore (tentativo 1)...');
          await fetchAllEmployees();
          await fetchDebtSummary();
          if (selectedEmployeeForAddHours.id === user?.id) {
            await refetchBalance();
          }
        }, 300);
        
        setTimeout(async () => {
          console.log('🔄 Ricarica dati dopo aggiunta ore (tentativo 2)...');
          await fetchAllEmployees();
          await fetchDebtSummary();
          if (selectedEmployeeForAddHours.id === user?.id) {
            await refetchBalance();
          }
          console.log('✅ Dati ricaricati');
        }, 1000);
        
        alert(`✅ ${totalText} aggiunte con successo a ${selectedEmployeeForAddHours.first_name} ${selectedEmployeeForAddHours.last_name}${data.newBalance !== undefined ? `\nNuovo saldo: ${data.newBalance.toFixed(2)}h` : ''}`);
        
        // Chiudi modal e resetta form
        setShowAddHoursModal(false);
        setSelectedEmployeeForAddHours(null);
        setAddHoursFormData({
          hours: '',
          minutes: '',
          date: new Date().toISOString().split('T')[0],
          reason: '',
          notes: ''
        });
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.error || 'Errore durante l\'aggiunta delle ore'}`);
      }
    } catch (error) {
      console.error('Error adding credit hours:', error);
      alert('Errore durante l\'aggiunta delle ore');
    }
  };

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
        await fetchDebtSummary();
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
    const [hoursPart, minutesPart] = startTime.split(':').map(Number);
    const totalMinutes = hoursPart * 60 + minutesPart;
    const hoursToAdd = parseFloat(hours);
    const minutesToAdd = Math.round(hoursToAdd * 60);
    const newTotalMinutes = totalMinutes + minutesToAdd;
    const newHours = Math.floor(newTotalMinutes / 60) % 24;
    const newMinutes = newTotalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  // Funzione helper per calcolare ore da startTime e endTime
  const calculateHours = (startTime, endTime) => {
    if (!startTime || !endTime) return '';
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const diffMinutes = endMinutes - startMinutes;
    if (diffMinutes <= 0) return '';
    return (diffMinutes / 60).toFixed(2);
  };

  // Funzione helper per formattare ore in "Xh Ymin"
  const formatHoursFromDecimal = (hours) => {
    if (!hours || hours === '') return '';
    const h = Math.floor(Math.abs(parseFloat(hours)));
    const m = Math.round((Math.abs(parseFloat(hours)) - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
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
      const hours = parseFloat(recoveryFormData.hours);
      if (!recoveryFormData.hours || hours <= 0) {
        alert('Inserisci le ore da recuperare');
        return;
      }
      if (totalBalance >= 0) {
        alert('Non hai debiti da recuperare');
        return;
      }
      const maxHours = Math.abs(totalBalance);
      if (hours > maxHours) {
        alert(`Puoi recuperare massimo ${formatHoursFromDecimal(maxHours.toString())} (il tuo debito attuale)`);
        return;
      }
      // Genera slot suggeriti
      setSuggestedTimeSlots(generateTimeSlots(hours));
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
      const hours = parseFloat(proposalFormData.hours);
      if (!proposalFormData.hours || hours <= 0) {
        alert('Inserisci le ore da recuperare');
        return;
      }
      if (!selectedEmployeeForProposal) return;
      
      // Se è nella tab "Debiti", limita alle ore di debito
      // Se è nella tab "Proposte", non c'è limite (può proporre straordinari anche in positivo)
      if (activeTab === 'debt') {
        const employeeDebt = Math.abs(selectedEmployeeForProposal.debtHours || selectedEmployeeForProposal.totalBalance || 0);
        if (hours > employeeDebt) {
          alert(`Il dipendente può recuperare massimo ${formatHoursFromDecimal(employeeDebt.toString())} (il suo debito attuale)`);
          return;
        }
      }
      // Per la tab "Proposte", non c'è limite - può proporre qualsiasi quantità di straordinari
      
      // Genera slot suggeriti
      setProposalSuggestedTimeSlots(generateTimeSlots(hours));
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
      const { recoveryDate, startTime, endTime, hours, reason, notes } = recoveryFormData;

      // Validazione finale
      if (!recoveryDate || !startTime || !endTime) {
        alert('Compila tutti i campi obbligatori');
        return;
      }

      // Verifica che le ore selezionate corrispondano ESATTAMENTE al range orario
      const calculatedHours = parseFloat(calculateHours(startTime, endTime));
      const requestedHours = parseFloat(hours);
      
      if (Math.abs(calculatedHours - requestedHours) > 0.01) {
        alert(`Il range orario selezionato (${formatHoursFromDecimal(calculatedHours.toString())}) deve corrispondere ESATTAMENTE alle ore richieste (${formatHoursFromDecimal(requestedHours.toString())}). Le ore devono tornare matematicamente.`);
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
          endTime: finalEndTime,
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

        {/* KPI Cards - Saldo Banca Ore */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Saldo Totale */}
          <div className={`rounded-lg p-6 ${totalBalance < 0 ? 'bg-red-900/20 border border-red-500/30' : totalBalance > 0 ? 'bg-green-900/20 border border-green-500/30' : 'bg-slate-800 border border-slate-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Saldo Banca Ore</h3>
              <Clock className={`h-5 w-5 ${totalBalance < 0 ? 'text-red-400' : totalBalance > 0 ? 'text-green-400' : 'text-slate-400'}`} />
            </div>
            <p className={`text-2xl font-bold ${totalBalance < 0 ? 'text-red-400' : totalBalance > 0 ? 'text-green-400' : 'text-white'}`}>
              {totalBalance < 0 ? '-' : '+'}{formatHours(Math.abs(totalBalance))}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totalBalance < 0 ? 'Debito da recuperare' : totalBalance > 0 ? 'Credito disponibile' : 'In pari'}
            </p>
          </div>

          {/* Debito */}
          {totalBalance < 0 && (
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-amber-300">Debito Attuale</h3>
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-amber-400">
                {formatHours(Math.abs(totalBalance))}
              </p>
              <p className="text-xs text-amber-300/70 mt-1">Ore da recuperare</p>
            </div>
          )}

          {/* Credito */}
          {totalBalance > 0 && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-green-300">Credito Disponibile</h3>
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatHours(totalBalance)}
              </p>
              <p className="text-xs text-green-300/70 mt-1">Ore disponibili</p>
            </div>
          )}

          {/* Recuperi Totali */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-400">Recuperi Attivi</h3>
              <Timer className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {approvedRecoveries.length + pendingRecoveries.length + proposedRecoveries.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Richieste programmate</p>
          </div>
        </div>

        {/* Sezione Informazioni e Azioni */}
        {totalBalance < 0 && (
          <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/40 rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center mb-3">
                  <AlertCircle className="h-6 w-6 mr-3 text-amber-400" />
                  <h3 className="text-xl font-bold text-white">Hai un debito da recuperare</h3>
                </div>
                <div className="space-y-2 text-amber-100">
                  <p className="text-base">
                    Il tuo saldo banca ore è <span className="font-bold text-amber-300">{formatHours(Math.abs(totalBalance))}</span> in negativo.
                  </p>
                  <p className="text-sm text-amber-200/80">
                    Puoi richiedere di recuperare queste ore attraverso straordinari concordati con l'amministratore. 
                    Una volta approvata la richiesta, potrai lavorare negli orari indicati per compensare il debito.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRecoveryModal(true)}
                className="flex items-center justify-center px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[48px] font-semibold shadow-lg hover:shadow-xl"
              >
                <Plus className="h-5 w-5 mr-2" />
                Nuova Richiesta Recupero
              </button>
            </div>
          </div>
        )}

        {/* Messaggio se in regola */}
        {totalBalance >= 0 && (approvedRecoveries.length === 0 && pendingRecoveries.length === 0 && proposedRecoveries.length === 0) && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Banca Ore in Regola</h3>
            <p className="text-slate-400">
              Non hai debiti da recuperare. Il tuo saldo è {totalBalance > 0 ? `positivo di ${formatHours(totalBalance)}` : 'in pari'}.
            </p>
          </div>
        )}

        {/* Recuperi Programmati */}
        {(approvedRecoveries.length > 0 || pendingRecoveries.length > 0 || proposedRecoveries.length > 0) ? (
          <div className="bg-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center mb-1">
                  <Timer className="h-6 w-6 mr-3 text-blue-400" />
                  Recuperi Programmati
                </h3>
                <p className="text-sm text-slate-400 ml-9">
                  Le tue richieste di recupero ore e le proposte dell'amministratore
                </p>
              </div>
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
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                  <h4 className="text-base font-semibold text-blue-400">Proposte dall'amministratore ({proposedRecoveries.length})</h4>
                </div>
                {proposedRecoveries.map((recovery) => (
                  <div key={recovery.id} className="bg-blue-500/10 border-l-4 border-blue-500 rounded-lg p-4 hover:bg-blue-500/15 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          <div className="text-white font-semibold">
                            {new Date(recovery.recovery_date).toLocaleDateString('it-IT', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-blue-300 text-sm mb-2">
                          <Clock className="h-4 w-4" />
                          <span>Dalle {recovery.start_time} alle {recovery.end_time}</span>
                          <span className="text-blue-400 font-semibold ml-2">({formatHours(recovery.hours)})</span>
                        </div>
                        {recovery.reason && (
                          <div className="text-slate-400 text-xs mt-2 pl-6">{recovery.reason}</div>
                        )}
                        {recovery.notes && (
                          <div className="text-blue-200 text-xs mt-2 pl-6 italic bg-blue-500/10 p-2 rounded">{recovery.notes}</div>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-white mb-4">Nuova Richiesta Recupero Ore</h3>
              
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
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg"
                    />
                  </div>
                  
                  {recoveryFormData.recoveryDate && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <p className="text-sm text-blue-400">
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
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max={Math.abs(totalBalance)}
                      value={recoveryFormData.hours}
                      onChange={(e) => setRecoveryFormData({ ...recoveryFormData, hours: e.target.value })}
                      placeholder="es. 2.5"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Debito attuale: <span className="text-red-400 font-semibold">{formatHours(Math.abs(totalBalance))}</span>
                    </p>
                  </div>
                  
                  {recoveryFormData.hours && parseFloat(recoveryFormData.hours) > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      <p className="text-sm text-amber-400 font-medium">
                        ✅ Hai selezionato <strong>{formatHoursFromDecimal(recoveryFormData.hours)}</strong> per il <strong>{recoveryFormData.recoveryDate ? new Date(recoveryFormData.recoveryDate).toLocaleDateString('it-IT') : '...'}</strong>
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
                      Seleziona l'orario ({formatHoursFromDecimal(recoveryFormData.hours)})
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
                              className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                                recoveryFormData.startTime === slot.startTime && recoveryFormData.endTime === slot.endTime
                                  ? 'bg-amber-500 border-amber-400 text-white'
                                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
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
                            const newEndTime = calculateEndTime(newStartTime, recoveryFormData.hours);
                            setRecoveryFormData({ 
                              ...recoveryFormData, 
                              startTime: newStartTime,
                              endTime: newEndTime || ''
                            });
                          }}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                            const requestedHours = parseFloat(recoveryFormData.hours);
                            
                            if (calculatedHours && Math.abs(parseFloat(calculatedHours) - requestedHours) > 0.01) {
                              alert(`Il range orario deve corrispondere ESATTAMENTE alle ${formatHoursFromDecimal(recoveryFormData.hours)} richieste. Range selezionato: ${formatHoursFromDecimal(calculatedHours)}`);
                              // Reimposta endTime calcolato automaticamente
                              const autoEndTime = calculateEndTime(recoveryFormData.startTime, recoveryFormData.hours);
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
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Motivo della richiesta di recupero ore..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Note</label>
                    <textarea
                      value={recoveryFormData.notes}
                      onChange={(e) => setRecoveryFormData({ ...recoveryFormData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
          <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-amber-400" />
          Gestione Recuperi Ore
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center">
            <AlertCircle className="h-6 w-6 mr-3 text-red-400" />
            Gestione Recuperi Ore
          </h3>
        </div>
        
        {/* Tab Buttons */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('debt')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'debt'
                ? 'text-red-400 border-red-400'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            <AlertCircle className="h-4 w-4 inline mr-2" />
            Debiti ({employeesWithDebt.length})
          </button>
          <button
            onClick={() => setActiveTab('proposals')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'proposals'
                ? 'text-blue-400 border-blue-400'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Proposte Straordinari
          </button>
          <button
            onClick={() => setActiveTab('add-hours')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'add-hours'
                ? 'text-green-400 border-green-400'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            <CheckCircle className="h-4 w-4 inline mr-2" />
            Aggiungi Ore
          </button>
        </div>

        {/* Tab Content: Debiti */}
        {activeTab === 'debt' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Monitoraggio Debiti Banca Ore</h4>
              <div className="text-sm text-slate-400">
                {employeesWithDebt.length > 0 
                  ? `Totale: ${employeesWithDebt.length} dipendenti con debito`
                  : 'Nessun debito al momento'
                }
              </div>
            </div>
        {employeesWithDebt.length > 0 ? (
          <div className="space-y-3">
            {employeesWithDebt.map((employee) => (
              <div key={employee.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-semibold text-sm">
                          {employee.first_name?.[0] || ''}{employee.last_name?.[0] || ''}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">
                          {employee.first_name} {employee.last_name}
                        </h4>
                        <p className="text-red-300 text-sm">{employee.department || 'N/A'}</p>
                      </div>
                    </div>
                        <div className="text-slate-300 text-sm mt-2">
                          <div className="text-red-400 font-semibold">
                            Debito: {formatHours(employee.debtHours)}
                          </div>
                          <div className="text-slate-400 text-xs mt-1">
                            Saldo totale: {formatHours(employee.totalBalance)}
                          </div>
                        </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEmployeeForProposal(employee);
                      setProposalStep(1);
                      setProposalFormData({
                        recoveryDate: '',
                        startTime: '',
                        endTime: '',
                        hours: '',
                        reason: '',
                        notes: `Proposta recupero per ${formatHours(employee.debtHours)} di debito`
                      });
                      setProposalSuggestedTimeSlots([]);
                      setShowProposeRecoveryModal(true);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[44px] whitespace-nowrap"
                  >
                    Proponi Recupero
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <p className="text-lg mb-2">✅ Nessun dipendente con debito nella banca ore</p>
            <p className="text-sm">Tutti i dipendenti sono in regola o hanno un saldo positivo.</p>
          </div>
        )}
          </div>
        )}

        {/* Tab Content: Proposte Straordinari */}
        {activeTab === 'proposals' && (
          <div>
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-white mb-2">Proponi Straordinari a Qualsiasi Dipendente</h4>
              <p className="text-sm text-slate-400">
                Puoi proporre straordinari anche a dipendenti in pari o in positivo (es. eventi dopo cena, progetti speciali).
                Queste ore verranno aggiunte al saldo positivo della banca ore.
              </p>
            </div>

            {loadingEmployees ? (
              <div className="text-center py-8">
                <div className="text-slate-400">Caricamento dipendenti...</div>
              </div>
            ) : allEmployees.length > 0 ? (
              <div className="space-y-3">
                {allEmployees.map((employee) => (
                  <div 
                    key={employee.id} 
                    className={`rounded-lg p-4 border ${
                      employee.balance < 0
                        ? 'bg-red-500/10 border-red-500/20'
                        : employee.balance > 0
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-slate-700/50 border-slate-600'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                            employee.balance < 0
                              ? 'bg-red-500'
                              : employee.balance > 0
                                ? 'bg-green-500'
                                : 'bg-slate-500'
                          }`}>
                            <span className="text-white font-semibold text-sm">
                              {employee.firstName?.[0] || employee.first_name?.[0] || ''}
                              {employee.lastName?.[0] || employee.last_name?.[0] || ''}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-white font-semibold">
                              {employee.firstName || employee.first_name} {employee.lastName || employee.last_name}
                            </h4>
                            <p className="text-slate-300 text-sm">{employee.department || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="text-slate-300 text-sm mt-2">
                          <div className={`font-semibold ${
                            employee.balance < 0
                              ? 'text-red-400'
                              : employee.balance > 0
                                ? 'text-green-400'
                                : 'text-slate-400'
                          }`}>
                            Saldo attuale: {formatHours(employee.balance)}
                            {employee.balance < 0 && ` (Debito: ${formatHours(employee.debtHours)})`}
                            {employee.balance > 0 && ` (Credito: ${formatHours(employee.creditHours)})`}
                            {employee.balance === 0 && ' (In pari)'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedEmployeeForProposal({
                            id: employee.id,
                            first_name: employee.firstName || employee.first_name,
                            last_name: employee.lastName || employee.last_name,
                            department: employee.department,
                            balance: employee.balance,
                            debtHours: employee.debtHours || 0
                          });
                          setProposalStep(1);
                          setProposalFormData({
                            recoveryDate: '',
                            startTime: '',
                            endTime: '',
                            hours: '',
                            reason: '',
                            notes: employee.balance < 0 
                              ? `Proposta recupero per ${formatHours(employee.debtHours)} di debito`
                              : 'Proposta straordinario (es. evento dopo cena, progetto speciale)'
                          });
                          setProposalSuggestedTimeSlots([]);
                          setShowProposeRecoveryModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[44px] whitespace-nowrap"
                      >
                        <Plus className="h-4 w-4 inline mr-2" />
                        Proponi Straordinario
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>Nessun dipendente disponibile</p>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Aggiungi Ore */}
        {activeTab === 'add-hours' && (
          <div>
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-white mb-2">Aggiungi Ore a Credito</h4>
              <p className="text-sm text-slate-400">
                Aggiungi direttamente ore a credito alla banca ore di qualsiasi dipendente. 
                Queste ore influenzano positivamente il saldo e vengono aggiunte immediatamente.
              </p>
            </div>

            {loadingEmployees ? (
              <div className="text-center py-8">
                <div className="text-slate-400">Caricamento dipendenti...</div>
              </div>
            ) : allEmployees.length > 0 ? (
              <div className="space-y-3">
                {allEmployees.map((employee) => (
                  <div 
                    key={employee.id} 
                    className={`rounded-lg p-4 border ${
                      employee.balance < 0
                        ? 'bg-red-500/10 border-red-500/20'
                        : employee.balance > 0
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-slate-700/50 border-slate-600'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                            employee.balance < 0
                              ? 'bg-red-500'
                              : employee.balance > 0
                                ? 'bg-green-500'
                                : 'bg-slate-500'
                          }`}>
                            <span className="text-white font-semibold text-sm">
                              {employee.firstName?.[0] || employee.first_name?.[0] || ''}{employee.lastName?.[0] || employee.last_name?.[0] || ''}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-white font-semibold">
                              {employee.firstName || employee.first_name} {employee.lastName || employee.last_name}
                            </h4>
                            <p className="text-slate-300 text-sm">{employee.department || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="text-slate-300 text-sm mt-2">
                          <div className={`font-semibold ${
                            employee.balance < 0
                              ? 'text-red-400'
                              : employee.balance > 0
                                ? 'text-green-400'
                                : 'text-slate-400'
                          }`}>
                            Saldo attuale: {formatHours(employee.balance)}
                            {employee.balance < 0 && ` (Debito: ${formatHours(employee.debtHours)})`}
                            {employee.balance > 0 && ` (Credito: ${formatHours(employee.creditHours)})`}
                            {employee.balance === 0 && ' (In pari)'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedEmployeeForAddHours({
                            id: employee.id,
                            first_name: employee.firstName || employee.first_name,
                            last_name: employee.lastName || employee.last_name,
                            department: employee.department,
                            balance: employee.balance
                          });
                          setAddHoursFormData({
                            hours: '',
                            minutes: '',
                            date: new Date().toISOString().split('T')[0],
                            reason: '',
                            notes: ''
                          });
                          setShowAddHoursModal(true);
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors min-h-[44px] whitespace-nowrap"
                      >
                        <CheckCircle className="h-4 w-4 inline mr-2" />
                        Aggiungi Ore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>Nessun dipendente disponibile</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Richieste Recupero Ore in Attesa */}
      {pendingRecoveryRequests.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <Clock className="h-6 w-6 mr-3 text-amber-400" />
            Richieste Recupero Ore in Attesa
          </h3>
          <div className="space-y-3">
            {pendingRecoveryRequests.map((recovery) => (
              <div key={recovery.id} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-semibold text-sm">
                          {recovery.users?.first_name?.[0] || ''}{recovery.users?.last_name?.[0] || ''}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">
                          {recovery.users?.first_name} {recovery.users?.last_name}
                        </h4>
                        <p className="text-amber-300 text-sm">{recovery.users?.department || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-slate-300 text-sm mt-2">
                      <div>📅 Data: {new Date(recovery.recovery_date).toLocaleDateString('it-IT')}</div>
                      <div>⏰ Dalle {recovery.start_time} alle {recovery.end_time} ({formatHours(recovery.hours)})</div>
                      {recovery.reason && (
                        <div className="mt-1">💬 Motivo: {recovery.reason}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedRecoveryId(recovery.id);
                        setShowApproveRecoveryModal(true);
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors min-h-[44px]"
                    >
                      Approva
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRecoveryId(recovery.id);
                        setRejectionReason('');
                        setShowRejectRecoveryModal(true);
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
        </div>
      )}

      {/* Modal Approva Recupero */}
      {showApproveRecoveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Approva Richiesta Recupero</h3>
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
      )}

      {/* Modal Rifiuta Recupero */}
      {showRejectRecoveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Rifiuta Richiesta Recupero</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Motivo del rifiuto</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
      )}

      {/* Modal Proponi Recupero */}
      {showProposeRecoveryModal && selectedEmployeeForProposal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              Proponi Recupero per {selectedEmployeeForProposal.first_name} {selectedEmployeeForProposal.last_name}
            </h3>
            
            {/* Indicatore step */}
            <div className="flex items-center justify-center mb-6 gap-2">
              <div className={`flex items-center ${proposalStep >= 1 ? 'text-amber-400' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${proposalStep >= 1 ? 'bg-amber-500' : 'bg-slate-600'}`}>
                  {proposalStep > 1 ? '✓' : '1'}
                </div>
                <span className="ml-2 text-sm font-medium">Data</span>
              </div>
              <div className={`w-12 h-0.5 ${proposalStep >= 2 ? 'bg-amber-500' : 'bg-slate-600'}`}></div>
              <div className={`flex items-center ${proposalStep >= 2 ? 'text-amber-400' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${proposalStep >= 2 ? 'bg-amber-500' : 'bg-slate-600'}`}>
                  {proposalStep > 2 ? '✓' : '2'}
                </div>
                <span className="ml-2 text-sm font-medium">Ore</span>
              </div>
              <div className={`w-12 h-0.5 ${proposalStep >= 3 ? 'bg-amber-500' : 'bg-slate-600'}`}></div>
              <div className={`flex items-center ${proposalStep >= 3 ? 'text-amber-400' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${proposalStep >= 3 ? 'bg-amber-500' : 'bg-slate-600'}`}>
                  3
                </div>
                <span className="ml-2 text-sm font-medium">Orario</span>
              </div>
            </div>

            {/* Step 1: Data recupero */}
            {proposalStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Quale giorno vuoi proporre? *
                  </label>
                  <input
                    type="date"
                    value={proposalFormData.recoveryDate}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, recoveryDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg"
                  />
                </div>
                
                {proposalFormData.recoveryDate && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-sm text-blue-400">
                      📅 Data selezionata: <strong>{new Date(proposalFormData.recoveryDate).toLocaleDateString('it-IT')}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Ore da recuperare */}
            {proposalStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Quante ore vuoi proporre? *
                  </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max={activeTab === 'debt' ? Math.abs(selectedEmployeeForProposal.debtHours || selectedEmployeeForProposal.totalBalance || 0) : undefined}
                      value={proposalFormData.hours}
                      onChange={(e) => setProposalFormData({ ...proposalFormData, hours: e.target.value })}
                      placeholder="es. 2.5"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg"
                    />
                    {activeTab === 'debt' && (
                      <p className="text-xs text-slate-400 mt-1">
                        Debito dipendente: <span className="text-red-400 font-semibold">{formatHours(Math.abs(selectedEmployeeForProposal.debtHours || selectedEmployeeForProposal.totalBalance || 0))}</span>
                      </p>
                    )}
                    {activeTab === 'proposals' && (
                      <p className="text-xs text-slate-400 mt-1">
                        Saldo attuale: <span className={`font-semibold ${
                          (selectedEmployeeForProposal.balance || 0) < 0 ? 'text-red-400' :
                          (selectedEmployeeForProposal.balance || 0) > 0 ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {formatHours(selectedEmployeeForProposal.balance || 0)}
                        </span>
                        {selectedEmployeeForProposal.balance !== undefined && (
                          <span className="text-xs text-slate-500 ml-2">
                            (puoi proporre qualsiasi quantità di straordinari)
                          </span>
                        )}
                      </p>
                    )}
                </div>
                
                {proposalFormData.hours && parseFloat(proposalFormData.hours) > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-sm text-amber-400 font-medium">
                      ✅ Hai selezionato <strong>{formatHoursFromDecimal(proposalFormData.hours)}</strong> per il <strong>{proposalFormData.recoveryDate ? new Date(proposalFormData.recoveryDate).toLocaleDateString('it-IT') : '...'}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Orario */}
            {proposalStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Seleziona l'orario ({formatHoursFromDecimal(proposalFormData.hours)})
                  </label>
                  
                  {/* Slot suggeriti */}
                  {proposalSuggestedTimeSlots.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-400 mb-2">Suggerimenti automatici:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {proposalSuggestedTimeSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectProposalTimeSlot(slot)}
                            className={`px-3 py-2 rounded-lg border transition-colors text-sm ${
                              proposalFormData.startTime === slot.startTime && proposalFormData.endTime === slot.endTime
                                ? 'bg-amber-500 border-amber-400 text-white'
                                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
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
                        value={proposalFormData.startTime}
                        onChange={(e) => {
                          const newStartTime = e.target.value;
                          const newEndTime = calculateEndTime(newStartTime, proposalFormData.hours);
                          setProposalFormData({ 
                            ...proposalFormData, 
                            startTime: newStartTime,
                            endTime: newEndTime || ''
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">A</label>
                      <input
                        type="time"
                        value={proposalFormData.endTime}
                        onChange={(e) => {
                          const newEndTime = e.target.value;
                          const calculatedHours = calculateHours(proposalFormData.startTime, newEndTime);
                          const requestedHours = parseFloat(proposalFormData.hours);
                          
                          if (calculatedHours && Math.abs(parseFloat(calculatedHours) - requestedHours) > 0.01) {
                            alert(`Il range orario deve corrispondere ESATTAMENTE alle ${formatHoursFromDecimal(proposalFormData.hours)} richieste. Range selezionato: ${formatHoursFromDecimal(calculatedHours)}`);
                            // Reimposta endTime calcolato automaticamente
                            const autoEndTime = calculateEndTime(proposalFormData.startTime, proposalFormData.hours);
                            setProposalFormData({ 
                              ...proposalFormData, 
                              endTime: autoEndTime || ''
                            });
                            return;
                          }
                          
                          setProposalFormData({ 
                            ...proposalFormData, 
                            endTime: newEndTime
                          });
                        }}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  
                  {proposalFormData.startTime && proposalFormData.endTime && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                      <p className="text-sm text-green-400 font-medium">
                        ✅ Range selezionato: <strong>{proposalFormData.startTime} - {proposalFormData.endTime}</strong> ({formatHoursFromDecimal(calculateHours(proposalFormData.startTime, proposalFormData.endTime) || '0')})
                      </p>
                    </div>
                  )}
                </div>

                {/* Motivo e Note (solo nello step 3) */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Motivo</label>
                  <textarea
                    value={proposalFormData.reason}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Motivo della proposta di recupero ore..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Note</label>
                  <textarea
                    value={proposalFormData.notes}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Note aggiuntive..."
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-3 justify-between mt-6">
              {proposalStep > 1 ? (
                <button
                  onClick={handleProposalPrevStep}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Indietro
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowProposeRecoveryModal(false);
                    setSelectedEmployeeForProposal(null);
                    setProposalStep(1);
                    setProposalFormData({
                      recoveryDate: '',
                      startTime: '',
                      endTime: '',
                      hours: '',
                      reason: '',
                      notes: ''
                    });
                    setProposalSuggestedTimeSlots([]);
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Annulla
                </button>
              )}
              
              {proposalStep < 3 ? (
                <button
                  onClick={handleProposalNextStep}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[44px] ml-auto"
                >
                  Avanti
                </button>
              ) : (
                <button
                  onClick={handleProposeRecovery}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[44px] ml-auto"
                >
                  Invia Proposta
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Aggiungi Ore */}
      {showAddHoursModal && selectedEmployeeForAddHours && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              Aggiungi Ore a Credito
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              Aggiungi ore direttamente al saldo di <strong>{selectedEmployeeForAddHours.first_name} {selectedEmployeeForAddHours.last_name}</strong>.
              Le ore verranno aggiunte immediatamente come credito nella banca ore.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Ore e Minuti da aggiungere *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Ore</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={addHoursFormData.hours}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                        setAddHoursFormData({ ...addHoursFormData, hours: val.toString() });
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Minuti</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={addHoursFormData.minutes}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                        setAddHoursFormData({ ...addHoursFormData, minutes: val.toString() });
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Saldo attuale: <span className={`font-semibold ${
                    (selectedEmployeeForAddHours.balance || 0) < 0 ? 'text-red-400' :
                    (selectedEmployeeForAddHours.balance || 0) > 0 ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {formatHours(selectedEmployeeForAddHours.balance || 0)}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data di riferimento *
                </label>
                <input
                  type="date"
                  value={addHoursFormData.date}
                  onChange={(e) => setAddHoursFormData({ ...addHoursFormData, date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Motivo *
                </label>
                <textarea
                  value={addHoursFormData.reason}
                  onChange={(e) => setAddHoursFormData({ ...addHoursFormData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Motivo dell'aggiunta delle ore..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Note (opzionale)
                </label>
                <textarea
                  value={addHoursFormData.notes}
                  onChange={(e) => setAddHoursFormData({ ...addHoursFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Note aggiuntive..."
                />
              </div>

              {((addHoursFormData.hours && parseInt(addHoursFormData.hours) > 0) || (addHoursFormData.minutes && parseInt(addHoursFormData.minutes) > 0)) && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-sm text-green-400 font-medium">
                    ✅ Verranno aggiunte <strong>{(() => {
                      const h = parseInt(addHoursFormData.hours) || 0;
                      const m = parseInt(addHoursFormData.minutes) || 0;
                      const hoursText = h > 0 ? `${h}h` : '';
                      const minutesText = m > 0 ? `${m}min` : '';
                      return [hoursText, minutesText].filter(Boolean).join(' ') || '0h 0min';
                    })()}</strong> a credito
                    {addHoursFormData.date && (
                      <span> per il <strong>{new Date(addHoursFormData.date).toLocaleDateString('it-IT')}</strong></span>
                    )}
                  </p>
                  <p className="text-xs text-green-300 mt-1">
                    Nuovo saldo stimato: {formatHours((selectedEmployeeForAddHours.balance || 0) + ((parseInt(addHoursFormData.hours) || 0) + ((parseInt(addHoursFormData.minutes) || 0) / 60)))}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddHoursModal(false);
                  setSelectedEmployeeForAddHours(null);
                  setAddHoursFormData({
                    hours: '',
                    date: new Date().toISOString().split('T')[0],
                    reason: '',
                    notes: ''
                  });
                }}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
              >
                Annulla
              </button>
              <button
                onClick={handleAddHours}
                disabled={((!addHoursFormData.hours || parseInt(addHoursFormData.hours) === 0) && (!addHoursFormData.minutes || parseInt(addHoursFormData.minutes) === 0)) || !addHoursFormData.date || !addHoursFormData.reason}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors min-h-[44px]"
              >
                <CheckCircle className="h-4 w-4 inline mr-2" />
                Aggiungi Ore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecuperiOre;

