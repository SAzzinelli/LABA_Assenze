import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
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
  TrendingUp
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

  // Hook per gestire chiusura modal con ESC e click fuori
  useModal(showNewRequest, () => setShowNewRequest(false));

  // Sistema basato su ore
  const [vacationBalance, setVacationBalance] = useState({
    totalHours: 160, // 20 giorni * 8h per FT
    usedHours: 0,
    remainingHours: 160,
    pendingHours: 0,
    totalDays: 20,
    usedDays: 0,
    remainingDays: 20,
    pendingDays: 0,
    bonusHours: 0, // Bonus per anzianità
    has104: user?.has104 || false // Bonus legge 104
  });
  const [workPattern, setWorkPattern] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch real data on component mount
  useEffect(() => {
    fetchVacationData();
  }, []);

  const fetchVacationData = async () => {
    try {
      setLoading(true);
      
      // Simula pattern di lavoro basato sul tipo contratto utente
      const defaultPattern = {
        monday_hours: 8,
        tuesday_hours: 8,
        wednesday_hours: 8,
        thursday_hours: 8,
        friday_hours: 8,
        saturday_hours: 0,
        sunday_hours: 0,
        weekly_hours: 40,
        monthly_hours: 173.33
      };
      
      // Personalizza pattern basato su contratto utente
      if (user?.contract_type) {
        const contractType = user.contract_type.toLowerCase();
        if (contractType.includes('part') && contractType.includes('horizontal')) {
          // Part-time orizzontale: stessi giorni, meno ore
          defaultPattern.monday_hours = 4;
          defaultPattern.tuesday_hours = 4;
          defaultPattern.wednesday_hours = 4;
          defaultPattern.thursday_hours = 4;
          defaultPattern.friday_hours = 4;
          defaultPattern.weekly_hours = 20;
          defaultPattern.monthly_hours = 86.67;
        } else if (contractType.includes('part') && contractType.includes('vertical')) {
          // Part-time verticale: stessi orari, meno giorni
          defaultPattern.tuesday_hours = 0;
          defaultPattern.thursday_hours = 0;
          defaultPattern.weekly_hours = 24;
          defaultPattern.monthly_hours = 104;
        }
      }
      
      setWorkPattern(defaultPattern);

      // Fetch vacation requests
      const requestsResponse = await apiCall('/api/leave-requests?type=vacation');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setVacationRequests(requestsData);
      }

      // Simula saldi basati su dati esistenti
      const balanceResponse = await apiCall('/api/leave-balances');
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        
        // Converti giorni in ore usando il pattern
        const totalHours = balanceData.vacation.total * 8; // Assumendo 8h/giorno
        const usedHours = balanceData.vacation.used * 8;
        const remainingHours = balanceData.vacation.remaining * 8;
        const pendingHours = balanceData.vacation.pending * 8;
        
        setVacationBalance(prev => ({
          ...prev,
          totalHours: totalHours,
          usedHours: usedHours,
          remainingHours: remainingHours,
          pendingHours: pendingHours,
          totalDays: balanceData.vacation.total,
          usedDays: balanceData.vacation.used,
          remainingDays: balanceData.vacation.remaining,
          pendingDays: balanceData.vacation.pending
        }));
      } else {
        // Fallback con dati di default
        setVacationBalance(prev => ({
          ...prev,
          totalHours: 160, // 20 giorni * 8h
          usedHours: 0,
          remainingHours: 160,
          pendingHours: 0,
          totalDays: 26,
          usedDays: 0,
          remainingDays: 26,
          pendingDays: 0
        }));
      }
    } catch (error) {
      console.error('Error fetching vacation data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcolo dinamico basato su dati reali
  React.useEffect(() => {
    // Simulazione calcolo dinamico
    const baseDays = 26;
    let bonusDays = 0;
    
    // Bonus anzianità (esempio)
    if (user?.hireDate) {
      const hireYear = new Date(user.hireDate).getFullYear();
      const yearsWorked = new Date().getFullYear() - hireYear;
      if (yearsWorked >= 10) bonusDays += 2;
      if (yearsWorked >= 15) bonusDays += 2;
      if (yearsWorked >= 20) bonusDays += 2;
    }
    
    // Bonus legge 104
    if (user?.has104) {
      bonusDays += 3; // Giorni aggiuntivi per legge 104
    }
    
    setVacationBalance(prev => ({
      ...prev,
      totalDays: baseDays + bonusDays,
      bonusDays: bonusDays,
      has104: user?.has104 || false
    }));
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Calcola le ore per il periodo richiesto
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const dates = [];
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      // Calcola ore totali usando il pattern di lavoro
      let totalHours = 0;
      if (workPattern) {
        dates.forEach(date => {
          const dayOfWeek = new Date(date).getDay();
          let dailyHours = 0;
          
          switch (dayOfWeek) {
            case 1: dailyHours = workPattern.monday_hours; break;
            case 2: dailyHours = workPattern.tuesday_hours; break;
            case 3: dailyHours = workPattern.wednesday_hours; break;
            case 4: dailyHours = workPattern.thursday_hours; break;
            case 5: dailyHours = workPattern.friday_hours; break;
            case 6: dailyHours = workPattern.saturday_hours; break;
            case 0: dailyHours = workPattern.sunday_hours; break;
          }
          
          totalHours += dailyHours;
        });
      } else {
        // Fallback: 8h per giorno lavorativo
        totalHours = dates.length * 8;
      }

      // Verifica saldo disponibile
      if (totalHours > vacationBalance.remainingHours) {
        alert(`Saldo insufficiente. Richieste: ${formatHours(totalHours)}, Disponibili: ${formatHours(vacationBalance.remainingHours)}`);
        return;
      }

      // Crea richiesta usando l'API esistente
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
        const newRequest = {
          id: Date.now(),
          ...formData,
          status: 'pending',
          submittedAt: new Date().toISOString(),
          submittedBy: user?.firstName + ' ' + user?.lastName,
          calculatedHours: totalHours
        };
        
        setVacationRequests(prev => [newRequest, ...prev]);
        setFormData({
          startDate: '',
          endDate: '',
          notes: ''
        });
        setShowNewRequest(false);
        
        // Refresh data
        fetchVacationData();
        
        alert(`Richiesta inviata con successo! Ore richieste: ${formatHours(totalHours)}`);
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
          request.notes?.toLowerCase().includes(searchLower) ||
          request.status?.toLowerCase().includes(searchLower) ||
          request.submittedBy?.toLowerCase().includes(searchLower)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Plane className="h-8 w-8 mr-3 text-blue-400" />
              {user?.role === 'admin' ? 'Gestione Ferie' : 'Le Mie Ferie'}
            </h1>
            <p className="text-slate-400 mt-2">
              {user?.role === 'admin' 
                ? 'Visualizza e gestisci tutte le richieste di ferie dei dipendenti'
                : 'Gestisci le tue richieste di ferie e visualizza il bilancio ferie'
              }
            </p>
          </div>
          {user?.role !== 'admin' && (
            <button
              onClick={() => setShowNewRequest(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuova Richiesta
            </button>
          )}
        </div>
      </div>

      {/* Vacation Balance - Hours Based - Solo per dipendenti */}
      {user?.role !== 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Totale Ore</h3>
            <Clock className="h-8 w-8 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-400">{formatHours(vacationBalance.totalHours)}</p>
          <p className="text-slate-400 text-sm">Ore ferie annuali</p>
          <div className="mt-2 text-xs text-slate-500">
            <p>≈ {vacationBalance.totalDays.toFixed(1)} giorni</p>
            {vacationBalance.bonusHours > 0 && (
              <p>Bonus: +{formatHours(vacationBalance.bonusHours)}</p>
            )}
            {vacationBalance.has104 && (
              <p className="text-amber-400">+ Legge 104</p>
            )}
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Ore Utilizzate</h3>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">{formatHours(vacationBalance.usedHours)}</p>
          <p className="text-slate-400 text-sm">Ferie già godute</p>
          <div className="mt-2 text-xs text-slate-500">
            <p>≈ {vacationBalance.usedDays.toFixed(1)} giorni</p>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Ore Rimanenti</h3>
            <Sun className="h-8 w-8 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-400">{formatHours(vacationBalance.remainingHours)}</p>
          <p className="text-slate-400 text-sm">Disponibili per richieste</p>
          <div className="mt-2 text-xs text-slate-500">
            <p>≈ {vacationBalance.remainingDays.toFixed(1)} giorni</p>
          </div>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">In Attesa</h3>
            <AlertCircle className="h-8 w-8 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-400">{formatHours(vacationBalance.pendingHours)}</p>
          <p className="text-slate-400 text-sm">Richieste pendenti</p>
          <div className="mt-2 text-xs text-slate-500">
            <p>≈ {vacationBalance.pendingDays.toFixed(1)} giorni</p>
          </div>
        </div>
      </div>
      )}


      {/* New Request Modal */}
      {showNewRequest && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowNewRequest(false)}
        >
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                const dates = [];
                
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                  dates.push(d.toISOString().split('T')[0]);
                }

                let totalHours = 0;
                if (workPattern) {
                  dates.forEach(date => {
                    const dayOfWeek = new Date(date).getDay();
                    let dailyHours = 0;
                    
                    switch (dayOfWeek) {
                      case 1: dailyHours = workPattern.monday_hours; break;
                      case 2: dailyHours = workPattern.tuesday_hours; break;
                      case 3: dailyHours = workPattern.wednesday_hours; break;
                      case 4: dailyHours = workPattern.thursday_hours; break;
                      case 5: dailyHours = workPattern.friday_hours; break;
                      case 6: dailyHours = workPattern.saturday_hours; break;
                      case 0: dailyHours = workPattern.sunday_hours; break;
                    }
                    
                    totalHours += dailyHours;
                  });
                } else {
                  totalHours = dates.length * 8; // Fallback
                }

                const remainingAfterRequest = vacationBalance.remainingHours - totalHours;
                const canRequest = remainingAfterRequest >= 0;

                return (
                  <div className={`border rounded-lg p-4 ${canRequest ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <div className="flex items-center mb-2">
                      <Calculator className="h-4 w-4 mr-2 text-blue-400" />
                      <p className="text-blue-300 text-sm font-semibold">Calcolo Ore Richieste</p>
                    </div>
                    <p className="text-blue-300 text-sm">
                      <strong>Periodo:</strong> {calculateDays(formData.startDate, formData.endDate)} giorni
                    </p>
                    <p className="text-blue-300 text-sm">
                      <strong>Ore richieste:</strong> {formatHours(totalHours)}
                    </p>
                    <p className="text-blue-300 text-sm">
                      <strong>Ore rimanenti dopo questa richiesta:</strong> {formatHours(remainingAfterRequest)}
                    </p>
                    {!canRequest && (
                      <p className="text-red-300 text-sm mt-2 font-semibold">
                        ⚠️ Saldo insufficiente per questa richiesta
                      </p>
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
            {/* Filtro temporale per admin */}
            {user?.role === 'admin' && (
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
                placeholder="Cerca per note o stato..."
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

      {/* Requests List */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
          <FileText className="h-6 w-6 mr-3 text-slate-400" />
          {user?.role === 'admin' ? 'Gestione Richieste Ferie' : 'Storico Richieste Ferie'}
        </h2>

        {(() => {
          const filteredRequests = getFilteredRequests();
          return filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Plane className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">
                {user?.role === 'admin' 
                  ? `Nessuna richiesta per ${monthNames[currentMonth]} ${currentYear}`
                  : 'Nessuna richiesta di ferie presente'
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
                      <h3 className="text-lg font-semibold text-white ml-2">Richiesta Ferie</h3>
                      <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                        <span>Dal {formatDate(request.startDate)} al {formatDate(request.endDate)}</span>
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
                      <div className="mt-3 p-3 bg-slate-600 rounded-lg">
                        <p className="text-slate-300 text-sm">
                          <strong>Note:</strong> {request.notes}
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

export default Vacation;
