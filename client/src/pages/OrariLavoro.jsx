import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  Calendar,
  Users,
  Settings
} from 'lucide-react';

// Hook per ottenere i dati utente
const useUser = () => {
  const { user } = useAuthStore();
  return user;
};

const OrariLavoro = () => {
  const user = useUser();
  const { apiCall } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [workPatterns, setWorkPatterns] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [formData, setFormData] = useState({
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
    contract_type: 'full_time'
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      const response = await apiCall('/api/employees');

      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
        
        // Fetch work patterns for each employee
        const patterns = {};
        for (const employee of data) {
          const patternResponse = await fetch(`/api/hours/work-patterns?user_id=${employee.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (patternResponse.ok) {
            const patternData = await patternResponse.json();
            patterns[employee.id] = patternData[0] || null;
          }
        }
        setWorkPatterns(patterns);
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
      const workPatternData = {
        user_id: editingEmployee.id,
        contract_type: formData.contract_type,
        monday_hours: parseFloat(formData.monday),
        tuesday_hours: parseFloat(formData.tuesday),
        wednesday_hours: parseFloat(formData.wednesday),
        thursday_hours: parseFloat(formData.thursday),
        friday_hours: parseFloat(formData.friday),
        saturday_hours: parseFloat(formData.saturday),
        sunday_hours: parseFloat(formData.sunday),
        effective_from: new Date().toISOString().split('T')[0]
      };

      const response = await apiCall('/api/hours/work-patterns', {
        method: 'POST',
        body: JSON.stringify(workPatternData)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingEmployee(null);
        resetForm();
        fetchEmployees();
      } else {
        console.error('Errore nel salvataggio del pattern di lavoro');
      }
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    const pattern = workPatterns[employee.id];
    if (pattern) {
      setFormData({
        monday: pattern.monday_hours || 8,
        tuesday: pattern.tuesday_hours || 8,
        wednesday: pattern.wednesday_hours || 8,
        thursday: pattern.thursday_hours || 8,
        friday: pattern.friday_hours || 8,
        saturday: pattern.saturday_hours || 0,
        sunday: pattern.sunday_hours || 0,
        contract_type: pattern.contract_type || 'full_time'
      });
    }
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 8,
      saturday: 0,
      sunday: 0,
      contract_type: 'full_time'
    });
  };

  const calculateWeeklyHours = () => {
    return parseFloat(formData.monday) + parseFloat(formData.tuesday) + 
           parseFloat(formData.wednesday) + parseFloat(formData.thursday) + 
           parseFloat(formData.friday) + parseFloat(formData.saturday) + 
           parseFloat(formData.sunday);
  };

  const calculateDailyHours = () => {
    const workingDays = [formData.monday, formData.tuesday, formData.wednesday, 
                        formData.thursday, formData.friday, formData.saturday, formData.sunday]
                        .filter(hours => hours > 0).length;
    return workingDays > 0 ? calculateWeeklyHours() / workingDays : 0;
  };

  const calculateAnnualVacationHours = () => {
    const dailyHours = calculateDailyHours();
    return 26 * dailyHours; // 26 giorni ferie
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
            Gestione Orari di Lavoro
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Configura gli orari di lavoro per ogni dipendente per calcoli dinamici delle ferie
          </p>
        </div>
      </div>

      {/* Employees List */}
      <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Dipendenti e Orari</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              <span>{employees.length} dipendenti</span>
            </div>
          </div>
        </div>
        
        <div className="divide-y divide-gray-700">
          {employees.map((employee) => {
            const pattern = workPatterns[employee.id];
            const weeklyHours = pattern ? 
              (pattern.monday_hours + pattern.tuesday_hours + pattern.wednesday_hours + 
               pattern.thursday_hours + pattern.friday_hours + pattern.saturday_hours + 
               pattern.sunday_hours) : 0;
            const dailyHours = pattern ? 
              weeklyHours / [pattern.monday_hours, pattern.tuesday_hours, pattern.wednesday_hours, 
                           pattern.thursday_hours, pattern.friday_hours, pattern.saturday_hours, 
                           pattern.sunday_hours].filter(h => h > 0).length : 0;
            const annualVacationHours = dailyHours * 26;

            return (
              <div key={employee.id} className="p-6 hover:bg-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {employee.first_name?.[0]}{employee.last_name?.[0]}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">
                        {employee.first_name} {employee.last_name}
                      </h4>
                      <p className="text-gray-400">{employee.email}</p>
                      <p className="text-sm text-gray-500">{employee.department || 'Non specificato'}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {pattern ? (
                      <div className="space-y-1">
                        <p className="text-sm text-gray-400">Settimanali: <span className="font-semibold text-gray-300">{weeklyHours}h</span></p>
                        <p className="text-sm text-gray-400">Giornaliere: <span className="font-semibold text-gray-300">{dailyHours.toFixed(1)}h</span></p>
                        <p className="text-sm text-gray-400">Ferie annue: <span className="font-semibold text-green-400">{annualVacationHours.toFixed(0)}h</span></p>
                      </div>
                    ) : (
                      <p className="text-sm text-yellow-400">Orari non configurati</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {showModal && editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Configura Orari - {editingEmployee.first_name} {editingEmployee.last_name}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Lunedì
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={formData.monday}
                    onChange={(e) => setFormData({...formData, monday: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Martedì
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={formData.tuesday}
                    onChange={(e) => setFormData({...formData, tuesday: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Mercoledì
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={formData.wednesday}
                    onChange={(e) => setFormData({...formData, wednesday: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Giovedì
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={formData.thursday}
                    onChange={(e) => setFormData({...formData, thursday: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Venerdì
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={formData.friday}
                    onChange={(e) => setFormData({...formData, friday: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Sabato
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={formData.saturday}
                    onChange={(e) => setFormData({...formData, saturday: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Domenica
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="12"
                    value={formData.sunday}
                    onChange={(e) => setFormData({...formData, sunday: e.target.value})}
                    className="w-full border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="bg-blue-900 p-3 rounded-lg border border-blue-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-200">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Settimanali: <strong>{calculateWeeklyHours()}h</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Giornaliere: <strong>{calculateDailyHours().toFixed(1)}h</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span>Ferie annue: <strong>{calculateAnnualVacationHours().toFixed(0)}h</strong></span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEmployee(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-300 border border-gray-600 bg-gray-700 rounded-lg hover:bg-gray-600"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Salva Orari
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrariLavoro;
