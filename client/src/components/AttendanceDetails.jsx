import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Pause, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../utils/store';

const AttendanceDetails = ({ userId, date, onClose }) => {
  const { apiCall } = useAuthStore();
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchDetails();
  }, [userId, date]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const response = await apiCall(`/api/attendance/details?userId=${userId}&date=${date}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Details response:', data);
        
        if (data.success && data.details) {
          setDetails(data.details);
        } else if (data.success && data.details === null) {
          // Nessun dettaglio disponibile
          setDetails([]);
        } else {
          setDetails([]);
        }
      } else {
        console.error('Errore nel recupero dettagli');
        setDetails([]);
      }
    } catch (error) {
      console.error('Errore fetch dettagli:', error);
      setDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const updateDetailStatus = async (detailId, newStatus) => {
    try {
      setUpdating(detailId);
      const response = await apiCall(`/api/attendance/details/${detailId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Aggiorna lo stato locale
        setDetails(prev => prev.map(detail => 
          detail.id === detailId 
            ? { ...detail, status: newStatus }
            : detail
        ));
      } else {
        console.error('Errore aggiornamento dettaglio');
      }
    } catch (error) {
      console.error('Errore aggiornamento:', error);
    } finally {
      setUpdating(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-400" />;
      case 'break':
        return <Pause className="h-4 w-4 text-yellow-400" />;
      case 'missed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      case 'break':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'missed':
        return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'pending':
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Completato';
      case 'in_progress':
        return 'In Corso';
      case 'break':
        return 'Pausa';
      case 'missed':
        return 'Mancato';
      case 'pending':
        return 'In Attesa';
      default:
        return 'Sconosciuto';
    }
  };

  const getPeriodLabel = (period) => {
    switch (period) {
      case 'mattina':
        return 'Mattina';
      case 'pausa_pranzo':
        return 'Pausa Pranzo';
      case 'pomeriggio':
        return 'Pomeriggio';
      default:
        return period;
    }
  };

  const formatTime = (timeString) => {
    return new Date(timeString).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-400 mr-3" />
            <span className="text-white">Caricamento dettagli presenze...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            Dettagli Presenze - {new Date(date).toLocaleDateString('it-IT')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        {!details || !details.summary ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">Nessun dettaglio disponibile per questa data</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Riepilogo principale */}
            <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
              <h3 className="text-xl font-semibold text-white mb-4">Riepilogo Giornata</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-sm text-slate-400">Dipendente</p>
                  <p className="text-lg font-bold text-white">
                    {details.summary.employee}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-400">Ore Attese</p>
                  <p className="text-lg font-bold text-blue-400">
                    {details.summary.expectedHours}h
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-400">Ore Effettive</p>
                  <p className="text-lg font-bold text-green-400">
                    {details.summary.actualHours}h
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-400">Saldo Ore</p>
                  <p className={`text-lg font-bold ${details.summary.balanceHours >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {details.summary.balanceHours >= 0 ? '+' : ''}{details.summary.balanceHours}h
                  </p>
                </div>
              </div>
              
              <div className="border-t border-slate-600 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-slate-400">Stato:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      details.summary.status === 'Presente' 
                        ? 'bg-green-500/20 text-green-300 border border-green-400/30' 
                        : 'bg-red-500/20 text-red-300 border border-red-400/30'
                    }`}>
                      {details.summary.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400">
                    Data: {new Date(details.summary.date).toLocaleDateString('it-IT')}
                  </div>
                </div>
                
                {details.summary.notes && (
                  <div className="mt-3 p-3 bg-slate-800 rounded border border-slate-600">
                    <p className="text-sm text-slate-300">
                      <strong>Note:</strong> {details.summary.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Orario di lavoro */}
            {details.schedule && (
              <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-3">Orario di Lavoro</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-400">Inizio</p>
                    <p className="text-lg font-bold text-white">
                      {details.schedule.start_time}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-400">Fine</p>
                    <p className="text-lg font-bold text-white">
                      {details.schedule.end_time}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-400">Pausa</p>
                    <p className="text-lg font-bold text-white">
                      {details.schedule.break_duration} min
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceDetails;
