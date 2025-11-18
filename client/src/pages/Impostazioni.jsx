import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { useDesktopNotifications } from '../hooks/useDesktopNotifications';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  User, 
  Lock, 
  Save, 
  Building2,
  MapPin,
  Clock,
  Globe,
  Mail,
  Phone,
  Calendar,
  FileText,
  Database,
  Network,
  Key,
  Eye,
  EyeOff,
  Download,
  Upload,
  Trash2,
  Edit,
  Plus,
  Send,
  Users,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';

const Settings = () => {
  const { user, apiCall } = useAuthStore();
  const { isSupported, enabled, permission, requestPermission, disable } = useDesktopNotifications();
  const [activeTab, setActiveTab] = useState(user?.role === 'admin' ? 'company' : 'notifications');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    company: {
      name: 'LABA Firenze',
      address: 'Via Roma, 123 - 50123 Firenze',
      vat: 'IT12345678901',
      phone: '+39 055 123 4567',
      email: 'info@labafirenze.com',
      website: 'https://labafirenze.com'
    },
    notifications: {
      attendanceReminders: true,
      leaveRequestUpdates: true,
      weeklyReports: false
    },
    emailManagement: {
      employees: [],
      selectedEmployee: '',
      emailType: 'attendance',
      customMessage: '',
      schedulerStatus: null,
      autoReminders: true,
      weeklyReports: true,
      monthlyReports: true,
      attendanceAlerts: true
    }
  });

  // Stati per Email Management
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  // Funzioni per Email Management
  const fetchEmployees = async () => {
    try {
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({
          ...prev,
          emailManagement: {
            ...prev.emailManagement,
            employees: data.employees || data || []
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchSchedulerStatus = async () => {
    try {
      const response = await apiCall('/api/email/scheduler/status');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(prev => ({
            ...prev,
            emailManagement: {
              ...prev.emailManagement,
              schedulerStatus: data.scheduler
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
    }
  };

  const sendEmail = async () => {
    setEmailLoading(true);
    setEmailResult(null);
    
    try {
      // Validazione per messaggio personalizzato
      if (settings.emailManagement.emailType === 'custom' && !settings.emailManagement.customMessage.trim()) {
        setEmailResult({ success: false, message: 'Inserisci un messaggio personalizzato' });
        setEmailLoading(false);
        return;
      }

      const response = await apiCall('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId: settings.emailManagement.selectedEmployee,
          type: settings.emailManagement.emailType,
          message: settings.emailManagement.emailType === 'custom' ? settings.emailManagement.customMessage : ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEmailResult({ success: true, message: data.message });
      } else {
        const errorData = await response.json();
        setEmailResult({ success: false, message: errorData.error || 'Errore nell\'invio dell\'email' });
      }
    } catch (error) {
      setEmailResult({ success: false, message: 'Errore di connessione' });
    } finally {
      setEmailLoading(false);
    }
  };

  const toggleScheduler = async () => {
    setEmailLoading(true);
    try {
      const response = await apiCall('/api/email/scheduler/toggle', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({
          ...prev,
          emailManagement: {
            ...prev.emailManagement,
            schedulerStatus: data.scheduler
          }
        }));
      }
    } catch (error) {
      console.error('Error toggling scheduler:', error);
    } finally {
      setEmailLoading(false);
    }
  };

  // Carica impostazioni dal database al mount
  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await apiCall('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(prevSettings => ({
            ...prevSettings,
            ...data
          }));
          console.log('Settings caricate dal database:', data);
        } else {
          // Fallback al localStorage se API fallisce
          const saved = localStorage.getItem('settings');
          if (saved) {
            setSettings(JSON.parse(saved));
            console.log('Settings caricate da localStorage');
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        // Fallback al localStorage
        const saved = localStorage.getItem('settings');
        if (saved) {
          setSettings(JSON.parse(saved));
        }
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [apiCall]);

  // Carica dati Email Management quando si apre il tab
  React.useEffect(() => {
    if (activeTab === 'emailManagement') {
      fetchEmployees();
      fetchSchedulerStatus();
    }
  }, [activeTab]);

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const handleSaveSettings = async () => {
    try {
      // Salva le impostazioni nel database usando apiCall
      const { apiCall } = useAuthStore.getState();
      const response = await apiCall('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });
      
      if (response.ok) {
        // Salva anche nel localStorage come backup
        localStorage.setItem('settings', JSON.stringify(settings));
        console.log('Settings salvate nel database e localStorage');
        alert('Impostazioni salvate con successo!');
      } else {
        // Fallback: salva solo nel localStorage
        localStorage.setItem('settings', JSON.stringify(settings));
        console.log('Database save failed, using localStorage only');
        alert('Impostazioni salvate localmente (errore database)');
      }
      
      console.log('Settings saved:', settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Errore nel salvare le impostazioni');
    }
  };

  const tabs = [
    ...(user?.role === 'admin' ? [{ id: 'company', name: 'Azienda', icon: Building2 }] : []),
    { id: 'notifications', name: 'Notifiche', icon: Bell },
    ...(user?.role === 'admin' ? [
      { id: 'emailManagement', name: 'Mail', icon: Mail },
    ] : [])
  ];


  const renderCompanyTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Nome Azienda</label>
          <input
            type="text"
            value={settings.company.name}
            onChange={(e) => handleSettingChange('company', 'name', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Sede Legale</label>
          <input
            type="text"
            value={settings.company.address}
            onChange={(e) => handleSettingChange('company', 'address', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">P.IVA</label>
          <input
            type="text"
            value={settings.company.vat}
            onChange={(e) => handleSettingChange('company', 'vat', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Telefono</label>
          <input
            type="tel"
            value={settings.company.phone}
            onChange={(e) => handleSettingChange('company', 'phone', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
          <input
            type="email"
            value={settings.company.email}
            onChange={(e) => handleSettingChange('company', 'email', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Sito Web</label>
          <input
            type="url"
            value={settings.company.website}
            onChange={(e) => handleSettingChange('company', 'website', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      {/* Notifiche Desktop */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Bell className="h-5 w-5 mr-2 text-indigo-400" />
          Notifiche Desktop
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          Ricevi notifiche desktop dal browser quando arrivano nuove richieste o aggiornamenti.
        </p>
        <div className="space-y-3">
          <div className="p-4 bg-slate-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-white font-medium">Notifiche Browser</h4>
                <p className="text-slate-400 text-sm">
                  {isSupported 
                    ? permission === 'granted' 
                      ? 'Le notifiche desktop sono abilitate'
                      : permission === 'denied'
                        ? 'Le notifiche sono state bloccate. Abilitala manualmente dalle impostazioni del browser.'
                        : 'Clicca su "Abilita" per ricevere notifiche desktop'
                    : 'Il tuo browser non supporta le notifiche desktop'
                  }
                </p>
              </div>
              {isSupported && (
                <div className="flex items-center space-x-3">
                  {permission === 'granted' && enabled ? (
                    <button
                      onClick={disable}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      Disabilita
                    </button>
                  ) : permission === 'default' ? (
                    <button
                      onClick={async () => {
                        const success = await requestPermission();
                        if (!success) {
                          alert('Impossibile abilitare le notifiche. Controlla le impostazioni del browser.');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                      Abilita
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-slate-600 text-slate-400 rounded-lg cursor-not-allowed">
                      Bloccato
                    </span>
                  )}
                </div>
              )}
            </div>
            {!isSupported && (
              <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Le notifiche desktop sono supportate solo su browser moderni (Chrome, Firefox, Safari, Edge).
                </p>
              </div>
            )}
            {permission === 'denied' && (
              <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  ℹ️ Per abilitare le notifiche, vai nelle impostazioni del browser e consenti le notifiche per questo sito.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notifiche Email */}
      <div className="space-y-4 mt-8">
        <h3 className="text-lg font-semibold text-white">Impostazioni Notifiche Email</h3>
        <p className="text-slate-400 text-sm mb-4">
          Configura le notifiche email che desideri ricevere dal sistema HR.
        </p>
        <div className="space-y-3">
          {[
            { key: 'attendanceReminders', label: 'Promemoria Presenze', description: 'Ricevi promemoria per le timbrature' },
            { key: 'leaveRequestUpdates', label: 'Aggiornamenti Richieste Permessi', description: 'Ricevi notifiche sullo stato delle tue richieste di permessi e ferie' },
            { key: 'weeklyReports', label: 'Report Settimanali', description: 'Ricevi un riepilogo settimanale delle tue presenze e ore lavorate' }
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
              <div>
                <h4 className="text-white font-medium">{item.label}</h4>
                <p className="text-slate-400 text-sm">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications[item.key]}
                  onChange={(e) => handleSettingChange('notifications', item.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEmailManagementTab = () => {

    return (
      <div className="space-y-6">
        {/* Email Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Promemoria Email */}
          <div className="bg-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white flex items-center mb-4">
              <Clock className="h-5 w-5 mr-2 text-orange-400" />
              Promemoria Email
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Dipendente</label>
                <div className="relative">
                  <select
                    value={settings.emailManagement.selectedEmployee}
                    onChange={(e) => handleSettingChange('emailManagement', 'selectedEmployee', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer custom-select"
                  >
                    <option value="">Seleziona dipendente</option>
                    {settings.emailManagement.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.email})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo Email</label>
                <div className="relative">
                  <select
                    value={settings.emailManagement.emailType}
                    onChange={(e) => handleSettingChange('emailManagement', 'emailType', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer custom-select"
                  >
                    <option value="attendance">Promemoria Presenze</option>
                    <option value="leave">Richiesta Permessi</option>
                    <option value="report">Report Settimanale</option>
                    <option value="custom">Messaggio Personalizzato</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {settings.emailManagement.emailType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Messaggio Personalizzato</label>
                  <textarea
                    value={settings.emailManagement.customMessage}
                    onChange={(e) => handleSettingChange('emailManagement', 'customMessage', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows="3"
                    placeholder="Inserisci un messaggio personalizzato..."
                  />
                </div>
              )}

              <button
                onClick={sendEmail}
                disabled={emailLoading || !settings.emailManagement.selectedEmployee}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
              >
                {emailLoading ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {emailLoading ? 'Invio...' : 'Invia Email'}
              </button>

              {emailResult && (
                <div className={`p-3 rounded-lg flex items-center ${
                  emailResult.success ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {emailResult.success ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mr-2" />
                  )}
                  {emailResult.message}
                </div>
              )}
            </div>
          </div>

          {/* Scheduler Status */}
          <div className="bg-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white flex items-center mb-4">
              <Calendar className="h-5 w-5 mr-2 text-green-400" />
              Scheduler Email
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Stato Scheduler:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  settings.emailManagement.schedulerStatus?.active 
                    ? 'bg-green-900 text-green-300' 
                    : 'bg-red-900 text-red-300'
                }`}>
                  {settings.emailManagement.schedulerStatus?.active ? 'Attivo' : 'Inattivo'}
                </span>
              </div>

              <button
                onClick={toggleScheduler}
                disabled={emailLoading}
                className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
                  settings.emailManagement.schedulerStatus?.active
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {emailLoading ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                {settings.emailManagement.schedulerStatus?.active ? 'Disattiva' : 'Attiva'} Scheduler
              </button>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Impostazioni Email Automatiche</h3>
          <div className="space-y-3">
            {[
              { key: 'autoReminders', label: 'Promemoria Automatici', description: 'Invia automaticamente promemoria per le presenze' },
              { key: 'weeklyReports', label: 'Report Settimanali', description: 'Invia automaticamente report settimanali' },
              { key: 'monthlyReports', label: 'Report Mensili', description: 'Invia automaticamente report mensili' },
              { key: 'attendanceAlerts', label: 'Avvisi Presenze', description: 'Invia avvisi per presenze anomale' }
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-slate-600 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">{item.label}</h4>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emailManagement[item.key]}
                    onChange={(e) => handleSettingChange('emailManagement', item.key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-500 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'company': return renderCompanyTab();
      case 'notifications': return renderNotificationsTab();
      case 'emailManagement': return renderEmailManagementTab();
      default: return <div className="text-slate-400">Sezione in sviluppo...</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <SettingsIcon className="h-8 w-8 mr-3 text-indigo-400" />
              Impostazioni
            </h1>
            <p className="text-slate-400 mt-2">
              Gestisci le impostazioni del sistema e del tuo profilo
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-lg p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <IconComponent className="h-5 w-5 mr-3" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-slate-800 rounded-lg p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-slate-400">Caricamento impostazioni...</div>
              </div>
            ) : (
              <>
                {renderTabContent()}
                
                <div className="mt-8 pt-6 border-t border-slate-700">
                  <button
                    onClick={handleSaveSettings}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    Salva Impostazioni
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
