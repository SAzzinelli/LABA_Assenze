import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Save } from 'lucide-react';

const Edit104PermissionModal = ({ isOpen, onClose, request, onSubmit }) => {
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    notes: '',
    daysRequested: 1
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (request && isOpen) {
      setFormData({
        startDate: request.start_date || request.startDate || '',
        endDate: request.end_date || request.endDate || '',
        notes: request.notes || '',
        daysRequested: request.days_requested || 1
      });
      setErrors({});
    }
  }, [request, isOpen]);

  if (!isOpen || !request) return null;

  const calculateDays = (start, end) => {
    if (!start || !end) return 1;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Calcola automaticamente i giorni quando cambiano le date
      if (name === 'startDate' || name === 'endDate') {
        const start = name === 'startDate' ? value : newData.startDate;
        const end = name === 'endDate' ? value : newData.endDate;
        if (start && end) {
          newData.daysRequested = calculateDays(start, end);
        }
      }
      
      return newData;
    });
    
    // Rimuovi errori quando l'utente inizia a digitare
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.startDate) {
      newErrors.startDate = 'Data di inizio richiesta';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'Data di fine richiesta';
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      if (end < start) {
        newErrors.endDate = 'La data di fine deve essere successiva alla data di inizio';
      }

      // Calcola giorni effettivi
      const calculatedDays = calculateDays(formData.startDate, formData.endDate);
      if (calculatedDays > 3) {
        newErrors.endDate = 'Il permesso 104 non può superare 3 giorni consecutivi';
      }
    }

    if (!formData.daysRequested || formData.daysRequested < 1) {
      newErrors.daysRequested = 'I giorni devono essere almeno 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 max-w-2xl w-full mx-4 border-2 border-zinc-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 text-slate-400 mr-2" />
            <h2 className="text-2xl font-bold text-white">Modifica Permesso 104</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Info Dipendente */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-slate-300 mb-1">Dipendente:</p>
          <p className="text-white font-semibold">
            {request.users?.first_name && request.users?.last_name
              ? `${request.users.first_name} ${request.users.last_name}`
              : 'Dipendente'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Data Inizio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Data di Inizio *
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 bg-zinc-800 border ${
                errors.startDate ? 'border-red-500' : 'border-zinc-700'
              } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600`}
              required
            />
            {errors.startDate && (
              <p className="text-red-400 text-xs mt-1 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {errors.startDate}
              </p>
            )}
          </div>

          {/* Data Fine */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Data di Fine *
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 bg-zinc-800 border ${
                errors.endDate ? 'border-red-500' : 'border-zinc-700'
              } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600`}
              required
            />
            {errors.endDate && (
              <p className="text-red-400 text-xs mt-1 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {errors.endDate}
              </p>
            )}
          </div>

          {/* Giorni Richiesti */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Giorni Richiesti *
            </label>
            <input
              type="number"
              name="daysRequested"
              value={formData.daysRequested}
              onChange={handleInputChange}
              min="1"
              max="3"
              className={`w-full px-3 py-2 bg-zinc-800 border ${
                errors.daysRequested ? 'border-red-500' : 'border-zinc-700'
              } rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600`}
              required
            />
            {errors.daysRequested && (
              <p className="text-red-400 text-xs mt-1 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {errors.daysRequested}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              I giorni vengono calcolati automaticamente in base alle date selezionate
            </p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Note (opzionale)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="3"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
              placeholder="Aggiungi note o motivazioni..."
            />
          </div>

          {/* Avviso */}
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-sm text-yellow-300 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              La modifica aggiornerà automaticamente il bilancio 104 del dipendente.
            </p>
          </div>

          {/* Pulsanti */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Edit104PermissionModal;

