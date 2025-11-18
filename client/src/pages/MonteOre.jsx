import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
import { 
  Clock, 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  RefreshCw,
  Calculator,
  History,
  Target
} from 'lucide-react';

// Hook per ottenere i dati utente
const useUser = () => {
  const { user } = useAuthStore();
  return user;
};

const MonteOre = () => {
  const user = useUser();
  const { apiCall } = useAuthStore();
  const [overtimeBalance, setOvertimeBalance] = useState({
    total_accrued: 0,
    total_used: 0,
    current_balance: 0,
    pending_requests: 0
  });
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('add'); // 'add' or 'use'

  // Hook per gestire chiusura modal con ESC e click fuori
  useModal(showModal, () => setShowModal(false));
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: '',
    type: ''
  });

  const [formData, setFormData] = useState({
    hours: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchOvertimeData();
  }, [filters]);

  const fetchOvertimeData = async () => {
    try {
      setLoading(true);
      
      // Fetch current balance usando l'endpoint centralizzato (coerente con tutta l'app)
      const balanceResponse = await apiCall(`/api/hours/overtime-balance?year=${filters.year}`);
      
      // Fetch dettagli del ledger (total_accrued, total_used, pending_requests)
      const ledgerResponse = await apiCall(`/api/hours/current-balances?year=${filters.year}`);

      // Combina i dati: usa il saldo centralizzato e i dettagli del ledger
      let overtimeBalance = {
        total_accrued: 0,
        total_used: 0,
        current_balance: 0,
        pending_requests: 0
      };

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        overtimeBalance.current_balance = balanceData.balance || 0;
        console.log('💰 Overtime balance (centralized):', {
          balance: balanceData.balance,
          status: balanceData.status,
          debtHours: balanceData.debtHours,
          creditHours: balanceData.creditHours
        });
      }

      if (ledgerResponse.ok) {
        const balances = await ledgerResponse.json();
        const ledgerData = balances.find(b => b.category === 'overtime');
        if (ledgerData) {
          // Mantieni total_accrued, total_used, pending_requests dal ledger
          overtimeBalance.total_accrued = ledgerData.total_accrued || 0;
          overtimeBalance.total_used = ledgerData.total_used || 0;
          overtimeBalance.pending_requests = ledgerData.pending_requests || 0;
          // current_balance viene già dal nuovo endpoint centralizzato sopra
        }
      }

      setOvertimeBalance(overtimeBalance);

      // Fetch transactions
      const transactionsResponse = await fetch(`/api/hours/hours-ledger?category=overtime&year=${filters.year}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (transactionsResponse.ok) {
        const data = await transactionsResponse.json();
        setTransactions(data);
      } else {
        setTransactions([]);
        setOvertimeBalance({
          total_accrued: 0,
          total_used: 0,
          current_balance: 0,
          pending_requests: 0
        });
      }
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const transactionData = {
        category: 'overtime',
        transaction_type: modalType === 'add' ? 'accrual' : 'usage',
        hours: parseFloat(formData.hours),
        transaction_date: formData.date,
        reason: formData.reason,
        notes: formData.notes || '',
        period_year: new Date(formData.date).getFullYear(),
        period_month: new Date(formData.date).getMonth() + 1
      };

      const response = await apiCall('/api/hours/hours-ledger', {
        method: 'POST',
        body: JSON.stringify(transactionData)
      });

      if (response.ok) {
        setShowModal(false);
        resetForm();
        fetchOvertimeData();
      } else {
        console.error('Errore nel salvataggio della transazione');
      }
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      hours: '',
      reason: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'accrual': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'usage': return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'expiration': return <XCircle className="w-5 h-5 text-orange-500" />;
      case 'adjustment': return <RefreshCw className="w-5 h-5 text-blue-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'accrual': return 'bg-green-500/20 text-green-300 border border-green-400/30';
      case 'usage': return 'bg-red-500/20 text-red-300 border border-red-400/30';
      case 'expiration': return 'bg-orange-500/20 text-orange-300 border border-orange-400/30';
      case 'adjustment': return 'bg-blue-500/20 text-blue-300 border border-blue-400/30';
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-400/30';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatHours = (hours) => {
    return `${hours}h`;
  };

  const calculateMonthlyStats = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const monthlyTransactions = transactions.filter(t => 
      t.period_year === currentYear && t.period_month === currentMonth
    );
    
    const accrued = monthlyTransactions
      .filter(t => t.transaction_type === 'accrual')
      .reduce((sum, t) => sum + t.hours, 0);
    
    const used = monthlyTransactions
      .filter(t => t.transaction_type === 'usage')
      .reduce((sum, t) => sum + t.hours, 0);
    
    return { accrued, used, net: accrued - used };
  };

  const monthlyStats = calculateMonthlyStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {user?.role === 'admin' || user?.role === 'Amministratore' ? 'Gestione Monte Ore' : 'Il Mio Monte Ore'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            {user?.role === 'admin' || user?.role === 'Amministratore'
              ? 'Visualizza e gestisci tutti i monte ore dei dipendenti'
              : 'Gestisci i tuoi straordinari e permessi di recupero'
            }
          </p>
        </div>
        {user?.role !== 'admin' && user?.role !== 'Amministratore' && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setModalType('add');
                resetForm();
                setShowModal(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Aggiungi Ore
            </button>
            <button
              onClick={() => {
                setModalType('use');
                resetForm();
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Minus className="w-5 h-5" />
              Usa Ore
            </button>
          </div>
        )}
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">Totale Maturate</p>
              <p className="text-2xl font-bold text-green-400">{formatHours(overtimeBalance.total_accrued)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">Totale Usate</p>
              <p className="text-2xl font-bold text-red-400">{formatHours(overtimeBalance.total_used)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">Saldo Attuale</p>
              <p className="text-2xl font-bold text-blue-400">{formatHours(overtimeBalance.current_balance)}</p>
            </div>
            <Target className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">In Attesa</p>
              <p className="text-2xl font-bold text-yellow-400">{formatHours(overtimeBalance.pending_requests)}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Statistiche Mensili</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-300">Ore Maturate</p>
            <p className="text-xl font-bold text-green-400">{formatHours(monthlyStats.accrued)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-300">Ore Usate</p>
            <p className="text-xl font-bold text-red-400">{formatHours(monthlyStats.used)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-300">Bilancio Netto</p>
            <p className={`text-xl font-bold ${monthlyStats.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatHours(monthlyStats.net)}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-700">
        <div className="flex gap-4 items-center">
          <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <select
            value={filters.year}
            onChange={(e) => setFilters({...filters, year: e.target.value})}
            className="border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2"
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          
          <select
            value={filters.month}
            onChange={(e) => setFilters({...filters, month: e.target.value})}
            className="border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2"
          >
            <option value="">Tutti i mesi</option>
            <option value="1">Gennaio</option>
            <option value="2">Febbraio</option>
            <option value="3">Marzo</option>
            <option value="4">Aprile</option>
            <option value="5">Maggio</option>
            <option value="6">Giugno</option>
            <option value="7">Luglio</option>
            <option value="8">Agosto</option>
            <option value="9">Settembre</option>
            <option value="10">Ottobre</option>
            <option value="11">Novembre</option>
            <option value="12">Dicembre</option>
          </select>
          
          <select
            value={filters.type}
            onChange={(e) => setFilters({...filters, type: e.target.value})}
            className="border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2"
          >
            <option value="">Tutti i tipi</option>
            <option value="accrual">Maturate</option>
            <option value="usage">Usate</option>
            <option value="expiration">Scadute</option>
            <option value="adjustment">Rettifiche</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Movimenti Monte Ore</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <History className="w-4 h-4" />
              <span>{transactions.length} movimenti</span>
            </div>
          </div>
        </div>
        
        <div className="divide-y divide-gray-700">
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Nessun movimento trovato</h3>
              <p className="text-gray-400 mb-4">Inizia aggiungendo ore di straordinario</p>
              <button
                onClick={() => {
                  setModalType('add');
                  resetForm();
                  setShowModal(true);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Aggiungi Ore
              </button>
            </div>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="p-6 hover:bg-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(transaction.transaction_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTransactionColor(transaction.transaction_type)}`}>
                          {transaction.transaction_type}
                        </span>
                        <span className="text-sm text-gray-400">
                          {formatDate(transaction.transaction_date)}
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white font-medium mt-1">{transaction.reason}</p>
                      {transaction.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{transaction.notes}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-lg font-bold ${transaction.transaction_type === 'accrual' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.transaction_type === 'accrual' ? '+' : '-'}{formatHours(transaction.hours)}
                    </p>
                    <p className="text-sm text-gray-400">
                      {transaction.period_month}/{transaction.period_year}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              {modalType === 'add' ? 'Aggiungi Ore Straordinario' : 'Usa Ore per Permesso'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Ore *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.hours}
                  onChange={(e) => setFormData({...formData, hours: e.target.value})}
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Data *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Motivo *
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={modalType === 'add' ? 'Es. Straordinario progetto urgente' : 'Es. Permesso recupero ore'}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Note
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="3"
                  className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Note aggiuntive..."
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-300 border border-gray-600 bg-gray-700 rounded-lg hover:bg-gray-600"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg ${
                    modalType === 'add' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {modalType === 'add' ? 'Aggiungi' : 'Usa'} Ore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonteOre;
