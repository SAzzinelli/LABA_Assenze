import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { formatHours } from '../utils/hoursCalculation';
import { 
  RefreshCw, 
  Plus, 
  AlertCircle, 
  Timer, 
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

const RecuperiOre = () => {
  const { user, apiCall } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Dati per recupero ore (dipendente)
  const [totalBalance, setTotalBalance] = useState(0); // Saldo totale banca ore
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
  const [pendingRecoveryRequests, setPendingRecoveryRequests] = useState([]); // Richieste in attesa (admin)
  const [employeesWithDebt, setEmployeesWithDebt] = useState([]); // Dipendenti con debito (admin)
  const [showApproveRecoveryModal, setShowApproveRecoveryModal] = useState(false);
  const [showRejectRecoveryModal, setShowRejectRecoveryModal] = useState(false);
  const [showProposeRecoveryModal, setShowProposeRecoveryModal] = useState(false);
  const [selectedRecoveryId, setSelectedRecoveryId] = useState(null);
  const [selectedEmployeeForProposal, setSelectedEmployeeForProposal] = useState(null);
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (user?.role === 'admin') {
          await fetchPendingRecoveryRequests();
          await fetchDebtSummary();
        } else {
          // Carica sempre il saldo e le richieste, così abbiamo tutti i dati
          const balance = await fetchTotalBalance();
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

  // Fetch saldo totale banca ore (dipendente)
  const fetchTotalBalance = async () => {
    try {
      const response = await apiCall('/api/attendance/total-balance');
      if (response.ok) {
        const data = await response.json();
        // L'endpoint restituisce totalBalanceHours, non totalBalance
        const balance = data.totalBalanceHours || 0;
        console.log('💰 Total balance loaded:', balance, 'h (isDebt:', data.isDebt, ')');
        setTotalBalance(balance);
        return balance; // Ritorna il valore per usarlo subito
      }
      return 0;
    } catch (error) {
      console.error('Error fetching total balance:', error);
      return 0;
    }
  };

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
      const employeeDebt = Math.abs(selectedEmployeeForProposal.debtHours || selectedEmployeeForProposal.totalBalance || 0);
      if (hours > employeeDebt) {
        alert(`Il dipendente può recuperare massimo ${formatHoursFromDecimal(employeeDebt.toString())} (il suo debito attuale)`);
        return;
      }
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
        await fetchTotalBalance();
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Caricamento...</div>
      </div>
    );
  }

  // Vista Dipendente
  if (user?.role === 'employee') {
    const approvedRecoveries = recoveryRequests.filter(r => r.status === 'approved' && !r.balance_added);
    const pendingRecoveries = recoveryRequests.filter(r => r.status === 'pending');
    const proposedRecoveries = recoveryRequests.filter(r => r.status === 'proposed');

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
            <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-amber-400" />
            Recupero Ore
          </h1>
        </div>

        {/* Sezione Recupero Ore (solo se ha debito) */}
        {totalBalance < 0 && (
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center">
                <AlertCircle className="h-6 w-6 mr-3 text-amber-400" />
                Debito Banca Ore
              </h3>
              <button
                onClick={() => setShowRecoveryModal(true)}
                className="flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[44px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuova Richiesta
              </button>
            </div>
            <p className="text-amber-200">
              Hai un debito di <span className="font-bold">{formatHours(Math.abs(totalBalance))}</span> nella banca ore. 
              Puoi richiedere di recuperare queste ore concordando degli straordinari con l'amministratore.
            </p>
          </div>
        )}

        {/* Recuperi Programmati */}
        {(approvedRecoveries.length > 0 || pendingRecoveries.length > 0 || proposedRecoveries.length > 0) ? (
          <div className="bg-slate-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Timer className="h-6 w-6 mr-3 text-blue-400" />
              Recuperi Programmati
            </h3>
            
            {approvedRecoveries.length > 0 && (
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-semibold text-green-400 mb-2">✅ Approvati</h4>
                {approvedRecoveries.map((recovery) => (
                  <div key={recovery.id} className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="text-white font-semibold">
                          {new Date(recovery.recovery_date).toLocaleDateString('it-IT', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                          <div className="text-green-300 text-sm mt-1">
                            Dalle {recovery.start_time} alle {recovery.end_time} ({formatHours(recovery.hours)})
                          </div>
                        {recovery.reason && (
                          <div className="text-slate-400 text-xs mt-1">{recovery.reason}</div>
                        )}
                      </div>
                      <div className="text-green-400 font-semibold">
                        +{formatHours(recovery.hours)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingRecoveries.length > 0 && (
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-semibold text-yellow-400 mb-2">⏳ In attesa di approvazione</h4>
                {pendingRecoveries.map((recovery) => (
                  <div key={recovery.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="text-white font-semibold">
                          {new Date(recovery.recovery_date).toLocaleDateString('it-IT', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                          <div className="text-yellow-300 text-sm mt-1">
                            Dalle {recovery.start_time} alle {recovery.end_time} ({formatHours(recovery.hours)})
                          </div>
                        {recovery.reason && (
                          <div className="text-slate-400 text-xs mt-1">{recovery.reason}</div>
                        )}
                      </div>
                      <div className="text-yellow-400 font-semibold">
                        In attesa
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {proposedRecoveries.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-blue-400 mb-2">📩 Proposte dall'amministratore</h4>
                {proposedRecoveries.map((recovery) => (
                  <div key={recovery.id} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-white font-semibold">
                          {new Date(recovery.recovery_date).toLocaleDateString('it-IT', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="text-blue-300 text-sm mt-1">
                          Dalle {recovery.start_time} alle {recovery.end_time} ({formatHours(recovery.hours)})
                        </div>
                        {recovery.reason && (
                          <div className="text-slate-400 text-xs mt-1">{recovery.reason}</div>
                        )}
                        {recovery.notes && (
                          <div className="text-slate-300 text-xs mt-1 italic">{recovery.notes}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
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
        ) : totalBalance >= 0 ? (
          // Mostra "in regola" SOLO se non c'è debito E non ci sono recuperi programmati
          <div className="bg-slate-800 rounded-lg p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <p className="text-slate-400">Nessun recupero programmato. La tua banca ore è in regola.</p>
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

      {/* Monitoraggio Debiti Banca Ore */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center">
            <AlertCircle className="h-6 w-6 mr-3 text-red-400" />
            Monitoraggio Debiti Banca Ore
          </h3>
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
                    max={Math.abs(selectedEmployeeForProposal.debtHours || selectedEmployeeForProposal.totalBalance || 0)}
                    value={proposalFormData.hours}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, hours: e.target.value })}
                    placeholder="es. 2.5"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-lg"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Debito dipendente: <span className="text-red-400 font-semibold">{formatHours(Math.abs(selectedEmployeeForProposal.debtHours || selectedEmployeeForProposal.totalBalance || 0))}</span>
                  </p>
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
    </div>
  );
};

export default RecuperiOre;

