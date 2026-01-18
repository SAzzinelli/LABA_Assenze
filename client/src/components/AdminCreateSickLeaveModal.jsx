import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { X, Calendar, AlertCircle, User, Heart } from 'lucide-react';
import CustomAlert from './CustomAlert';

const AdminCreateSickLeaveModal = ({ isOpen, onClose, onSuccess }) => {
  const { apiCall } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  
  const [formData, setFormData] = useState({
    userId: '',
    startDate: '',
    endDate: '',
    reason: '',
    notes: '',
    medicalCode: '',
    doctor: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      // Reset form
      setFormData({
        userId: '',
        startDate: '',
        endDate: '',
        reason: '',
        notes: '',
        medicalCode: '',
        doctor: ''
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
    
    if (!formData.userId || !formData.startDate || !formData.endDate || !formData.reason) {
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        message: 'Seleziona dipendente, date e motivo'
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        userId: formData.userId,
        type: 'sick_leave',
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        notes: formData.notes,
        doctor: formData.doctor,
        medicalCode: formData.medicalCode
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
          message: result.message || 'Malattia registrata con successo'
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
          message: error.error || 'Errore nella registrazione della malattia'
        });
      }
    } catch (error) {
      console.error('Error creating sick leave:', error);
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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-slate-800 sm:rounded-lg p-4 sm:p-6 w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <Heart className="h-6 w-6 mr-2 text-red-400" />
              Registra Malattia per Dipendente
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
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Motivo/Diagnosi *
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Es. Influenza, Infortunio, Covid-19, ecc."
              />
            </div>

            {/* Codice Certificato Medico */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Codice Certificato Medico
              </label>
              <input
                type="text"
                name="medicalCode"
                value={formData.medicalCode}
                onChange={handleInputChange}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Es. 123456789012345"
              />
              <p className="text-xs text-slate-400 mt-1">
                Inserisci il codice numerico del certificato medico telematico (se disponibile)
              </p>
            </div>

            {/* Medico / Struttura */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Medico / Struttura Sanitaria
              </label>
              <input
                type="text"
                name="doctor"
                value={formData.doctor}
                onChange={handleInputChange}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Es. Dr. Rossi / Ospedale Santa Maria"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Note Aggiuntive
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Note opzionali (es. contattato telefonicamente, prognosi, ecc.)"
              />
            </div>

            {/* Info Box */}
            {selectedEmployee && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-200">
                      <strong>Dipendente:</strong> {selectedEmployee.name}
                    </p>
                    <p className="text-sm text-red-200 mt-1">
                      La malattia verrà <strong>registrata come approvata</strong> e il dipendente riceverà una <strong>notifica</strong> e una <strong>email</strong> di conferma.
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
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Registrazione...
                  </>
                ) : (
                  <>
                    <Heart className="h-4 w-4 mr-2" />
                    Registra Malattia
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

export default AdminCreateSickLeaveModal;

