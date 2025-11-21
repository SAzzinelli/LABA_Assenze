import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { X, Calendar, AlertCircle, User, FileText, Clock } from 'lucide-react';
import CustomAlert from './CustomAlert';

const AdminCreatePermissionModal = ({ isOpen, onClose, onSuccess }) => {
  const { apiCall } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ isOpen: false, type: 'success', title: '', message: '' });
  
  const [formData, setFormData] = useState({
    userId: '',
    date: '', // Solo una data per i permessi
    reason: '',
    notes: '',
    permissionType: '',
    exitTime: '',
    entryTime: ''
  });
  
  const [workSchedules, setWorkSchedules] = useState([]);
  const [calculatedHours, setCalculatedHours] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      fetchWorkSchedules();
      // Reset form e imposta data di oggi
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        userId: '',
        date: today, // Imposta automaticamente oggi
        reason: '',
        notes: '',
        permissionType: '',
        exitTime: '',
        entryTime: ''
      });
      setCalculatedHours(null);
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

  const fetchWorkSchedules = async () => {
    try {
      const response = await apiCall('/api/work-schedules');
      if (response && response.ok) {
        const data = await response.json();
        // Normalizza struttura per admin
        const normalized = data.map(schedule => ({
          ...schedule,
          user_id: schedule.users?.id || schedule.user_id
        }));
        setWorkSchedules(normalized || []);
      }
    } catch (error) {
      console.error('Error fetching work schedules:', error);
    }
  };

  // Calcola ore per permesso tutta la giornata
  const calculateFullDayHours = (userId, date) => {
    if (!userId || !date) return null;

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    // Trova lo schedule per questo utente e questo giorno
    const schedule = workSchedules.find(s => 
      s.user_id === userId &&
      Number(s.day_of_week) === Number(dayOfWeek) &&
      s.is_working_day === true
    );

    if (!schedule || !schedule.start_time || !schedule.end_time) {
      return null;
    }

    // Calcola ore totali
    const [startHour, startMin] = schedule.start_time.split(':').map(Number);
    const [endHour, endMin] = schedule.end_time.split(':').map(Number);
    const breakDuration = schedule.break_duration !== null && schedule.break_duration !== undefined ? schedule.break_duration : 0;

    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const workMinutes = Math.max(0, totalMinutes - breakDuration);
    const hours = workMinutes / 60;

    return parseFloat(hours.toFixed(2));
  };

  // Aggiorna ore calcolate quando cambiano userId, date o permissionType
  useEffect(() => {
    if (formData.permissionType === 'full_day' && formData.userId && formData.date) {
      const hours = calculateFullDayHours(formData.userId, formData.date);
      setCalculatedHours(hours);
      console.log(`✅ Full day hours calculated: ${hours !== null ? hours.toFixed(2) + 'h' : 'null'}`);
    } else if (formData.permissionType !== 'full_day') {
      setCalculatedHours(null);
    }
  }, [formData.userId, formData.date, formData.permissionType, workSchedules]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updated = {
      ...prev,
        [name]: newValue
      };
      
      // Se cambia permissionType a full_day, resetta i campi tempo
      if (name === 'permissionType') {
        if (value === 'full_day') {
          updated.exitTime = '';
          updated.entryTime = '';
        }
      }
      
      return updated;
    });
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

    if (!formData.permissionType) {
      setAlert({
        isOpen: true,
        type: 'error',
        message: 'Seleziona il tipo di permesso'
      });
      return;
    }

    // Se è permesso tutta la giornata, verifica che le ore siano state calcolate
    if (formData.permissionType === 'full_day') {
      if (!calculatedHours || calculatedHours <= 0) {
        setAlert({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          message: 'Impossibile calcolare le ore. Verifica che il dipendente abbia un orario configurato per questo giorno.'
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Per i permessi, startDate e endDate sono la stessa data
      const payload = {
        userId: formData.userId,
        startDate: formData.date,
        endDate: formData.date,
        type: 'permission',
        reason: formData.reason || (formData.permissionType === 'full_day' ? 'Permesso - Tutta la giornata' : 'Permesso'),
        notes: formData.notes || '',
        permissionType: formData.permissionType,
        exitTime: formData.permissionType === 'full_day' ? null : (formData.exitTime || null),
        entryTime: formData.permissionType === 'full_day' ? null : (formData.entryTime || null),
        hours: formData.permissionType === 'full_day' ? calculatedHours : null // Per tutta la giornata, usa ore calcolate
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
          message: result.message || 'Richiesta creata con successo'
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
          message: error.error || 'Errore nella creazione della richiesta'
        });
      }
    } catch (error) {
      console.error('Error creating leave request:', error);
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
              <FileText className="h-6 w-6 mr-2 text-purple-400" />
              Registra Permesso per Dipendente
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
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">-- Seleziona un dipendente --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} - {emp.department}
                  </option>
                ))}
              </select>
            </div>

            {/* Data del Permesso */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Data del Permesso *
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-400 mt-1">
                Il permesso si applica solo a questo giorno specifico
              </p>
            </div>

            {/* Campi specifici per Permesso */}
            <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Tipo Permesso *
                  </label>
                  <select
                    name="permissionType"
                    value={formData.permissionType}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">-- Seleziona tipo permesso --</option>
                    <option value="full_day">Giornata completa</option>
                    <option value="late_entry">Entrata Posticipata</option>
                    <option value="early_exit">Uscita Anticipata</option>
                  </select>
                  
                  {formData.permissionType === 'full_day' && calculatedHours !== null && (
                    <p className="text-xs text-indigo-400 mt-2">
                      Ore calcolate: {calculatedHours.toFixed(2)}h
                    </p>
                  )}
                  
                  {formData.permissionType === 'full_day' && calculatedHours === null && formData.userId && formData.date && (
                    <p className="text-xs text-amber-400 mt-1">
                      ⚠️ Impossibile calcolare le ore. Verifica che il dipendente abbia un orario configurato per questo giorno.
                    </p>
                  )}
                </div>

                {formData.permissionType === 'late_entry' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Orario Entrata
                    </label>
                    <input
                      type="time"
                      name="entryTime"
                      value={formData.entryTime}
                      onChange={handleInputChange}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                )}

                {formData.permissionType === 'early_exit' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Orario Uscita
                    </label>
                    <input
                      type="time"
                      name="exitTime"
                      value={formData.exitTime}
                      onChange={handleInputChange}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                )}
              </>

            {/* Motivo */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Motivo
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Es. Visita medica, Motivi personali, ecc."
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
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Note opzionali (es. contattato telefonicamente, ecc.)"
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
                      La richiesta verrà <strong>auto-approvata</strong> e il dipendente riceverà una <strong>notifica</strong> e una <strong>email</strong> di conferma.
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
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creazione...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Crea Richiesta
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

export default AdminCreatePermissionModal;

