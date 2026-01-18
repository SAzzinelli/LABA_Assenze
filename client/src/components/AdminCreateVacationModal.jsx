import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { X, Calendar, AlertCircle, User, Plane } from 'lucide-react';
import CustomAlert from './CustomAlert';

const AdminCreateVacationModal = ({ isOpen, onClose, onSuccess }) => {
  const { apiCall } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  
  const [formData, setFormData] = useState({
    userId: '',
    startDate: '',
    endDate: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      // Reset form
      setFormData({
        userId: '',
        startDate: '',
        endDate: '',
        notes: ''
      });
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.userId || !formData.startDate || !formData.endDate) {
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        message: 'Seleziona dipendente, data inizio e data fine'
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        userId: formData.userId,
        type: 'vacation',
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: 'Ferie',
        notes: formData.notes
      };

      const response = await apiCall('/api/admin/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        setAlert({
          isOpen: true,
          type: 'success',
          title: 'Successo!',
          message: result.message || 'Ferie registrate con successo'
        });
        
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        const error = await response.json();
        setAlert({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          message: error.error || 'Errore nella registrazione delle ferie'
        });
      }
    } catch (error) {
      console.error('Error creating vacation:', error);
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        message: 'Errore di connessione. Riprova.'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedEmployee = employees.find(emp => emp.id === formData.userId);

  // Calcola giorni richiesti
  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return days;
    }
    return 0;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-slate-800 sm:rounded-lg p-4 sm:p-6 w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <Plane className="h-6 w-6 mr-2 text-blue-400" />
              Registra Ferie per Dipendente
            </h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seleziona Dipendente */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Seleziona Dipendente *
              </label>
              <select
                name="userId"
                value={formData.userId}
                onChange={handleInputChange}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
              >
                <option value="">-- Seleziona un dipendente --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} - {emp.department}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Inizio *
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Fine *
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
                />
              </div>
            </div>

            {/* Giorni calcolati */}
            {calculateDays() > 0 && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm text-blue-200">
                  <strong>Giorni richiesti:</strong> {calculateDays()} giorno{calculateDays() > 1 ? 'i' : ''}
                </p>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Note / Destinazione (opzionale)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
                placeholder="Es. Ferie estive, Viaggio in Spagna, ecc."
              />
            </div>

            {/* Info Box */}
            {selectedEmployee && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-200">
                      <strong>Dipendente:</strong> {selectedEmployee.name}
                    </p>
                    <p className="text-sm text-blue-200 mt-1">
                      Le ferie verranno <strong>registrate come approvate</strong> e il dipendente riceverà una <strong>notifica</strong> e una <strong>email</strong> di conferma.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                disabled={loading}
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Registrazione...
                  </>
                ) : (
                  <>
                    <Plane className="h-4 w-4 mr-2" />
                    Registra Ferie
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Alert */}
      <CustomAlert
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        type={alert.type}
        title={alert.title}
        message={alert.message}
      />
    </>
  );
};

export default AdminCreateVacationModal;

