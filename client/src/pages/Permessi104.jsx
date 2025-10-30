import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
import CustomAlert from '../components/CustomAlert';
import { 
  Accessibility, 
  Plus, 
  Calendar, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Info
} from 'lucide-react';

const Permessi104 = () => {
  const { user, apiCall } = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  const [permissions104Status, setPermissions104Status] = useState({
    usedThisMonth: 0,
    maxPerMonth: 3,
    remaining: 3
  });

  const [formData, setFormData] = useState({
    date: '',
    notes: ''
  });

  useModal(showNewRequest, () => setShowNewRequest(false));

  useEffect(() => {
    if (user?.has_104) {
      fetchRequests();
      fetch104Status();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/leave-requests?type=permission_104');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching 104 requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetch104Status = async () => {
    try {
      const response = await apiCall('/api/104-permissions/count');
      if (response.ok) {
        const data = await response.json();
        setPermissions104Status(data);
      }
    } catch (error) {
      console.error('Error fetching 104 status:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date) {
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        message: 'Seleziona una data'
      });
      return;
    }

    // Verifica limite mensile
    if (permissions104Status.remaining <= 0) {
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Limite Raggiunto',
        message: `Hai già utilizzato tutti e 3 i permessi 104 per questo mese`
      });
      return;
    }

    try {
      const response = await apiCall('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'permission_104',
          startDate: formData.date,
          endDate: formData.date,
          reason: 'Permesso Legge 104 - Assistenza familiare',
          notes: formData.notes
        })
      });

      if (response.ok) {
        setAlert({
          isOpen: true,
          type: 'success',
          title: 'Permesso Registrato!',
          message: 'Il permesso 104 è stato registrato con successo'
        });
        setShowNewRequest(false);
        setFormData({ date: '', notes: '' });
        fetchRequests();
        fetch104Status();
      } else {
        const error = await response.json();
        setAlert({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          message: error.error || 'Errore nella registrazione del permesso'
        });
      }
    } catch (error) {
      console.error('Error creating 104 request:', error);
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        message: 'Errore di connessione'
      });
    }
  };

  if (!user?.has_104) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400 text-lg">
              Non hai accesso ai permessi Legge 104
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Accessibility className="h-8 w-8 mr-3 text-blue-400" />
              Permessi Legge 104
            </h1>
            <p className="text-slate-400 mt-2">
              Permessi mensili per assistenza a familiare con handicap grave
            </p>
          </div>
          
          <button
            onClick={() => setShowNewRequest(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
            disabled={permissions104Status.remaining === 0}
          >
            <Plus className="h-5 w-5 mr-2" />
            Aggiungi
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border-2 border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">PERMESSI USATI</p>
              <p className="text-3xl font-bold text-blue-400">
                {permissions104Status.usedThisMonth}/{permissions104Status.maxPerMonth}
              </p>
              <p className="text-xs text-slate-500 mt-1">questo mese</p>
            </div>
            <div className="p-3 rounded-full bg-blue-900/20 text-blue-400">
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">PERMESSI RIMANENTI</p>
              <p className={`text-3xl font-bold ${
                permissions104Status.remaining > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {permissions104Status.remaining}
              </p>
              <p className="text-xs text-slate-500 mt-1">disponibili</p>
            </div>
            <div className={`p-3 rounded-full ${
              permissions104Status.remaining > 0 ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
            }`}>
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">LIMITE MENSILE</p>
              <p className="text-3xl font-bold text-purple-400">
                {permissions104Status.maxPerMonth}
              </p>
              <p className="text-xs text-slate-500 mt-1">giorni/mese</p>
            </div>
            <div className="p-3 rounded-full bg-purple-900/20 text-purple-400">
              <Users className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-semibold mb-2">ℹ️ Informazioni sui Permessi Legge 104:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Hai diritto a <strong>3 giorni</strong> di permesso al mese</li>
              <li>I permessi sono <strong>auto-approvati</strong> (non serve attendere conferma)</li>
              <li><strong>Non vai in debito</strong> orario per questi giorni</li>
              <li>Risulti <strong>assente giustificato</strong> nelle presenze</li>
              <li>Il limite si azzera ogni mese (non si accumulano)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lista Richieste */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Storico Permessi 104</h2>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Nessun permesso 104 richiesto</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="bg-slate-700 rounded-lg p-4 border border-blue-500/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <span className="font-semibold text-white">
                        {new Date(request.startDate).toLocaleDateString('it-IT', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        request.status === 'approved' 
                          ? 'bg-green-900/30 text-green-400 border border-green-500/30' 
                          : 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30'
                      }`}>
                        {request.status === 'approved' ? 'Approvato' : 'In Attesa'}
                      </span>
                    </div>
                    
                    {request.notes && (
                      <p className="text-sm text-slate-400 ml-8">
                        Note: {request.notes}
                      </p>
                    )}
                    
                    <p className="text-xs text-slate-500 ml-8 mt-1">
                      Richiesto il: {new Date(request.submittedAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nuova Richiesta */}
      {showNewRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
              <Accessibility className="h-6 w-6 mr-2 text-blue-400" />
              Richiedi Permesso 104
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Status Rimanenti */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-200 text-sm">
                  <strong>Permessi disponibili questo mese:</strong> {permissions104Status.remaining}/3
                </p>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Permesso *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Note (opzionale)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Es. Assistenza per visita medica..."
                />
              </div>

              {/* Info Auto-approvazione */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <p className="text-sm text-green-200">
                    Questo permesso verrà <strong>auto-approvato</strong> immediatamente. Non è necessaria l'approvazione dell'admin.
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewRequest(false);
                    setFormData({ date: '', notes: '' });
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center"
                  disabled={permissions104Status.remaining === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Conferma Permesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert */}
      <CustomAlert
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
    </div>
  );
};

export default Permessi104;

