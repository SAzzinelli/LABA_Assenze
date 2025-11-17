import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
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
  const [recoveryFormData, setRecoveryFormData] = useState({
    recoveryDate: '',
    startTime: '',
    endTime: '',
    reason: '',
    notes: ''
  });
  
  // Dati per admin gestione recuperi
  const [pendingRecoveryRequests, setPendingRecoveryRequests] = useState([]); // Richieste in attesa (admin)
  const [employeesWithDebt, setEmployeesWithDebt] = useState([]); // Dipendenti con debito (admin)
  const [showApproveRecoveryModal, setShowApproveRecoveryModal] = useState(false);
  const [showRejectRecoveryModal, setShowRejectRecoveryModal] = useState(false);
  const [showProposeRecoveryModal, setShowProposeRecoveryModal] = useState(false);
  const [selectedRecoveryId, setSelectedRecoveryId] = useState(null);
  const [selectedEmployeeForProposal, setSelectedEmployeeForProposal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [proposalFormData, setProposalFormData] = useState({
    recoveryDate: '',
    startTime: '',
    endTime: '',
    reason: '',
    notes: ''
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (user?.role === 'admin') {
          await fetchPendingRecoveryRequests();
          await fetchDebtSummary();
        } else {
          await fetchTotalBalance();
          if (totalBalance < 0) {
            await fetchRecoveryRequests();
          }
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
        setTotalBalance(data.totalBalance || 0);
      }
    } catch (error) {
      console.error('Error fetching total balance:', error);
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
      const { recoveryDate, startTime, endTime, reason, notes } = proposalFormData;

      if (!recoveryDate || !startTime || !endTime) {
        alert('Compila tutti i campi obbligatori');
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
          endTime,
          reason,
          notes
        })
      });

      if (response.ok) {
        alert('Proposta recupero ore inviata con successo!');
        setShowProposeRecoveryModal(false);
        setProposalFormData({
          recoveryDate: '',
          startTime: '',
          endTime: '',
          reason: '',
          notes: ''
        });
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

  // Crea richiesta recupero ore
  const handleCreateRecoveryRequest = async () => {
    try {
      const { recoveryDate, startTime, endTime, reason, notes } = recoveryFormData;

      if (!recoveryDate || !startTime || !endTime) {
        alert('Compila tutti i campi obbligatori');
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
          endTime,
          reason,
          notes
        })
      });

      if (response.ok) {
        alert('Richiesta recupero ore creata con successo!');
        setShowRecoveryModal(false);
        setRecoveryFormData({
          recoveryDate: '',
          startTime: '',
          endTime: '',
          reason: '',
          notes: ''
        });
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
              Hai un debito di <span className="font-bold">{Math.abs(totalBalance).toFixed(2)}h</span> nella banca ore. 
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
                          Dalle {recovery.start_time} alle {recovery.end_time} ({recovery.hours}h)
                        </div>
                        {recovery.reason && (
                          <div className="text-slate-400 text-xs mt-1">{recovery.reason}</div>
                        )}
                      </div>
                      <div className="text-green-400 font-semibold">
                        +{recovery.hours}h
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
                          Dalle {recovery.start_time} alle {recovery.end_time} ({recovery.hours}h)
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
                          Dalle {recovery.start_time} alle {recovery.end_time} ({recovery.hours}h)
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
        ) : totalBalance >= 0 && (
          <div className="bg-slate-800 rounded-lg p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <p className="text-slate-400">Nessun recupero programmato. La tua banca ore è in regola.</p>
          </div>
        )}

        {/* Modal Crea Richiesta Recupero */}
        {showRecoveryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-white mb-4">Nuova Richiesta Recupero Ore</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Data Recupero *</label>
                  <input
                    type="date"
                    value={recoveryFormData.recoveryDate}
                    onChange={(e) => setRecoveryFormData({ ...recoveryFormData, recoveryDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Orario Inizio *</label>
                    <input
                      type="time"
                      value={recoveryFormData.startTime}
                      onChange={(e) => setRecoveryFormData({ ...recoveryFormData, startTime: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Orario Fine *</label>
                    <input
                      type="time"
                      value={recoveryFormData.endTime}
                      onChange={(e) => setRecoveryFormData({ ...recoveryFormData, endTime: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
                
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
              
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setShowRecoveryModal(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Annulla
                </button>
                <button
                  onClick={handleCreateRecoveryRequest}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[44px]"
                >
                  Invia Richiesta
                </button>
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
                        Debito: {employee.debtHours.toFixed(2)}h
                      </div>
                      <div className="text-slate-400 text-xs mt-1">
                        Saldo totale: {employee.totalBalance.toFixed(2)}h
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedEmployeeForProposal(employee);
                      setProposalFormData({
                        recoveryDate: '',
                        startTime: '',
                        endTime: '',
                        reason: '',
                        notes: `Proposta recupero per ${employee.debtHours.toFixed(2)}h di debito`
                      });
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
                      <div>⏰ Dalle {recovery.start_time} alle {recovery.end_time} ({recovery.hours}h)</div>
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
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Data Recupero *</label>
                <input
                  type="date"
                  value={proposalFormData.recoveryDate}
                  onChange={(e) => setProposalFormData({ ...proposalFormData, recoveryDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Orario Inizio *</label>
                  <input
                    type="time"
                    value={proposalFormData.startTime}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Orario Fine *</label>
                  <input
                    type="time"
                    value={proposalFormData.endTime}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              
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
            
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowProposeRecoveryModal(false);
                  setSelectedEmployeeForProposal(null);
                  setProposalFormData({
                    recoveryDate: '',
                    startTime: '',
                    endTime: '',
                    reason: '',
                    notes: ''
                  });
                }}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors min-h-[44px]"
              >
                Annulla
              </button>
              <button
                onClick={handleProposeRecovery}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors min-h-[44px]"
              >
                Invia Proposta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecuperiOre;

