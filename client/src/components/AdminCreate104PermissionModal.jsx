import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { X, Calendar, AlertCircle, User, Accessibility } from 'lucide-react';
import CustomAlert from './CustomAlert';

const AdminCreate104PermissionModal = ({ isOpen, onClose, onSuccess }) => {
  const { apiCall } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  
  const [formData, setFormData] = useState({
    userId: '',
    date: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      setFormData({
        userId: '',
        date: '',
        notes: ''
      });
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        // Filtra solo dipendenti con has_104
        const employees104 = data.filter(emp => emp.has104 === true);
        setEmployees(employees104);
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
    
    if (!formData.userId || !formData.date) {
      setAlert({
        isOpen: true,
        type: 'error',
        title: 'Errore',
        message: 'Seleziona dipendente e data'
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        userId: formData.userId,
        type: 'permission_104',
        startDate: formData.date,
        endDate: formData.date,
        reason: 'Permesso Legge 104 - Assistenza familiare',
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
          message: result.message || 'Permesso 104 registrato con successo'
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
          message: error.error || 'Errore nella registrazione del permesso 104'
        });
      }
    } catch (error) {
      console.error('Error creating 104 permission:', error);
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
        <div className="bg-zinc-900 sm:rounded-lg p-4 sm:p-6 w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <Accessibility className="h-6 w-6 mr-2 text-slate-400" />
              Registra Permesso 104 per Dipendente
            </h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {employees.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">
                Nessun dipendente con Legge 104 trovato
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Seleziona Dipendente */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Seleziona Dipendente (solo con Legge 104) *
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
                      {emp.name} - {emp.department} 🔵
                    </option>
                  ))}
                </select>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data Permesso *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
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
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
                  placeholder="Note opzionali (es. contattato telefonicamente, ecc.)"
                />
              </div>

              {/* Info Box */}
              {selectedEmployee && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-slate-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-300">
                        <strong>Dipendente:</strong> {selectedEmployee.name} 🔵
                      </p>
                      <p className="text-sm text-slate-300 mt-1">
                        Il permesso 104 verrà <strong>registrato come approvato</strong> (giorno intero) e il dipendente riceverà notifica ed email.
                      </p>
                      <p className="text-sm text-slate-300 mt-1">
                        <strong>Importante:</strong> Non andrà in debito orario per questo giorno.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700"
                  disabled={loading}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Registrazione...
                    </>
                  ) : (
                    <>
                      <Accessibility className="h-4 w-4 mr-2" />
                      Registra Permesso 104
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
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

export default AdminCreate104PermissionModal;

