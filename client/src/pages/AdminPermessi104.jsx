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
    
    const thisMonthRequests = empRequests.filter(req => {
      const reqDate = new Date(req.startDate);
      return reqDate.getMonth() === currentMonth && 
             reqDate.getFullYear() === currentYear &&
             req.status === 'approved';
    });

    return {
      employee: emp,
      usedThisMonth: thisMonthRequests.length,
      remaining: 3 - thisMonthRequests.length,
      allRequests: empRequests
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

