import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { Clock, Calendar, CheckCircle, XCircle, MapPin } from 'lucide-react';

const Attendance = () => {
  const { user } = useAuthStore();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchAttendance();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAttendance = async () => {
    try {
      // Array vuoto - nessun dato placeholder
      setAttendance([]);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { 
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
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
              <Clock className="h-8 w-8 mr-3 text-green-400" />
              Presenze
            </h1>
            <p className="text-slate-400 mt-2">
              Gestisci le tue presenze e timbrature
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {formatTime(currentTime)}
            </div>
            <div className="text-slate-400 text-sm">
              {currentTime.toLocaleDateString('it-IT')}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Timbratura</h3>
          <div className="space-y-4">
            <button className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Timbra Entrata
            </button>
            <button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center">
              <XCircle className="h-5 w-5 mr-2" />
              Timbra Uscita
            </button>
          </div>
          <div className="mt-4 p-3 bg-slate-700 rounded-lg">
            <div className="flex items-center text-slate-300 text-sm">
              <MapPin className="h-4 w-4 mr-2" />
              Posizione: Ufficio LABA Firenze
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Stato Attuale</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Oggi</span>
              <span className="text-white font-medium">Non timbrato</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Ore lavorate</span>
              <span className="text-white font-medium">0h 0m</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Presenze questo mese</span>
              <span className="text-white font-medium">15/20</span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance History */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-indigo-400" />
            Cronologia Presenze
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Entrata
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Uscita
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Ore Lavorate
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Stato
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {attendance.map((record) => (
                <tr key={record.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {formatDate(record.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                      {record.checkIn}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300 flex items-center">
                      {record.checkOut ? (
                        <>
                          <XCircle className="h-4 w-4 mr-2 text-red-400" />
                          {record.checkOut}
                        </>
                      ) : (
                        <span className="text-slate-500">Non timbrato</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-300">
                      {record.hours || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      record.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {record.status === 'completed' ? 'Completato' : 'Incompleto'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Attendance;