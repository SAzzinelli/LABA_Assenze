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
  Activity,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';

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
            
            if (dayName && formattedSchedule[dayName] && schedule.is_working_day) {
              let morning = '';
              let afternoon = '';
              let lunchBreak = '';
              let workType = 'none';
              
              if (schedule.work_type === 'morning') {
                // Solo mattina
                morning = schedule.start_time && schedule.end_time ? `${schedule.start_time}-${schedule.end_time}` : '';
                workType = 'morning';
              } else if (schedule.work_type === 'afternoon') {
                // Solo pomeriggio
                afternoon = schedule.start_time && schedule.end_time ? `${schedule.start_time}-${schedule.end_time}` : '';
                workType = 'afternoon';
              } else if (schedule.work_type === 'full_day') {
                // Giornata completa: usa break_start_time per separare mattina e pomeriggio
                if (schedule.break_start_time && schedule.break_duration) {
                  // Calcola orario pomeriggio: inizio pausa + durata pausa
                  const [breakHour, breakMin] = schedule.break_start_time.split(':').map(Number);
                  const breakDurationMinutes = schedule.break_duration;
                  const afternoonStartMinutes = breakHour * 60 + breakMin + breakDurationMinutes;
                  const afternoonStartHour = Math.floor(afternoonStartMinutes / 60);
                  const afternoonStartMin = afternoonStartMinutes % 60;
                  const afternoonStart = `${afternoonStartHour.toString().padStart(2, '0')}:${afternoonStartMin.toString().padStart(2, '0')}`;
                  
                  morning = schedule.start_time && schedule.break_start_time ? `${schedule.start_time}-${schedule.break_start_time}` : '';
                  afternoon = schedule.end_time && afternoonStart ? `${afternoonStart}-${schedule.end_time}` : '';
                  lunchBreak = schedule.break_start_time && afternoonStart ? `${schedule.break_start_time}-${afternoonStart}` : '';
                } else {
                  // Se non c'è break_start_time, usa valori di default o calcola da start/end
                  if (schedule.start_time && schedule.end_time) {
                    // Stima: se orario è 9-18, assume mattina 9-13, pausa 13-14, pomeriggio 14-18
                    const [startHour] = schedule.start_time.split(':').map(Number);
                    const [endHour] = schedule.end_time.split(':').map(Number);
                    
                    if (endHour > 14) {
                      // Probabilmente giornata completa
                      morning = `${schedule.start_time}-13:00`;
                      afternoon = `14:00-${schedule.end_time}`;
                      lunchBreak = '13:00-14:00';
                    } else {
                      // Probabilmente solo mattina (es. 9-13)
                      morning = `${schedule.start_time}-${schedule.end_time}`;
                    }
                  }
                }
                workType = 'full';
              }
              
              formattedSchedule[dayName] = {
                active: schedule.is_working_day,
                morning,
                afternoon,
                lunchBreak,
                workType
              };
            } else if (dayName && formattedSchedule[dayName]) {
              // Giorno non lavorativo
              formattedSchedule[dayName] = {
                active: false,
                morning: '',
                afternoon: '',
                lunchBreak: '',
                workType: 'none'
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
      
      // Helper per calcolare minuti tra due orari
      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      dayNames.forEach((dayName, index) => {
        const daySchedule = workSchedule[dayName];
        if (daySchedule && daySchedule.active) {
          let startTime = null;
          let endTime = null;
          let breakDuration = 0;
          let breakStartTime = null;
          const workType = daySchedule.workType === 'full' ? 'full_day' : 
                          daySchedule.workType === 'morning' ? 'morning' : 
                          daySchedule.workType === 'afternoon' ? 'afternoon' : 'none';
          
          if (workType === 'full_day') {
            // Giornata completa: start_time = inizio mattina, end_time = fine pomeriggio
            const morningRange = parseTimeRange(daySchedule.morning);
            const afternoonRange = parseTimeRange(daySchedule.afternoon);
            const lunchBreakRange = parseTimeRange(daySchedule.lunchBreak);
            
            startTime = morningRange.start || null;
            endTime = afternoonRange.end || null;
            
            // Calcola break_duration dalla pausa pranzo (in minuti)
            if (lunchBreakRange.start && lunchBreakRange.end) {
              breakStartTime = lunchBreakRange.start;
              const breakStart = timeToMinutes(lunchBreakRange.start);
              const breakEnd = timeToMinutes(lunchBreakRange.end);
              breakDuration = Math.max(0, breakEnd - breakStart);
            } else {
              breakDuration = 60; // Default 1 ora
            }
          } else if (workType === 'morning') {
            // Solo mattina
            const morningRange = parseTimeRange(daySchedule.morning);
            startTime = morningRange.start || null;
            endTime = morningRange.end || null;
            breakDuration = 0;
          } else if (workType === 'afternoon') {
            // Solo pomeriggio
            const afternoonRange = parseTimeRange(daySchedule.afternoon);
            startTime = afternoonRange.start || null;
            endTime = afternoonRange.end || null;
            breakDuration = 0;
          }
          
          schedules.push({
            day_of_week: index,
            is_working_day: daySchedule.active,
            work_type: workType,
            start_time: startTime,
            end_time: endTime,
            break_duration: breakDuration,
            break_start_time: breakStartTime
          });
        } else {
          // Giorno non lavorativo
          schedules.push({
            day_of_week: index,
            is_working_day: false,
            work_type: 'none',
            start_time: null,
            end_time: null,
            break_duration: 0,
            break_start_time: null
          });
        }
      });

      console.log('Saving schedules:', schedules);

      // Usa apiCall invece di fetch diretto
      const response = await apiCall('/api/work-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ schedules })
      });

      if (response.ok) {
        const result = await response.json();
        // Salva anche nel localStorage come backup
        localStorage.setItem('workSchedule', JSON.stringify(workSchedule));
        alert('Orario di lavoro salvato con successo!');
        console.log('Work schedule saved to API:', result);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Errore nel salvare l\'orario di lavoro');
      }
    } catch (error) {
      console.error('Error saving work schedule:', error);
      // Fallback to localStorage
      localStorage.setItem('workSchedule', JSON.stringify(workSchedule));
      alert(`Errore: ${error.message || 'Errore nel salvare l\'orario di lavoro'}. I dati sono stati salvati localmente.`);
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
      hireDate: user?.hireDate || '',
      officeLocation: user?.workplace || '',
      contractType: user?.contractType || ''
    });
    setIsEditing(false);
  };

  const tabs = [
    { id: 'personal', name: 'Informazioni Personali', icon: User },
    { id: 'schedule', name: 'Orario di Lavoro', icon: Clock },
    { id: 'password', name: 'Cambio Password', icon: Key }
  ];

  // Stato per cambio password
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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
                : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white'
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
              className="h-4 w-4 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-500 disabled:opacity-50"
            />
            <span className="ml-2 text-slate-300">Legge 104 (Permessi speciali)</span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-slate-400" />
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
            <MapPin className="h-4 w-4 mr-2 text-slate-400" />
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
            <FileText className="h-4 w-4 mr-2 text-slate-400" />
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
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Usati questo mese</div>
              <div className="text-2xl font-bold text-white">
                {permissions104.usedThisMonth}
              </div>
              <div className="text-slate-400 text-xs">di {permissions104.maxPerMonth} disponibili</div>
            </div>
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Rimanenti</div>
              <div className={`text-2xl font-bold ${
                permissions104.remaining > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {permissions104.remaining}
              </div>
              <div className="text-slate-400 text-xs">permessi disponibili</div>
            </div>
            <div className="bg-zinc-900 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Limite mensile</div>
              <div className="text-2xl font-bold text-amber-400">
                {permissions104.maxPerMonth}
              </div>
              <div className="text-slate-400 text-xs">massimo al mese</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-amber-200 text-sm">
              <strong>Nota:</strong> I permessi Legge 104 sono limitati a 3 al mese per assistenza familiare.
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
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center"
        >
          <Save className="h-4 w-4 mr-2" />
          {isLoadingSchedule ? 'Caricamento...' : 'Salva Orario'}
        </button>
      </div>
      
      {isLoadingSchedule && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <p className="text-slate-300 text-sm">Caricamento orario di lavoro dal database...</p>
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
                ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg transform scale-105'
                : 'text-slate-400 hover:text-white border-2 border-zinc-700 hover:border-zinc-600'
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
                      ? 'bg-zinc-800/50 border-2 border-zinc-700 text-slate-300'
                      : 'bg-zinc-900/30 border-2 border-zinc-800 text-slate-400 hover:border-zinc-700 hover:text-slate-300'
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
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Inizio</label>
                    <input
                      type="time"
                      value={parseTimeRange(workSchedule[selectedDay].morning).start || '09:00'}
                      onChange={(e) => {
                      const { end } = parseTimeRange(workSchedule[selectedDay].morning);
                        handleWorkScheduleChange('morning', formatTimeRange(e.target.value, end));
                    }}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fine</label>
                    <input
                      type="time"
                      value={parseTimeRange(workSchedule[selectedDay].morning).end || '13:00'}
                      onChange={(e) => {
                      const { start } = parseTimeRange(workSchedule[selectedDay].morning);
                        handleWorkScheduleChange('morning', formatTimeRange(start, e.target.value));
                    }}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  </div>
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
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Inizio</label>
                    <input
                      type="time"
                      value={parseTimeRange(workSchedule[selectedDay].lunchBreak).start || '13:00'}
                      onChange={(e) => {
                      const { end } = parseTimeRange(workSchedule[selectedDay].lunchBreak);
                        handleWorkScheduleChange('lunchBreak', formatTimeRange(e.target.value, end));
                    }}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fine</label>
                    <input
                      type="time"
                      value={parseTimeRange(workSchedule[selectedDay].lunchBreak).end || '14:00'}
                      onChange={(e) => {
                      const { start } = parseTimeRange(workSchedule[selectedDay].lunchBreak);
                        handleWorkScheduleChange('lunchBreak', formatTimeRange(start, e.target.value));
                    }}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  </div>
                </div>
                </div>
              )}
              
              {(workSchedule[selectedDay].workType === 'afternoon' || workSchedule[selectedDay].workType === 'full') && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                    <Moon className="h-4 w-4 mr-2 text-slate-400" />
                    Orario Pomeriggio
                  </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Inizio</label>
                    <input
                      type="time"
                      value={parseTimeRange(workSchedule[selectedDay].afternoon).start || '14:00'}
                      onChange={(e) => {
                      const { end } = parseTimeRange(workSchedule[selectedDay].afternoon);
                        handleWorkScheduleChange('afternoon', formatTimeRange(e.target.value, end));
                    }}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fine</label>
                    <input
                      type="time"
                      value={parseTimeRange(workSchedule[selectedDay].afternoon).end || '18:00'}
                      onChange={(e) => {
                      const { start } = parseTimeRange(workSchedule[selectedDay].afternoon);
                        handleWorkScheduleChange('afternoon', formatTimeRange(start, e.target.value));
                    }}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  </div>
                </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>


      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <p className="text-slate-300 text-sm">
          <strong>Nota:</strong> L'orario di lavoro impostato sarà visibile all'amministratore nella sezione dipendenti e verrà utilizzato per calcolare le ore di presenza e assenze.
        </p>
      </div>
    </div>
  );

  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    setPasswordError('');
    setPasswordSuccess(false);
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    // Validazioni
    if (!passwordData.currentPassword) {
      setPasswordError('Inserisci la password attuale');
      return;
    }

    if (!passwordData.newPassword) {
      setPasswordError('Inserisci la nuova password');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('La nuova password deve essere di almeno 6 caratteri');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Le password non corrispondono');
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError('La nuova password deve essere diversa da quella attuale');
      return;
    }

    try {
      setChangingPassword(true);
      const response = await apiCall('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        setPasswordSuccess(true);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setTimeout(() => {
          setPasswordSuccess(false);
        }, 5000);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
        setPasswordError(errorData.error || 'Errore nel cambio password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('Errore di connessione. Riprova più tardi.');
    } finally {
      setChangingPassword(false);
    }
  };

  const renderPasswordTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center">
            <Key className="h-6 w-6 mr-3 text-slate-400" />
            Cambio Password
          </h3>
          <p className="text-slate-400 mt-2 text-sm">
            Cambia la tua password per mantenere il tuo account sicuro
          </p>
      </div>
      </div>

      {/* Messaggio di successo */}
      {passwordSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-300">
                Password cambiata con successo!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messaggio di errore */}
      {passwordError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-300">
                {passwordError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form cambio password */}
      <form onSubmit={handleChangePassword} className="space-y-6">
        <div className="bg-slate-700/50 rounded-lg p-6 space-y-6">
          {/* Password attuale */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password Attuale
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Inserisci la password attuale"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPasswords.current ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Nuova password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nuova Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Inserisci la nuova password (min. 6 caratteri)"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPasswords.new ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              La password deve contenere almeno 6 caratteri
            </p>
          </div>

          {/* Conferma nuova password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Conferma Nuova Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ripeti la nuova password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {passwordData.newPassword && passwordData.confirmPassword && (
              <p className={`mt-1 text-xs ${
                passwordData.newPassword === passwordData.confirmPassword
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {passwordData.newPassword === passwordData.confirmPassword
                  ? '✓ Le password corrispondono'
                  : '✗ Le password non corrispondono'}
              </p>
            )}
          </div>
        </div>

        {/* Pulsante salva */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={changingPassword}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center font-medium"
          >
            {changingPassword ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Aggiornamento...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Cambia Password
              </>
            )}
          </button>
        </div>
      </form>

      {/* Info box */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-slate-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-slate-300">Suggerimenti per una password sicura</h4>
            <ul className="mt-2 text-sm text-slate-300 list-disc list-inside space-y-1">
              <li>Usa almeno 6 caratteri</li>
              <li>Combina lettere maiuscole e minuscole</li>
              <li>Includi numeri e caratteri speciali</li>
              <li>Non condividere la tua password con nessuno</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal': return renderPersonalTab();
      case 'schedule': return renderScheduleTab();
      case 'password': return renderPasswordTab();
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
              <User className="h-8 w-8 mr-3 text-slate-400" />
              Profilo Personale
            </h1>
            <p className="text-slate-400 mt-2">
              Gestisci le tue informazioni personali e l'orario di lavoro
            </p>
          </div>
        </div>
      </div>

      {/* Tab orizzontali */}
      <div className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
        <nav className="flex border-b border-zinc-800">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 text-left transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'bg-zinc-800 text-white border-white'
                    : 'text-slate-400 hover:bg-zinc-800/50 hover:text-white border-transparent'
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