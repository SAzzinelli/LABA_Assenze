import { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';

/**
 * Hook centralizzato per ottenere il saldo della Banca Ore (overtime balance)
 * 
 * @param {Object} options - Opzioni di configurazione
 * @param {string} options.userId - ID utente (opzionale, default: utente corrente)
 * @param {number} options.year - Anno di riferimento (opzionale, default: anno corrente)
 * @param {boolean} options.autoFetch - Se true, carica automaticamente al mount (default: true)
 * 
 * @returns {Object} { balance, status, debtHours, creditHours, loading, error, refetch }
 *   - balance: saldo totale (positivo = credito, negativo = debito, 0 = in pari)
 *   - status: 'positive' | 'negative' | 'zero'
 *   - debtHours: ore di debito (solo se balance < 0)
 *   - creditHours: ore di credito (solo se balance > 0)
 *   - loading: stato di caricamento
 *   - error: eventuale errore
 *   - refetch: funzione per ricaricare i dati
 */
export function useOvertimeBalance({ userId, year, autoFetch = true } = {}) {
  const { apiCall } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [status, setStatus] = useState('zero');
  const [debtHours, setDebtHours] = useState(0);
  const [creditHours, setCreditHours] = useState(0);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentYear = year || new Date().getFullYear();
      let url = `/api/hours/overtime-balance?year=${currentYear}`;
      
      if (userId) {
        url += `&userId=${userId}`;
      }

      const response = await apiCall(url);
      
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance || 0);
        setStatus(data.status || 'zero');
        setDebtHours(data.debtHours || 0);
        setCreditHours(data.creditHours || 0);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
        setError(errorData.error || 'Errore nel recupero del saldo');
        // In caso di errore, imposta valori di default
        setBalance(0);
        setStatus('zero');
        setDebtHours(0);
        setCreditHours(0);
      }
    } catch (err) {
      console.error('Error fetching overtime balance:', err);
      setError(err.message || 'Errore di connessione');
      // In caso di errore, imposta valori di default
      setBalance(0);
      setStatus('zero');
      setDebtHours(0);
      setCreditHours(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchBalance();
    }
  }, [userId, year, autoFetch]);

  return {
    balance,
    status,
    debtHours,
    creditHours,
    loading,
    error,
    refetch: fetchBalance
  };
}

