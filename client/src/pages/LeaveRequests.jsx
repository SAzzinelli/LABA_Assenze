import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { FileText, Plus, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';

const LeaveRequests = () => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      // Simulazione dati per ora
      const mockRequests = [
        { 
          id: 1, 
          employee: 'Marco Rossi', 
          type: 'Ferie', 
          startDate: '2024-02-01', 
          endDate: '2024-02-05',
          days: 5,
          status: 'pending',
          reason: 'Vacanze estive',
          submittedAt: '2024-01-15'
        },
        { 
          id: 2, 
          employee: 'Anna Bianchi', 
          type: 'Malattia', 
          startDate: '2024-01-20', 
          endDate: '2024-01-22',
          days: 3,
          status: 'approved',
          reason: 'Influenza',
          submittedAt: '2024-01-19'
        },
        { 
          id: 3, 
          employee: 'Luca Verdi', 
          type: 'Permesso', 
          startDate: '2024-01-25', 
          endDate: '2024-01-25',
          days: 1,
          status: 'rejected',
          reason: 'Visita medica',
          submittedAt: '2024-01-24'
        },
      ];
      setRequests(mockRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
              <FileText className="h-8 w-8 mr-3 text-amber-400" />
              Richieste Permessi
            </h1>
            <p className="text-slate-400 mt-2">
              {user?.role === 'admin' 
                ? 'Gestisci le richieste di permessi dei dipendenti'
                : 'Visualizza e gestisci le tue richieste di permessi'
              }
            </p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Nuova Richiesta
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-500 rounded-lg">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-slate-400 text-sm">In Attesa</p>
              <p className="text-2xl font-bold text-white">
                {requests.filter(r => r.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-500 rounded-lg">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-slate-400 text-sm">Approvate</p>
              <p className="text-2xl font-bold text-white">
                {requests.filter(r => r.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-500 rounded-lg">
              <XCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-slate-400 text-sm">Rifiutate</p>
              <p className="text-2xl font-bold text-white">
                {requests.filter(r => r.status === 'rejected').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-indigo-400" />
            Richieste Permessi
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Dipendente
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Periodo
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Giorni
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Stato
                </th>
                {user?.role === 'admin' && (
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Azioni
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-indigo-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {request.employee.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-white">{request.employee}</div>
                        <div className="text-sm text-slate-400">
                          Inviata: {formatDate(request.submittedAt)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {request.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      <div>{formatDate(request.startDate)}</div>
                      <div className="text-slate-400">al {formatDate(request.endDate)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {request.days} {request.days === 1 ? 'giorno' : 'giorni'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300 max-w-xs truncate">
                      {request.reason}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusText(request.status)}
                    </span>
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {request.status === 'pending' && (
                        <div className="flex items-center space-x-2">
                          <button className="text-green-400 hover:text-green-300">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button className="text-red-400 hover:text-red-300">
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequests;