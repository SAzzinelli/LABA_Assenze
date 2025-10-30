import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Briefcase, 
  Edit, 
  Save, 
  X, 
  Clock,
  Sun,
  Moon,
  Coffee,
  CheckSquare,
  Square,
  MapPin,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import HourPicker from '../components/HourPicker';
import MonteOreCalculator from '../components/MonteOreCalculator';

const Profile = () => {
  const { user, apiCall } = useAuthStore();
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions104, setPermissions104] = useState({
    usedThisMonth: 0,
    maxPerMonth: 3,
    remaining: 3
  });
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: user?.phone || '',
    birthDate: user?.birthDate || '',
    department: user?.department || '',
    has104: user?.has104 || false,
    position: user?.position || '',
    hireDate: user?.hireDate || '',
    officeLocation: user?.workplace || '',
    contractType: user?.contractType || ''
  });

  // Opzioni sedi di lavoro
  const officeLocations = [
    { value: 'badia', label: 'Piazza di Badia a Ripoli 1/A' },
    { value: 'vecchietti', label: 'Via de\' Vecchietti 6' }
  ];

  // Carica l'orario salvato dal localStorage o usa quello di default
  const defaultWorkSchedule = {
    monday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
    tuesday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
    wednesday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
    thursday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
    friday: { active: true, morning: '09:00-13:00', afternoon: '14:00-18:00', lunchBreak: '13:00-14:00', workType: 'full' },
    saturday: { active: false, morning: '', afternoon: '', lunchBreak: '', workType: 'none' },
    sunday: { active: false, morning: '', afternoon: '', lunchBreak: '', workType: 'none' }
  };

  const [workSchedule, setWorkSchedule] = useState(defaultWorkSchedule);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);

  const [selectedDay, setSelectedDay] = useState('monday');

  // Helper functions for time conversion
  const parseTimeRange = (timeRange) => {
    if (!timeRange || !timeRange.includes('-')) return { start: '', end: '' };
    const [start, end] = timeRange.split('-');
    // Rimuovi i secondi se presenti (09:00:00 -> 09:00)
    const cleanStart = start.trim().substring(0, 5);
    const cleanEnd = end.trim().substring(0, 5);
    return { start: cleanStart, end: cleanEnd };
  };

  const formatTimeRange = (start, end) => {
    if (!start || !end) return '';
    return `${start}-${end}`;
  };

  // Carica dati utente dal database
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        const response = await apiCall('/api/user');
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
          
          // Carica dati dal database, con fallback a localStorage
          const savedData = JSON.parse(localStorage.getItem('userProfile') || '{}');
          
          setFormData({
            firstName: data.first_name || savedData.firstName || '',
            lastName: data.last_name || savedData.lastName || '',
            email: data.email || savedData.email || '',
            phone: data.phone || savedData.phone || '',
            birthDate: data.birth_date || savedData.birthDate || '',
            department: data.department || savedData.department || '',
            has104: data.has_104 !== undefined ? data.has_104 : (savedData.has104 || false),
            position: data.position || savedData.position || '',
            hireDate: data.hire_date || savedData.hireDate || '',
            officeLocation: data.workplace || savedData.officeLocation || '',
            contractType: data.contract_type || savedData.contractType || ''
          });
          
          // Salva i dati caricati in localStorage per il fallback
          const profileData = {
            firstName: data.first_name || savedData.firstName || '',
            lastName: data.last_name || savedData.lastName || '',
            email: data.email || savedData.email || '',
            phone: data.phone || savedData.phone || '',
            birthDate: data.birth_date || savedData.birthDate || '',
            department: data.department || savedData.department || '',
            has104: data.has_104 !== undefined ? data.has_104 : (savedData.has104 || false),
            position: data.position || savedData.position || '',
            hireDate: data.hire_date || savedData.hireDate || '',
            officeLocation: data.workplace || savedData.officeLocation || '',
            contractType: data.contract_type || savedData.contractType || ''
          };
          localStorage.setItem('userProfile', JSON.stringify(profileData));
          
        } else {
          // Se l'API fallisce, carica da localStorage
          const savedData = JSON.parse(localStorage.getItem('userProfile') || '{}');
          setFormData({
            firstName: savedData.firstName || user?.firstName || '',
            lastName: savedData.lastName || user?.lastName || '',
            email: savedData.email || user?.email || '',
            phone: savedData.phone || '',
            birthDate: savedData.birthDate || '',
            department: savedData.department || '',
            has104: savedData.has104 || false,
            position: savedData.position || '',
            hireDate: savedData.hireDate || '',
            officeLocation: savedData.officeLocation || '',
            contractType: savedData.contractType || ''
          });
        }
      } catch (error) {
        console.error('Errore nel caricamento dati utente:', error);
        // Fallback a localStorage
        const savedData = JSON.parse(localStorage.getItem('userProfile') || '{}');
        setFormData({
          firstName: savedData.firstName || user?.firstName || '',
          lastName: savedData.lastName || user?.lastName || '',
          email: savedData.email || user?.email || '',
          phone: savedData.phone || '',
          birthDate: savedData.birthDate || '',
          department: savedData.department || '',
          has104: savedData.has104 || false,
          position: savedData.position || '',
          hireDate: savedData.hireDate || '',
          officeLocation: savedData.officeLocation || '',
          contractType: savedData.contractType || ''
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadUserData();
    }
  }, [user, apiCall]);

  // Carica permessi 104 se l'utente li ha
  const fetchPermissions104 = async () => {
    try {
      const response = await apiCall('/api/104-permissions/count');
      if (response.ok) {
        const data = await response.json();
        setPermissions104(data);
      }
    } catch (error) {
      console.error('Error fetching 104 permissions:', error);
    }
  };

  // Carica permessi 104 quando l'utente ha 104
  useEffect(() => {
    if (user?.has104) {
      fetchPermissions104();
    }
  }, [user?.has104]);

  // Load work schedule from API
  React.useEffect(() => {
    const loadWorkSchedule = async () => {
      try {
        const response = await apiCall('/api/work-schedules');
        
        if (response.ok || Array.isArray(response)) {
          const schedules = Array.isArray(response) ? response : await response.json();
          // Convert API data to frontend format
          const formattedSchedule = { ...defaultWorkSchedule };
          
          schedules.forEach(schedule => {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = dayNames[schedule.day_of_week];
            
            if (dayName && formattedSchedule[dayName]) {
              formattedSchedule[dayName] = {
                active: schedule.is_working_day,
                morning: schedule.work_type === 'morning' ? `${schedule.start_time}-${schedule.end_time}` : 
                         schedule.work_type === 'full_day' ? `${schedule.start_time}-${schedule.end_time}` : '',
                afternoon: schedule.work_type === 'afternoon' ? `${schedule.start_time}-${schedule.end_time}` : 
                          schedule.work_type === 'full_day' ? `${schedule.start_time}-${schedule.end_time}` : '',
                lunchBreak: schedule.work_type === 'full_day' ? '13:00-14:00' : '',
                workType: schedule.work_type === 'full_day' ? 'full' : schedule.work_type
              };
            }
          });
          
          setWorkSchedule(formattedSchedule);
        } else {
          // Fallback to localStorage
          const saved = localStorage.getItem('workSchedule');
          if (saved) {
            setWorkSchedule(JSON.parse(saved));
          }
        }
      } catch (error) {
        console.error('Error loading work schedule:', error);
        // Fallback to localStorage
        const saved = localStorage.getItem('workSchedule');
        if (saved) {
          setWorkSchedule(JSON.parse(saved));
        }
      } finally {
        setIsLoadingSchedule(false);
      }
    };
    
    loadWorkSchedule();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };


  const toggleWorkDay = (day) => {
    setWorkSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        active: !prev[day].active,
        morning: !prev[day].active ? '09:00-13:00' : '',
        afternoon: !prev[day].active ? '14:00-18:00' : '',
        lunchBreak: !prev[day].active ? '13:00-14:00' : '',
        workType: !prev[day].active ? 'full' : 'none'
      }
    }));
  };

  const handleWorkTypeChange = (workType) => {
    setWorkSchedule(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        workType: workType,
        morning: workType === 'morning' ? '09:00-13:00' : workType === 'full' ? '09:00-13:00' : '',
        afternoon: workType === 'afternoon' ? '14:00-18:00' : workType === 'full' ? '14:00-18:00' : '',
        lunchBreak: workType === 'full' ? '13:00-14:00' : ''
      }
    }));
  };

  const handleWorkScheduleChange = (field, value) => {
    setWorkSchedule(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      console.log('Saving profile:', formData);
      
      // Salva in localStorage
      localStorage.setItem('userProfile', JSON.stringify(formData));
      
      // Prova a salvare nel database (quando i campi saranno disponibili)
      try {
        const response = await apiCall('/api/user', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: formData.phone,
            position: formData.position,
            department: formData.department,
            hire_date: formData.hireDate,
            workplace: formData.officeLocation,
            contract_type: formData.contractType,
            birth_date: formData.birthDate,
            has_104: formData.has104
          })
        });
        
        if (response.ok) {
          console.log('✅ Profilo salvato nel database');
        } else {
          console.log('⚠️ Salvataggio database fallito, salvato solo in localStorage');
        }
      } catch (dbError) {
        console.log('⚠️ Errore salvataggio database:', dbError.message);
        console.log('✅ Salvato in localStorage come fallback');
      }
      
      setIsEditing(false);
      alert('Profilo salvato con successo!');
      
    } catch (error) {
      console.error('Errore nel salvataggio profilo:', error);
      alert('Errore nel salvataggio del profilo');
    }
  };

  const handleSaveSchedule = async () => {
    try {
      // Convert frontend format to API format
      const schedules = [];
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      dayNames.forEach((dayName, index) => {
        const daySchedule = workSchedule[dayName];
        if (daySchedule) {
          schedules.push({
            day_of_week: index,
            is_working_day: daySchedule.active,
            work_type: daySchedule.workType === 'full' ? 'full_day' : 
                      daySchedule.workType === 'morning' ? 'morning' : 
                      daySchedule.workType === 'afternoon' ? 'afternoon' : 'none',
            start_time: daySchedule.morning.split('-')[0] || daySchedule.afternoon.split('-')[0] || null,
            end_time: daySchedule.morning.split('-')[1] || daySchedule.afternoon.split('-')[1] || null,
            break_duration: 60
          });
        }
      });

      // Usa apiCall invece di fetch diretto
      const response = await apiCall('/api/work-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ schedules })
      });

      if (response.ok || response.success) {
        // Salva anche nel localStorage come backup
        localStorage.setItem('workSchedule', JSON.stringify(workSchedule));
        alert('Orario di lavoro salvato con successo!');
        console.log('Work schedule saved to API:', schedules);
      } else {
        throw new Error('Errore nel salvare l\'orario di lavoro');
      }
    } catch (error) {
      console.error('Error saving work schedule:', error);
      // Fallback to localStorage
      localStorage.setItem('workSchedule', JSON.stringify(workSchedule));
      alert('Orario salvato localmente (errore API)');
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      birthDate: user?.birthDate || '',
      department: user?.department || '',
      has104: user?.has104 || false,
      position: user?.position || '',
      hireDate: user?.hireDate || '',
      officeLocation: user?.workplace || '',
      contractType: user?.contractType || ''
    });
    setIsEditing(false);
  };

  const tabs = [
    { id: 'personal', name: 'Informazioni Personali', icon: User },
    { id: 'schedule', name: 'Orario di Lavoro', icon: Clock },
    { id: 'balance', name: 'Banca Ore', icon: Clock }
  ];

  const dayNames = {
    monday: 'Lunedì',
    tuesday: 'Martedì',
    wednesday: 'Mercoledì',
    thursday: 'Giovedì',
    friday: 'Venerdì',
    saturday: 'Sabato',
    sunday: 'Domenica'
  };

  const renderPersonalTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Informazioni Personali</h3>
        {user?.role !== 'admin' && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
              isEditing 
                ? 'bg-slate-600 hover:bg-slate-500 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isEditing ? <X className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
            {isEditing ? 'Annulla' : 'Modifica'}
          </button>
        )}
      </div>

      {user?.role === 'admin' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <User className="h-5 w-5 text-amber-400 mr-3" />
            <div>
              <h4 className="text-amber-300 font-semibold">Account Amministratore</h4>
              <p className="text-amber-200 text-sm">
                I dati amministrativi sono gestiti dal sistema e non possono essere modificati.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Nome</label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            disabled={!isEditing || user?.role === 'admin'}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Cognome</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Telefono</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Data di Nascita</label>
          <input
            type="date"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:text-slate-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Dipartimento</label>
          <select
            name="department"
            value={formData.department}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">Seleziona dipartimento</option>
            <option value="Amministrazione">Amministrazione</option>
            <option value="Segreteria">Segreteria</option>
            <option value="Orientamento">Orientamento</option>
            <option value="Reparto IT">Reparto IT</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="has104"
              checked={formData.has104}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className="ml-2 text-slate-300">Legge 104 (Permessi speciali)</span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
            <Briefcase className="h-4 w-4 mr-2 text-indigo-400" />
            Posizione
          </label>
          <input
            type="text"
            name="position"
            value={formData.position}
            onChange={handleInputChange}
            disabled={!isEditing}
            placeholder="Es. Manager, Sviluppatore, Segretaria..."
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-indigo-400" />
            Data Assunzione
          </label>
          <input
            type="date"
            name="hireDate"
            value={formData.hireDate}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:text-slate-300"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
            <MapPin className="h-4 w-4 mr-2 text-indigo-400" />
            Sede di Lavoro
          </label>
          <select
            name="officeLocation"
            value={formData.officeLocation}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:text-slate-300"
          >
            <option value="">Seleziona sede...</option>
            {officeLocations.map((location) => (
              <option key={location.value} value={location.value}>
                {location.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
            <FileText className="h-4 w-4 mr-2 text-indigo-400" />
            Tipo di Contratto
          </label>
          <select
            name="contractType"
            value={formData.contractType}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">Seleziona tipo contratto</option>
            <option value="Full Time - Indeterminato">Full Time - Indeterminato</option>
            <option value="Part Time - Indeterminato">Part Time - Indeterminato</option>
            <option value="Full Time - Determinato">Full Time - Determinato</option>
            <option value="Part Time - Determinato">Part Time - Determinato</option>
            <option value="P.IVA">P.IVA</option>
            <option value="Co.Co.Co.">Co.Co.Co.</option>
            <option value="Apprendistato">Apprendistato</option>
          </select>
        </div>
      </div>

      {isEditing && (
        <div className="flex justify-end space-x-4">
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
          >
            <X className="h-4 w-4 mr-2 inline" />
            Annulla
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Save className="h-4 w-4 mr-2 inline" />
            Salva Modifiche
          </button>
        </div>
      )}

      {/* Sezione Permessi 104 - Solo per chi ha 104 */}
      {formData.has104 && (
        <div className="bg-slate-700 rounded-lg p-6 mt-6">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            <CheckSquare className="h-5 w-5 mr-2 text-amber-400" />
            Permessi Legge 104
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Usati questo mese</div>
              <div className="text-2xl font-bold text-white">
                {permissions104.usedThisMonth}
              </div>
              <div className="text-slate-400 text-xs">di {permissions104.maxPerMonth} disponibili</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Rimanenti</div>
              <div className={`text-2xl font-bold ${
                permissions104.remaining > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {permissions104.remaining}
              </div>
              <div className="text-slate-400 text-xs">permessi disponibili</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Limite mensile</div>
              <div className="text-2xl font-bold text-amber-400">
                {permissions104.maxPerMonth}
              </div>
              <div className="text-slate-400 text-xs">massimo al mese</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-amber-200 text-sm">
              <strong>Nota:</strong> I permessi Legge 104 sono limitati a 3 al mese per assistenza familiare con handicap grave.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderScheduleTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Orario di Lavoro Settimanale</h3>
        <button
          onClick={handleSaveSchedule}
          disabled={isLoadingSchedule}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors flex items-center"
        >
          <Save className="h-4 w-4 mr-2" />
          {isLoadingSchedule ? 'Caricamento...' : 'Salva Orario'}
        </button>
      </div>
      
      {isLoadingSchedule && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-blue-300 text-sm">Caricamento orario di lavoro dal database...</p>
        </div>
      )}

      {/* Tab dei giorni */}
      <div className="flex space-x-3 bg-slate-800 p-2 rounded-xl">
        {Object.entries(dayNames).map(([dayKey, dayName]) => (
          <button
            key={dayKey}
            onClick={() => setSelectedDay(dayKey)}
            className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
              selectedDay === dayKey
                ? 'bg-indigo-600 text-white shadow-lg transform scale-105'
                : 'text-slate-400 hover:text-white border-2 border-slate-600 hover:border-slate-500'
            }`}
          >
            {dayName.slice(0, 3).toUpperCase()}
          </button>
        ))}
      </div>


      {/* Contenuto del giorno selezionato */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-white">{dayNames[selectedDay]}</h4>
          <button
            onClick={() => toggleWorkDay(selectedDay)}
            className="flex items-center space-x-3 transition-all duration-200 hover:scale-105"
          >
            <div className={`w-6 h-6 rounded border-2 transition-all duration-200 flex items-center justify-center ${
              workSchedule[selectedDay].active 
                ? 'bg-green-500 border-green-500' 
                : 'bg-transparent border-slate-500'
            }`}>
              {workSchedule[selectedDay].active && (
                <CheckSquare className="h-4 w-4 text-white" />
              )}
            </div>
            <span className="text-sm font-medium text-slate-300">
              {workSchedule[selectedDay].active ? 'Giorno Lavorativo' : 'Non Lavorativo'}
            </span>
          </button>
        </div>

        {workSchedule[selectedDay].active && (
          <div className="space-y-6">
            {/* Tipo di Lavoro - Pulsanti a Pill */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-4">
                Tipo di Orario
              </label>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleWorkTypeChange('morning')}
                  className={`px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                    workSchedule[selectedDay].workType === 'morning'
                      ? 'bg-yellow-500/20 border-2 border-yellow-400/50 text-yellow-300'
                      : 'bg-slate-600/20 border-2 border-slate-600/50 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Sun className="h-4 w-4 mr-2 inline" />
                  Solo Mattina
                </button>
                <button
                  onClick={() => handleWorkTypeChange('afternoon')}
                  className={`px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                    workSchedule[selectedDay].workType === 'afternoon'
                      ? 'bg-blue-500/20 border-2 border-blue-400/50 text-blue-300'
                      : 'bg-slate-600/20 border-2 border-slate-600/50 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Moon className="h-4 w-4 mr-2 inline" />
                  Solo Pomeriggio
                </button>
                <button
                  onClick={() => handleWorkTypeChange('full')}
                  className={`px-6 py-3 rounded-full font-medium transition-all duration-200 ${
                    workSchedule[selectedDay].workType === 'full'
                      ? 'bg-purple-500/20 border-2 border-purple-400/50 text-purple-300'
                      : 'bg-slate-600/20 border-2 border-slate-600/50 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Clock className="h-4 w-4 mr-2 inline" />
                  Giornata Completa
                </button>
              </div>
            </div>

            {/* Orari */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(workSchedule[selectedDay].workType === 'morning' || workSchedule[selectedDay].workType === 'full') && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                    <Sun className="h-4 w-4 mr-2 text-yellow-400" />
                    Orario Mattina
                  </label>
                <div className="grid grid-cols-2 gap-4">
                  <HourPicker
                    label="Inizio"
                    value={parseTimeRange(workSchedule[selectedDay].morning).start}
                    onChange={(time) => {
                      const { end } = parseTimeRange(workSchedule[selectedDay].morning);
                      handleWorkScheduleChange('morning', formatTimeRange(time, end));
                    }}
                    placeholder="09:00"
                  />
                  <HourPicker
                    label="Fine"
                    value={parseTimeRange(workSchedule[selectedDay].morning).end}
                    onChange={(time) => {
                      const { start } = parseTimeRange(workSchedule[selectedDay].morning);
                      handleWorkScheduleChange('morning', formatTimeRange(start, time));
                    }}
                    placeholder="13:00"
                  />
                </div>
                </div>
              )}
              
              {workSchedule[selectedDay].workType === 'full' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                    <Coffee className="h-4 w-4 mr-2 text-amber-400" />
                    Pausa Pranzo
                  </label>
                <div className="grid grid-cols-2 gap-4">
                  <HourPicker
                    label="Inizio"
                    value={parseTimeRange(workSchedule[selectedDay].lunchBreak).start}
                    onChange={(time) => {
                      const { end } = parseTimeRange(workSchedule[selectedDay].lunchBreak);
                      handleWorkScheduleChange('lunchBreak', formatTimeRange(time, end));
                    }}
                    placeholder="13:00"
                  />
                  <HourPicker
                    label="Fine"
                    value={parseTimeRange(workSchedule[selectedDay].lunchBreak).end}
                    onChange={(time) => {
                      const { start } = parseTimeRange(workSchedule[selectedDay].lunchBreak);
                      handleWorkScheduleChange('lunchBreak', formatTimeRange(start, time));
                    }}
                    placeholder="14:00"
                  />
                </div>
                </div>
              )}
              
              {(workSchedule[selectedDay].workType === 'afternoon' || workSchedule[selectedDay].workType === 'full') && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                    <Moon className="h-4 w-4 mr-2 text-blue-400" />
                    Orario Pomeriggio
                  </label>
                <div className="grid grid-cols-2 gap-4">
                  <HourPicker
                    label="Inizio"
                    value={parseTimeRange(workSchedule[selectedDay].afternoon).start}
                    onChange={(time) => {
                      const { end } = parseTimeRange(workSchedule[selectedDay].afternoon);
                      handleWorkScheduleChange('afternoon', formatTimeRange(time, end));
                    }}
                    placeholder="14:00"
                  />
                  <HourPicker
                    label="Fine"
                    value={parseTimeRange(workSchedule[selectedDay].afternoon).end}
                    onChange={(time) => {
                      const { start } = parseTimeRange(workSchedule[selectedDay].afternoon);
                      handleWorkScheduleChange('afternoon', formatTimeRange(start, time));
                    }}
                    placeholder="18:00"
                  />
                </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>


      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-blue-300 text-sm">
          <strong>Nota:</strong> L'orario di lavoro impostato sarà visibile all'amministratore nella sezione dipendenti e verrà utilizzato per calcolare le ore di presenza e assenze.
        </p>
      </div>
    </div>
  );

  const renderBalanceTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Banca Ore</h3>
      </div>
      <MonteOreCalculator user={user} workSchedule={workSchedule} />
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal': return renderPersonalTab();
      case 'schedule': return renderScheduleTab();
      case 'balance': return renderBalanceTab();
      default: return renderPersonalTab();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <User className="h-8 w-8 mr-3 text-indigo-400" />
              Profilo Personale
            </h1>
            <p className="text-slate-400 mt-2">
              Gestisci le tue informazioni personali e l'orario di lavoro
            </p>
          </div>
        </div>
      </div>

      {/* Tab orizzontali */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <nav className="flex border-b border-slate-700">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 text-left transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-400'
                    : 'text-slate-300 hover:bg-slate-700/50 border-transparent'
                }`}
              >
                <IconComponent className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
        
        {/* Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Profile;