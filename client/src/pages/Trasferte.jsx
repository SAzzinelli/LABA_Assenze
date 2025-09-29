import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useModal } from '../hooks/useModal';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Plane, 
  Car, 
  Train, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Filter,
  Download,
  Upload
} from 'lucide-react';

// Hook per ottenere i dati utente
const useUser = () => {
  const { user } = useAuthStore();
  return user;
};

const Trasferte = () => {
  const user = useUser();
  const { apiCall } = useAuthStore();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Hook per gestire chiusura modal con ESC e click fuori
  useModal(showModal, () => setShowModal(false));
  const [editingTrip, setEditingTrip] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    year: new Date().getFullYear(),
    month: ''
  });

  const [formData, setFormData] = useState({
    destination: '',
    purpose: '',
    departure_date: '',
    return_date: '',
    travel_hours: 0,
    event_hours: 0,
    notes: ''
  });

  useEffect(() => {
    fetchTrips();
  }, [filters]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.year) queryParams.append('year', filters.year);
      if (filters.month) queryParams.append('month', filters.month);

      const response = await apiCall(`/api/hours/business-trips?${queryParams}`);

      if (response.ok) {
        const data = await response.json();
        setTrips(data);
      } else {
        console.error('Errore nel recupero delle trasferte');
        setTrips([]);
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
      const url = editingTrip ? `/api/hours/business-trips/${editingTrip.id}` : '/api/hours/business-trips';
      const method = editingTrip ? 'PUT' : 'POST';
      
      const tripData = {
        ...formData,
        total_hours: parseFloat(formData.travel_hours) + parseFloat(formData.event_hours)
      };

      const response = await apiCall(url, {
        method,
        body: JSON.stringify(tripData)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingTrip(null);
        resetForm();
        fetchTrips();
      } else {
        console.error('Errore nel salvataggio della trasferta');
      }
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const handleEdit = (trip) => {
    setEditingTrip(trip);
    setFormData({
      destination: trip.destination,
      purpose: trip.purpose,
      departure_date: trip.departure_date,
      return_date: trip.return_date,
      travel_hours: trip.travel_hours,
      event_hours: trip.event_hours,
      notes: trip.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (tripId) => {
    if (window.confirm('Sei sicuro di voler eliminare questa trasferta?')) {
      try {
        const response = await apiCall(`/api/hours/business-trips/${tripId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          fetchTrips();
        } else {
          console.error('Errore nell\'eliminazione della trasferta');
        }
      } catch (error) {
        console.error('Errore:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      destination: '',
      purpose: '',
      departure_date: '',
      return_date: '',
      travel_hours: 0,
      event_hours: 0,
      notes: ''
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'completed': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      default: return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-300 border border-green-400/30';
      case 'rejected': return 'bg-red-500/20 text-red-300 border border-red-400/30';
      case 'completed': return 'bg-blue-500/20 text-blue-300 border border-blue-400/30';
      default: return 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30';
    }
  };

  const getTransportIcon = (destination) => {
    if (destination.toLowerCase().includes('roma') || destination.toLowerCase().includes('milano')) {
      return <Train className="w-4 h-4" />;
    } else if (destination.toLowerCase().includes('internazionale')) {
      return <Plane className="w-4 h-4" />;
    } else {
      return <Car className="w-4 h-4" />;
    }
  };

  const calculateTotalHours = () => {
    return parseFloat(formData.travel_hours || 0) + parseFloat(formData.event_hours || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatHours = (hours) => {
    return `${hours}h`;
  };

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
            {user?.role === 'admin' || user?.role === 'Amministratore' ? 'Gestione Trasferte' : 'Le Mie Trasferte'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            {user?.role === 'admin' || user?.role === 'Amministratore'
              ? 'Visualizza e gestisci tutte le richieste di trasferte dei dipendenti'
              : 'Gestisci le tue richieste di trasferte e viaggi per eventi'
            }
          </p>
        </div>
        {user?.role !== 'admin' && user?.role !== 'Amministratore' && (
          <button
            onClick={() => {
              resetForm();
              setEditingTrip(null);
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuova Trasferta
          </button>
        )}
      </div>

      {/* Filtri */}
      <div className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-700">
        <div className="flex gap-4 items-center">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2"
          >
            <option value="">Tutti gli stati</option>
            <option value="pending">In attesa</option>
            <option value="approved">Approvate</option>
            <option value="rejected">Rifiutate</option>
            <option value="completed">Completate</option>
          </select>
          
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
        </div>
      </div>

      {/* Lista Trasferte */}
      <div className="grid gap-4">
        {trips.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna trasferta trovata</h3>
            <p className="text-gray-500 mb-4">Inizia creando la tua prima trasferta</p>
            <button
              onClick={() => {
                resetForm();
                setEditingTrip(null);
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Crea Trasferta
            </button>
          </div>
        ) : (
          trips.map((trip) => (
            <div key={trip.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getTransportIcon(trip.destination)}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{trip.destination}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trip.status)}`}>
                      {trip.status}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-300 mb-3">{trip.purpose}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400">Partenza:</span>
                      <span className="font-medium text-gray-300">{formatDate(trip.departure_date)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400">Ritorno:</span>
                      <span className="font-medium text-gray-300">{formatDate(trip.return_date)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400">Viaggio:</span>
                      <span className="font-medium text-gray-300">{formatHours(trip.travel_hours)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400">Evento:</span>
                      <span className="font-medium text-gray-300">{formatHours(trip.event_hours)}</span>
                    </div>
                  </div>
                  
                  {trip.notes && (
                    <div className="mt-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
                      <p className="text-sm text-gray-300">{trip.notes}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {getStatusIcon(trip.status)}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(trip)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(trip.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-400">
                    Totale ore: <span className="font-semibold text-gray-300">{formatHours(trip.total_hours)}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Creata il {formatDate(trip.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              {editingTrip ? 'Modifica Trasferta' : 'Nuova Trasferta'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Destinazione *
                  </label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({...formData, destination: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Scopo *
                  </label>
                  <input
                    type="text"
                    value={formData.purpose}
                    onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Data Partenza *
                  </label>
                  <input
                    type="date"
                    value={formData.departure_date}
                    onChange={(e) => setFormData({...formData, departure_date: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Data Ritorno *
                  </label>
                  <input
                    type="date"
                    value={formData.return_date}
                    onChange={(e) => setFormData({...formData, return_date: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Ore Viaggio
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.travel_hours}
                    onChange={(e) => setFormData({...formData, travel_hours: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Ore Evento
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.event_hours}
                    onChange={(e) => setFormData({...formData, event_hours: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
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
                />
              </div>
              
              <div className="bg-blue-900 p-3 rounded-lg border border-blue-700">
                <div className="flex items-center gap-2 text-sm text-blue-200">
                  <Clock className="w-4 h-4" />
                  <span>Totale ore calcolato: <strong>{formatHours(calculateTotalHours())}</strong></span>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingTrip(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-300 border border-gray-600 bg-gray-700 rounded-lg hover:bg-gray-600"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingTrip ? 'Aggiorna' : 'Crea'} Trasferta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trasferte;
