import React, { useState } from 'react';
import { useAuthStore } from '../utils/store';
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
  Plus
} from 'lucide-react';

const Settings = () => {
  const { user, apiCall } = useAuthStore();
  const [activeTab, setActiveTab] = useState(user?.role === 'admin' ? 'company' : 'notifications');
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
      email: true,
      push: true,
      sms: false,
      attendanceReminders: true,
      leaveRequestUpdates: true,
      systemAnnouncements: true,
      weeklyReports: false,
      monthlyReports: true
    },
    privacy: {
      showProfile: true,
      showAttendance: false,
      showSchedule: true,
      showSalary: false,
      dataRetention: '2 years',
      analytics: false
    },
    security: {
      twoFactorAuth: false,
      passwordExpiry: 90,
      sessionTimeout: 30,
      loginNotifications: true,
      deviceManagement: true,
      auditLogs: true
    },
    system: {
      language: 'it',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      currency: 'EUR',
      backupFrequency: 'daily',
      maintenanceWindow: '02:00-04:00',
      logLevel: 'info'
    },
    integrations: {
      googleCalendar: false,
      slack: false,
      teams: false,
      payroll: false,
      attendance: true,
      documents: true
    }
  });

  // Carica impostazioni dal database al mount
  React.useEffect(() => {
    const loadSettings = async () => {
      try {
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
      }
    };

    loadSettings();
  }, [apiCall]);

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
    { id: 'privacy', name: 'Privacy', icon: Shield },
    { id: 'security', name: 'Sicurezza', icon: Lock },
    ...(user?.role === 'admin' ? [
      { id: 'system', name: 'Sistema', icon: SettingsIcon },
      { id: 'integrations', name: 'Integrazioni', icon: Network },
      { id: 'backup', name: 'Backup', icon: Database }
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
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Canali di Notifica</h3>
        <div className="space-y-3">
          {[
            { key: 'email', label: 'Email', description: 'Ricevi notifiche via email' },
            { key: 'push', label: 'Notifiche Push', description: 'Notifiche nel browser' },
            { key: 'sms', label: 'SMS', description: 'Notifiche via SMS' }
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

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Tipi di Notifica</h3>
        <div className="space-y-3">
          {[
            { key: 'attendanceReminders', label: 'Promemoria Presenze', description: 'Ricordi per timbrature' },
            { key: 'leaveRequestUpdates', label: 'Aggiornamenti Richieste', description: 'Stato richieste permessi' },
            { key: 'systemAnnouncements', label: 'Annunci Sistema', description: 'Aggiornamenti e manutenzioni' },
            { key: 'weeklyReports', label: 'Report Settimanali', description: 'Resoconti settimanali' },
            { key: 'monthlyReports', label: 'Report Mensili', description: 'Resoconti mensili' }
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

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Lingua</label>
          <select
            value={settings.system.language}
            onChange={(e) => handleSettingChange('system', 'language', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Formato Data</label>
          <select
            value={settings.system.dateFormat}
            onChange={(e) => handleSettingChange('system', 'dateFormat', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Formato Ora</label>
          <select
            value={settings.system.timeFormat}
            onChange={(e) => handleSettingChange('system', 'timeFormat', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="24h">24 ore</option>
            <option value="12h">12 ore (AM/PM)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Valuta</label>
          <select
            value={settings.system.currency}
            onChange={(e) => handleSettingChange('system', 'currency', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Frequenza Backup</label>
          <select
            value={settings.system.backupFrequency}
            onChange={(e) => handleSettingChange('system', 'backupFrequency', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="hourly">Ogni Ora</option>
            <option value="daily">Giornaliero</option>
            <option value="weekly">Settimanale</option>
            <option value="monthly">Mensile</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Finestra Manutenzione</label>
          <input
            type="text"
            value={settings.system.maintenanceWindow}
            onChange={(e) => handleSettingChange('system', 'maintenanceWindow', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="02:00-04:00"
          />
        </div>
      </div>
    </div>
  );

  const renderBackupTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Download className="h-5 w-5 mr-2 text-green-400" />
            Esporta Dati
          </h3>
          <p className="text-slate-400 mb-4">Scarica tutti i tuoi dati in formato JSON</p>
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Download className="h-4 w-4 mr-2 inline" />
            Scarica Backup
          </button>
        </div>
        
        <div className="bg-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Upload className="h-5 w-5 mr-2 text-blue-400" />
            Ripristina Dati
          </h3>
          <p className="text-slate-400 mb-4">Carica un file di backup per ripristinare i dati</p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Upload className="h-4 w-4 mr-2 inline" />
            Carica Backup
          </button>
        </div>
      </div>

      <div className="bg-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Trash2 className="h-5 w-5 mr-2 text-red-400" />
          Cancellazione Dati
        </h3>
        <p className="text-slate-400 mb-4">
          Attenzione: Questa azione eliminerà permanentemente tutti i tuoi dati e non può essere annullata.
        </p>
        <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
          <Trash2 className="h-4 w-4 mr-2 inline" />
          Elimina Tutti i Dati
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'company': return renderCompanyTab();
      case 'notifications': return renderNotificationsTab();
      case 'system': return renderSystemTab();
      case 'backup': return renderBackupTab();
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
