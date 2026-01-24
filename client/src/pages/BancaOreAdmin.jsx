import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { formatHours } from '../utils/hoursCalculation';
import {
  DollarSign,
  Plus,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  Settings,
  MoreVertical,
  Shield
} from 'lucide-react';

const BancaOreAdmin = () => {
  const { user, apiCall } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('situazione'); // 'situazione', 'debt', 'proposals'
  const [employeesWithDebt, setEmployeesWithDebt] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showProposeRecoveryModal, setShowProposeRecoveryModal] = useState(false);
  const [showAddHoursModal, setShowAddHoursModal] = useState(false);
  const [selectedEmployeeForProposal, setSelectedEmployeeForProposal] = useState(null);
  const [selectedEmployeeForAddHours, setSelectedEmployeeForAddHours] = useState(null);
  const [proposalStep, setProposalStep] = useState(1);
  const [proposalFormData, setProposalFormData] = useState({
    recoveryDate: '',
    hours: '',
    minutes: '0',
    startTime: '',
    endTime: '',
    reason: '',
    notes: ''
  });
  const [proposalSuggestedTimeSlots, setProposalSuggestedTimeSlots] = useState([]);
  const [addHoursFormData, setAddHoursFormData] = useState({
    hours: '',
    minutes: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    notes: ''
  });
  const [showEmergencyMenu, setShowEmergencyMenu] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchDebtSummary();
        await fetchAllEmployees();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin' || user?.role === 'supervisor') {
      loadData();
    }
  }, [user]);

  const fetchDebtSummary = async () => {
    try {
      const response = await apiCall('/api/recovery-requests/debt-summary');
      if (response.ok) {
        const data = await response.json();
        setEmployeesWithDebt(data.employeesWithDebt || []);
      }
    } catch (error) {
      console.error('Error fetching debt summary:', error);
      setEmployeesWithDebt([]);
    }
  };

  const fetchAllEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        const activeEmployees = data.filter(emp => emp.isActive !== false);
        const timestamp = Date.now();
        const employeesWithBalance = await Promise.all(
          activeEmployees.map(async (emp) => {
            try {
              const balanceResponse = await apiCall(`/api/hours/overtime-balance?userId=${emp.id}&_t=${timestamp}`);
              if (balanceResponse.ok) {
                const balanceData = await balanceResponse.json();
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
      }
    } catch (error) {
      console.error('Error fetching all employees:', error);
      setAllEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Helper functions
  const calculateHours = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diff = (end - start) / (1000 * 60 * 60);
    return diff > 0 ? diff : null;
  };

  const calculateEndTime = (startTime, hours) => {
    if (!startTime || !hours) return '';
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(start.getTime() + parseFloat(hours) * 60 * 60 * 1000);
    return end.toTimeString().slice(0, 5);
  };

  const formatHoursFromDecimal = (hours) => {
    const h = Math.floor(parseFloat(hours));
    const m = Math.round((parseFloat(hours) - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  const hoursMinutesToDecimal = (hours, minutes) => {
    return parseFloat(hours || 0) + (parseFloat(minutes || 0) / 60);
  };

  const handleProposeRecovery = async () => {
    try {
      if (!selectedEmployeeForProposal) return;
      const { recoveryDate, startTime, endTime, hours, minutes, reason, notes } = proposalFormData;

      if (!recoveryDate || !startTime) {
        alert('Compila data e orario di inizio');
        return;
      }

      let finalEndTime = endTime;
      let finalHoursDecimal = 0;

      if (hours && hours !== '') {
        finalHoursDecimal = hoursMinutesToDecimal(hours, minutes);
        finalEndTime = calculateEndTime(startTime, finalHoursDecimal.toString());
        if (!finalEndTime) {
          alert('Errore nel calcolo dell\'orario di fine');
          return;
        }
      } else if (endTime && endTime !== '') {
        const calculatedHours = calculateHours(startTime, endTime);
        if (!calculatedHours || parseFloat(calculatedHours) <= 0) {
          alert('L\'orario di fine deve essere successivo all\'orario di inizio');
          return;
        }
        finalHoursDecimal = parseFloat(calculatedHours);
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
          hours: finalHoursDecimal,
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
          minutes: '0',
          reason: '',
          notes: ''
        });
        setProposalSuggestedTimeSlots([]);
        setSelectedEmployeeForProposal(null);
        await fetchDebtSummary();
        await fetchAllEmployees();
      } else {
        const error = await response.json();
        alert(error.error || 'Errore nell\'invio della proposta');
      }
    } catch (error) {
      console.error('Error proposing recovery:', error);
      alert('Errore nell\'invio della proposta');
    }
  };

  const handleAddHours = async () => {
    try {
      if (!selectedEmployeeForAddHours) return;
      const { hours, minutes, date, reason, notes } = addHoursFormData;

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

      if (!reason || reason.trim() === '') {
        alert('Inserisci un motivo per questa aggiunta emergenziale');
        return;
      }

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
          reason: reason || 'Ore aggiunte manualmente dall\'amministratore (emergenziale)',
          notes: notes || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        const hoursText = hoursNum > 0 ? `${hoursNum}h` : '';
        const minutesText = minutesNum > 0 ? `${minutesNum}min` : '';
        const totalText = [hoursText, minutesText].filter(Boolean).join(' ');

        setTimeout(async () => {
          await fetchAllEmployees();
          await fetchDebtSummary();
        }, 300);

        alert(`✅ ${totalText} aggiunte con successo a ${selectedEmployeeForAddHours.first_name} ${selectedEmployeeForAddHours.last_name}${data.newBalance !== undefined ? `\nNuovo saldo: ${data.newBalance.toFixed(2)}h` : ''}`);

        setShowAddHoursModal(false);
        setSelectedEmployeeForAddHours(null);
        setAddHoursFormData({
          hours: '',
          minutes: '',
          date: new Date().toISOString().split('T')[0],
          reason: '',
          notes: ''
        });
        setShowEmergencyMenu(false);
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.error || 'Errore durante l\'aggiunta delle ore'}`);
      }
    } catch (error) {
      console.error('Error adding credit hours:', error);
      alert('Errore durante l\'aggiunta delle ore');
    }
  };

  const handleProposalNextStep = async () => {
    if (proposalStep === 1) {
      if (!proposalFormData.recoveryDate) {
        alert('Seleziona una data');
        return;
      }
      setProposalStep(2);
    } else if (proposalStep === 2) {
      if (!proposalFormData.hours || parseInt(proposalFormData.hours) === 0) {
        alert('Seleziona le ore da recuperare');
        return;
      }
      // Calcola slot suggeriti
      const totalHours = hoursMinutesToDecimal(proposalFormData.hours, proposalFormData.minutes);
      const slots = [
        { startTime: '09:00', endTime: calculateEndTime('09:00', totalHours.toString()), label: `Mattina (09:00 - ${calculateEndTime('09:00', totalHours.toString())})` },
        { startTime: '14:00', endTime: calculateEndTime('14:00', totalHours.toString()), label: `Pomeriggio (14:00 - ${calculateEndTime('14:00', totalHours.toString())})` }
      ];
      setProposalSuggestedTimeSlots(slots);
      setProposalStep(3);
    }
  };

  const handleProposalPrevStep = () => {
    if (proposalStep > 1) {
      setProposalStep(proposalStep - 1);
    }
  };

  const handleSelectProposalTimeSlot = (slot) => {
    setProposalFormData({
      ...proposalFormData,
      startTime: slot.startTime,
      endTime: slot.endTime
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
          <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 mr-3 text-green-400" />
          Banca Ore
        </h1>
        <div className="relative">
          <button
            onClick={() => setShowEmergencyMenu(!showEmergencyMenu)}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors flex items-center gap-2"
          >
            <Shield className="h-4 w-4" />
            <span className="text-xs font-semibold">EMERGENZA</span>
          </button>
          {showEmergencyMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-red-500/30 rounded-lg shadow-xl z-50 p-4">
              <p className="text-xs text-red-400 font-semibold mb-2">⚠️ Aggiunta Ore Emergenziale</p>
              <p className="text-xs text-slate-400 mb-3">Usa solo in casi eccezionali che non rientrano in altre casistiche. Questa funzione bypassa richieste e approvazioni.</p>
              <button
                onClick={() => {
                  setShowEmergencyMenu(false);
                  setShowAddHoursModal(true);
                  setSelectedEmployeeForAddHours(null);
                  setAddHoursFormData({
                    hours: '',
                    minutes: '',
                    date: new Date().toISOString().split('T')[0],
                    reason: '',
                    notes: ''
                  });
                }}
                className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Aggiungi Ore Manualmente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="flex gap-2 border-b border-slate-700 p-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('situazione')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'situazione'
              ? 'text-blue-400 border-blue-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
          >
            <Wallet className="h-4 w-4 inline mr-2" />
            Situazione
          </button>
          <button
            onClick={() => setActiveTab('debt')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'debt'
              ? 'text-red-400 border-red-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
          >
            <AlertCircle className="h-4 w-4 inline mr-2" />
            Debiti ({employeesWithDebt.length})
          </button>
          <button
            onClick={() => setActiveTab('proposals')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'proposals'
              ? 'text-amber-400 border-amber-400'
              : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Proposte ({allEmployees.length})
          </button>
        </div>

        <div className="p-6">
          {/* Tab: Situazione */}
          {activeTab === 'situazione' && (
            <div>
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-white mb-2">Situazione Banca Ore Dipendenti</h4>
                <p className="text-sm text-slate-400">
                  Panoramica completa del saldo banca ore di tutti i dipendenti
                </p>
              </div>

              {loadingEmployees ? (
                <div className="text-center py-8">
                  <div className="text-slate-400">Caricamento dipendenti...</div>
                </div>
              ) : allEmployees.length > 0 ? (
                <div className="space-y-3">
                  {allEmployees.map((employee) => {
                    const isDebt = employee.balance < 0;
                    const isCredit = employee.balance > 0;
                    const borderClass = isDebt ? 'border-l-red-500 hover:border-red-500/30 hover:shadow-red-500/5' :
                      isCredit ? 'border-l-green-500 hover:border-green-500/30 hover:shadow-green-500/5' :
                        'border-l-slate-500 hover:border-zinc-700/50 hover:shadow-zinc-900/5';

                    const statusColor = isDebt ? 'text-red-400' : isCredit ? 'text-green-400' : 'text-slate-400';
                    const statusBg = isDebt ? 'bg-red-500/10 border-red-500/20' : isCredit ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-500/10 border-slate-500/20';
                    const avatarBg = isDebt ? 'bg-red-500/20 text-red-400 border-red-500/30' : isCredit ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30';

                    return (
                      <div key={employee.id} className={`group bg-zinc-900 rounded-xl border border-zinc-800/50 p-4 transition-all hover:shadow-lg hover:bg-zinc-900/80 border-l-4 ${borderClass}`}>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex sm:flex-col items-center sm:items-center justify-center sm:w-24 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-slate-700/50 pb-3 sm:pb-0 sm:pr-4">
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl font-bold border ${avatarBg}`}>
                              {employee.firstName?.[0] || employee.first_name?.[0] || ''}
                              {employee.lastName?.[0] || employee.last_name?.[0] || ''}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${statusBg} ${statusColor}`}>
                                {isDebt ? 'Debito' : isCredit ? 'Credito' : 'In Pari'}
                              </span>
                              <span className="text-xs text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md">
                                {employee.department || 'N/A'}
                              </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-300 transition-colors">
                              {employee.firstName || employee.first_name} {employee.lastName || employee.last_name}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                              <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-1 rounded">
                                <Wallet className={`w-3.5 h-3.5 ${statusColor}`} />
                                <span className={`font-medium ${statusColor}`}>
                                  Saldo: {formatHours(employee.balance)}
                                  {isDebt && ` (Debito: ${formatHours(employee.debtHours)})`}
                                  {isCredit && ` (Credito: ${formatHours(employee.creditHours)})`}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-700/50 pt-3 sm:pt-0 sm:pl-4 mt-2 sm:mt-0 w-full sm:w-auto min-w-[120px]">
                            <button
                              onClick={() => {
                                setSelectedEmployeeForAddHours({
                                  id: employee.id,
                                  first_name: employee.firstName || employee.first_name,
                                  last_name: employee.lastName || employee.last_name,
                                  department: employee.department,
                                  balance: employee.balance
                                });
                                setShowAddHoursModal(true);
                                setAddHoursFormData({
                                  hours: '',
                                  minutes: '',
                                  date: new Date().toISOString().split('T')[0],
                                  reason: '',
                                  notes: ''
                                });
                              }}
                              className="flex-1 sm:flex-none w-full flex items-center justify-center px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-all shadow-lg shadow-red-900/20 font-medium text-xs gap-1.5"
                              title="Aggiunta emergenziale ore"
                            >
                              <Shield className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Emergenza</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>Nessun dipendente disponibile</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Debiti */}
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
                    <div key={employee.id} className="group bg-zinc-900 rounded-xl border border-zinc-800/50 p-4 hover:border-red-500/30 transition-all hover:shadow-lg hover:shadow-red-500/5 hover:bg-zinc-900/80 border-l-4 border-l-red-500">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex sm:flex-col items-center sm:items-center justify-center sm:w-24 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-slate-700/50 pb-3 sm:pb-0 sm:pr-4">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 text-2xl font-bold border border-red-500/30">
                            {employee.first_name?.[0] || ''}{employee.last_name?.[0] || ''}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-red-500/10 text-red-400 border-red-500/20">
                              Debito
                            </span>
                            <span className="text-xs text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md">
                              {employee.department || 'N/A'}
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-white mb-1 group-hover:text-red-400 transition-colors">
                            {employee.first_name} {employee.last_name}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                            <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-1 rounded">
                              <Clock className="w-3.5 h-3.5 text-red-400" />
                              <span className="font-medium text-red-300">Debito: {formatHours(employee.debtHours)}</span>
                            </span>
                            <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-1 rounded">
                              <Wallet className="w-3.5 h-3.5 text-slate-300" />
                              <span className="font-medium text-slate-300">Saldo: {formatHours(employee.totalBalance)}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-700/50 pt-3 sm:pt-0 sm:pl-4 mt-2 sm:mt-0 w-full sm:w-auto min-w-[120px]">
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
                            className="flex-1 sm:flex-none w-full flex items-center justify-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all shadow-lg shadow-amber-900/20 font-medium text-xs gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Proponi Recupero
                          </button>
                        </div>
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

          {/* Tab: Proposte */}
          {activeTab === 'proposals' && (
            <div>
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-white mb-2">Proponi a Qualsiasi Dipendente</h4>
                <p className="text-sm text-slate-400">
                  Puoi proporre recuperi o straordinari anche a dipendenti in pari o in positivo (es. eventi dopo cena, progetti speciali).
                  Queste ore verranno aggiunte al saldo positivo della banca ore.
                </p>
              </div>

              {loadingEmployees ? (
                <div className="text-center py-8">
                  <div className="text-slate-400">Caricamento dipendenti...</div>
                </div>
              ) : allEmployees.length > 0 ? (
                <div className="space-y-3">
                  {allEmployees.map((employee) => {
                    const isDebt = employee.balance < 0;
                    const isCredit = employee.balance > 0;
                    const borderClass = isDebt ? 'border-l-red-500 hover:border-red-500/30 hover:shadow-red-500/5' :
                      isCredit ? 'border-l-green-500 hover:border-green-500/30 hover:shadow-green-500/5' :
                        'border-l-slate-500 hover:border-zinc-700/50 hover:shadow-zinc-900/5';

                    const statusColor = isDebt ? 'text-red-400' : isCredit ? 'text-green-400' : 'text-slate-400';
                    const statusBg = isDebt ? 'bg-red-500/10 border-red-500/20' : isCredit ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-500/10 border-slate-500/20';
                    const avatarBg = isDebt ? 'bg-red-500/20 text-red-400 border-red-500/30' : isCredit ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30';

                    return (
                      <div key={employee.id} className={`group bg-zinc-900 rounded-xl border border-zinc-800/50 p-4 transition-all hover:shadow-lg hover:bg-zinc-900/80 border-l-4 ${borderClass}`}>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex sm:flex-col items-center sm:items-center justify-center sm:w-24 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-slate-700/50 pb-3 sm:pb-0 sm:pr-4">
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl font-bold border ${avatarBg}`}>
                              {employee.firstName?.[0] || employee.first_name?.[0] || ''}
                              {employee.lastName?.[0] || employee.last_name?.[0] || ''}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${statusBg} ${statusColor}`}>
                                {isDebt ? 'Debito' : isCredit ? 'Credito' : 'In Pari'}
                              </span>
                              <span className="text-xs text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md">
                                {employee.department || 'N/A'}
                              </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors">
                              {employee.firstName || employee.first_name} {employee.lastName || employee.last_name}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                              <span className="flex items-center gap-1.5 bg-slate-700/30 px-2 py-1 rounded">
                                <Wallet className={`w-3.5 h-3.5 ${statusColor}`} />
                                <span className={`font-medium ${statusColor}`}>
                                  Saldo: {formatHours(employee.balance)}
                                  {isDebt && ` (Debito: ${formatHours(employee.debtHours)})`}
                                  {isCredit && ` (Credito: ${formatHours(employee.creditHours)})`}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-700/50 pt-3 sm:pt-0 sm:pl-4 mt-2 sm:mt-0 w-full sm:w-auto min-w-[120px]">
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
                              className="flex-1 sm:flex-none w-full flex items-center justify-center px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-lg transition-all shadow-lg shadow-blue-900/20 font-medium text-xs gap-1.5"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Proponi
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>Nessun dipendente disponibile</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Proponi Recupero */}
      {showProposeRecoveryModal && selectedEmployeeForProposal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowProposeRecoveryModal(false);
              setSelectedEmployeeForProposal(null);
              setProposalStep(1);
              setProposalFormData({
                recoveryDate: '',
                startTime: '',
                endTime: '',
                hours: '',
                minutes: '0',
                reason: '',
                notes: ''
              });
              setProposalSuggestedTimeSlots([]);
            }
          }}
        >
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
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
                  minutes: '0',
                  reason: '',
                  notes: ''
                });
                setProposalSuggestedTimeSlots([]);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
              aria-label="Chiudi"
            >
              <XCircle className="h-6 w-6" />
            </button>
            <h3 className="text-xl font-bold text-white mb-4 pr-8">
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
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 text-lg"
                  />
                </div>

                {proposalFormData.recoveryDate && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <p className="text-sm text-slate-300">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Ore</label>
                      <select
                        value={proposalFormData.hours}
                        onChange={(e) => setProposalFormData({ ...proposalFormData, hours: e.target.value === '' ? '' : parseInt(e.target.value) || '' })}
                        className="w-full h-[42px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 text-base"
                      >
                        <option value="">Seleziona ore</option>
                        {Array.from({ length: 8 }, (_, i) => i + 1).map(hours => (
                          <option key={hours} value={hours}>{hours} {hours === 1 ? 'ora' : 'ore'}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Minuti</label>
                      <select
                        value={proposalFormData.minutes}
                        onChange={(e) => setProposalFormData({ ...proposalFormData, minutes: e.target.value })}
                        className="w-full h-[42px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-zinc-600 text-base"
                      >
                        <option value="0">0 min</option>
                        <option value="30">30 min</option>
                      </select>
                    </div>
                  </div>
                </div>

                {proposalFormData.hours && parseInt(proposalFormData.hours) > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-sm text-amber-400 font-medium">
                      ✅ Hai selezionato <strong>{formatHoursFromDecimal(hoursMinutesToDecimal(proposalFormData.hours, proposalFormData.minutes).toString())}</strong> per il <strong>{proposalFormData.recoveryDate ? new Date(proposalFormData.recoveryDate).toLocaleDateString('it-IT') : '...'}</strong>
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
                    Seleziona l'orario ({formatHoursFromDecimal(hoursMinutesToDecimal(proposalFormData.hours, proposalFormData.minutes).toString())})
                  </label>

                  {proposalSuggestedTimeSlots.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-slate-400 mb-2">Suggerimenti automatici:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {proposalSuggestedTimeSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectProposalTimeSlot(slot)}
                            className={`px-3 py-2 rounded-lg border transition-colors text-sm ${proposalFormData.startTime === slot.startTime && proposalFormData.endTime === slot.endTime
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Da</label>
                      <input
                        type="time"
                        value={proposalFormData.startTime}
                        onChange={(e) => {
                          const newStartTime = e.target.value;
                          const totalHoursDecimal = hoursMinutesToDecimal(proposalFormData.hours, proposalFormData.minutes);
                          const newEndTime = calculateEndTime(newStartTime, totalHoursDecimal.toString());
                          setProposalFormData({
                            ...proposalFormData,
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
                        value={proposalFormData.endTime}
                        onChange={(e) => {
                          const newEndTime = e.target.value;
                          const calculatedHours = calculateHours(proposalFormData.startTime, newEndTime);
                          const requestedHoursDecimal = hoursMinutesToDecimal(proposalFormData.hours, proposalFormData.minutes);

                          if (calculatedHours && Math.abs(parseFloat(calculatedHours) - requestedHoursDecimal) > 0.01) {
                            alert(`Il range orario deve corrispondere ESATTAMENTE alle ${formatHoursFromDecimal(requestedHoursDecimal.toString())} richieste. Range selezionato: ${formatHoursFromDecimal(calculatedHours)}`);
                            const autoEndTime = calculateEndTime(proposalFormData.startTime, requestedHoursDecimal.toString());
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
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
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

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Motivo</label>
                  <textarea
                    value={proposalFormData.reason}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, reason: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    placeholder="Motivo della proposta di recupero ore..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Note</label>
                  <textarea
                    value={proposalFormData.notes}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
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
                      minutes: '0',
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

      {/* Modal Aggiungi Ore Emergenziale */}
      {showAddHoursModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddHoursModal(false);
              setSelectedEmployeeForAddHours(null);
              setAddHoursFormData({
                hours: '',
                minutes: '',
                date: new Date().toISOString().split('T')[0],
                reason: '',
                notes: ''
              });
            }
          }}
        >
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => {
                setShowAddHoursModal(false);
                setSelectedEmployeeForAddHours(null);
                setAddHoursFormData({
                  hours: '',
                  minutes: '',
                  date: new Date().toISOString().split('T')[0],
                  reason: '',
                  notes: ''
                });
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
              aria-label="Chiudi"
            >
              <XCircle className="h-6 w-6" />
            </button>
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-400" />
                Aggiunta Ore Emergenziale
              </h3>
              <p className="text-xs text-red-400 font-semibold mb-2">⚠️ Funzione riservata a casi eccezionali</p>
              <p className="text-sm text-slate-300">
                {selectedEmployeeForAddHours 
                  ? `Aggiungi ore direttamente al saldo di <strong>${selectedEmployeeForAddHours.first_name} ${selectedEmployeeForAddHours.last_name}</strong>.`
                  : 'Seleziona un dipendente dalla lista Situazione per aggiungere ore manualmente.'
                }
              </p>
            </div>

            {!selectedEmployeeForAddHours && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400 mb-2">Seleziona un dipendente dalla tab "Situazione" oppure:</p>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const emp = allEmployees.find(e => e.id === parseInt(e.target.value));
                      if (emp) {
                        setSelectedEmployeeForAddHours({
                          id: emp.id,
                          first_name: emp.firstName || emp.first_name,
                          last_name: emp.lastName || emp.last_name,
                          department: emp.department,
                          balance: emp.balance
                        });
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Seleziona dipendente --</option>
                  {allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName || emp.first_name} {emp.lastName || emp.last_name} ({formatHours(emp.balance)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              {selectedEmployeeForAddHours && (
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <p className="text-sm text-white font-semibold">
                    {selectedEmployeeForAddHours.first_name} {selectedEmployeeForAddHours.last_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    Saldo attuale: <span className={`font-semibold ${(selectedEmployeeForAddHours.balance || 0) < 0 ? 'text-red-400' :
                      (selectedEmployeeForAddHours.balance || 0) > 0 ? 'text-green-400' : 'text-slate-400'
                      }`}>
                      {formatHours(selectedEmployeeForAddHours.balance || 0)}
                    </span>
                  </p>
                </div>
              )}

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
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
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
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-lg"
                    />
                  </div>
                </div>
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
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Motivo (obbligatorio per emergenze) *
                </label>
                <textarea
                  value={addHoursFormData.reason}
                  onChange={(e) => setAddHoursFormData({ ...addHoursFormData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Descrivi il motivo emergenziale per questa aggiunta manuale..."
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
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Note aggiuntive..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddHoursModal(false);
                  setSelectedEmployeeForAddHours(null);
                  setAddHoursFormData({
                    hours: '',
                    minutes: '',
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
                disabled={!selectedEmployeeForAddHours || ((!addHoursFormData.hours || parseInt(addHoursFormData.hours) === 0) && (!addHoursFormData.minutes || parseInt(addHoursFormData.minutes) === 0)) || !addHoursFormData.date || !addHoursFormData.reason}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors min-h-[44px]"
              >
                <Shield className="h-4 w-4 inline mr-2" />
                Aggiungi Ore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BancaOreAdmin;
