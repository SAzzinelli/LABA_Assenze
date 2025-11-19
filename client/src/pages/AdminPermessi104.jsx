import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import AdminCreate104PermissionModal from '../components/AdminCreate104PermissionModal';
import { 
  Accessibility, 
  Plus, 
  Calendar, 
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const AdminPermessi104 = () => {
  const { user, apiCall } = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [employees104, setEmployees104] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchEmployees104();
  }, []);

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

  const fetchEmployees104 = async () => {
    try {
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        const with104 = data.filter(emp => emp.has104 === true);
        setEmployees104(with104);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Raggruppa richieste per dipendente
  const requestsByEmployee = employees104.map(emp => {
    const empRequests = requests.filter(req => req.user?.id === emp.id);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Calcola giorni utilizzati dalle richieste approvate del mese corrente
    const thisMonthApproved = empRequests.filter(req => {
      const reqDate = new Date(req.startDate);
      return reqDate.getMonth() === currentMonth && 
             reqDate.getFullYear() === currentYear &&
             req.status === 'approved';
    });

    // Somma i giorni richiesti (non solo conta le richieste)
    const usedDaysThisMonth = thisMonthApproved.reduce((sum, req) => {
      const days = req.days_requested || 1;
      return sum + Math.ceil(days);
    }, 0);

    // Calcola giorni pending del mese corrente
    const thisMonthPending = empRequests.filter(req => {
      const reqDate = new Date(req.startDate);
      return reqDate.getMonth() === currentMonth && 
             reqDate.getFullYear() === currentYear &&
             req.status === 'pending';
    });

    const pendingDaysThisMonth = thisMonthPending.reduce((sum, req) => {
      const days = req.days_requested || 1;
      return sum + Math.ceil(days);
    }, 0);

    const remaining = Math.max(0, 3 - usedDaysThisMonth - pendingDaysThisMonth);

    return {
      employee: emp,
      usedThisMonth: usedDaysThisMonth,
      pendingThisMonth: pendingDaysThisMonth,
      remaining: remaining,
      allRequests: empRequests // Tutte le richieste, non solo quelle del mese corrente
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <Accessibility className="h-8 w-8 mr-3 text-blue-400" />
              Gestione Permessi Legge 104
            </h1>
            <p className="text-slate-400 mt-2">
              Gestisci i permessi mensili per dipendenti con Legge 104
            </p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Aggiungi
          </button>
        </div>
      </div>

      {/* Lista Dipendenti con 104 */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-400" />
          Dipendenti con Legge 104
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : employees104.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Nessun dipendente con Legge 104</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requestsByEmployee.map(({ employee, usedThisMonth, remaining, allRequests }) => (
              <div key={employee.id} className="bg-slate-700 rounded-lg p-4 border-2 border-blue-500/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                      <Accessibility className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{employee.name}</p>
                      <p className="text-xs text-slate-400">{employee.department}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-slate-800 rounded p-2">
                    <p className="text-xs text-slate-400">Usati</p>
                    <p className="text-lg font-bold text-blue-400">{usedThisMonth}/3</p>
                  </div>
                  <div className="bg-slate-800 rounded p-2">
                    <p className="text-xs text-slate-400">Rimanenti</p>
                    <p className={`text-lg font-bold ${
                      remaining > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {remaining}
                    </p>
                  </div>
                </div>

                {allRequests.length > 0 && (
                  <div className="border-t border-slate-600 pt-3 mt-3">
                    <p className="text-xs text-slate-400 mb-2">Ultimi permessi:</p>
                    <div className="space-y-1">
                      {allRequests.slice(0, 3).map(req => (
                        <div key={req.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">
                            {new Date(req.startDate).toLocaleDateString('it-IT')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full ${
                            req.status === 'approved' 
                              ? 'bg-green-900/30 text-green-400' 
                              : 'bg-yellow-900/30 text-yellow-400'
                          }`}>
                            {req.status === 'approved' ? '✓' : '⏳'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista completa richieste 104 */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-blue-400" />
          Tutte le Richieste 104
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">Nessuna richiesta 104 registrata</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests
              .sort((a, b) => new Date(b.startDate || b.submittedAt) - new Date(a.startDate || a.submittedAt))
              .map((request) => (
              <div key={request.id} className="bg-slate-700 rounded-lg p-4 border border-blue-500/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Accessibility className="h-5 w-5 text-blue-400" />
                      <span className="font-semibold text-white">
                        {request.user?.name || request.submittedBy || 'Dipendente'}
                      </span>
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-300">
                        {request.startDate === request.endDate ? (
                          new Date(request.startDate).toLocaleDateString('it-IT', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })
                        ) : (
                          <>
                            dal {new Date(request.startDate).toLocaleDateString('it-IT', { 
                              day: 'numeric', 
                              month: 'long' 
                            })} al {new Date(request.endDate).toLocaleDateString('it-IT', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </>
                        )}
                      </span>
                      {request.days_requested && (
                        <span className="text-xs text-blue-300 ml-2">
                          ({request.days_requested} {request.days_requested === 1 ? 'giorno' : 'giorni'})
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        request.status === 'approved' 
                          ? 'bg-green-900/30 text-green-400 border border-green-500/30' 
                          : request.status === 'pending'
                            ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-900/30 text-red-400 border border-red-500/30'
                      }`}>
                        {request.status === 'approved' ? 'Approvato' : request.status === 'pending' ? 'In Attesa' : 'Rifiutato'}
                      </span>
                    </div>
                    
                    {request.notes && (
                      <p className="text-sm text-slate-400 ml-8">
                        Note: {request.notes}
                      </p>
                    )}
                    
                    <p className="text-xs text-slate-500 ml-8 mt-1">
                      Richiesto il: {new Date(request.submittedAt).toLocaleDateString('it-IT', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <AdminCreate104PermissionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchRequests();
          fetchEmployees104();
        }}
      />
    </div>
  );
};

export default AdminPermessi104;

