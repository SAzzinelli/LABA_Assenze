import React, { useState } from 'react';
import { useAuthStore } from '../utils/store';
import { Settings as SettingsIcon, Bell, Shield, User, Lock, Save } from 'lucide-react';

const Settings = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    privacy: {
      showProfile: true,
      showAttendance: false,
      showSchedule: true
    },
    preferences: {
      language: 'it',
      timezone: 'Europe/Rome',
      dateFormat: 'DD/MM/YYYY'
    }
  });

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const handleSaveSettings = () => {
    // Qui implementeremo la logica per salvare le impostazioni
    console.log('Saving settings:', settings);
  };

  const tabs = [
    { id: 'profile', name: 'Profilo', icon: User },
    { id: 'notifications', name: 'Notifiche', icon: Bell },
    { id: 'privacy', name: 'Privacy', icon: Shield },
    { id: 'security', name: 'Sicurezza', icon: Lock }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <SettingsIcon className="h-8 w-8 mr-3 text-slate-400" />
          Impostazioni
        </h1>
        <p className="text-slate-400 mt-2">
          Gestisci le tue preferenze e configurazioni
        </p>
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
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <IconComponent className="mr-3 h-5 w-5" />
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
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-6">Impostazioni Profilo</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Lingua
                    </label>
                    <select
                      value={settings.preferences.language}
                      onChange={(e) => handleSettingChange('preferences', 'language', e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="it">Italiano</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Fuso Orario
                    </label>
                    <select
                      value={settings.preferences.timezone}
                      onChange={(e) => handleSettingChange('preferences', 'timezone', e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Europe/Rome">Europa/Roma</option>
                      <option value="Europe/London">Europa/Londra</option>
                      <option value="America/New_York">America/New York</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Formato Data
                    </label>
                    <select
                      value={settings.preferences.dateFormat}
                      onChange={(e) => handleSettingChange('preferences', 'dateFormat', e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-6">Impostazioni Notifiche</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Email</h4>
                      <p className="text-sm text-slate-400">Ricevi notifiche via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifications.email}
                        onChange={(e) => handleSettingChange('notifications', 'email', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Push</h4>
                      <p className="text-sm text-slate-400">Ricevi notifiche push</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifications.push}
                        onChange={(e) => handleSettingChange('notifications', 'push', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">SMS</h4>
                      <p className="text-sm text-slate-400">Ricevi notifiche via SMS</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifications.sms}
                        onChange={(e) => handleSettingChange('notifications', 'sms', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Settings */}
            {activeTab === 'privacy' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-6">Impostazioni Privacy</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Mostra Profilo</h4>
                      <p className="text-sm text-slate-400">Rendi il tuo profilo visibile agli altri dipendenti</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.privacy.showProfile}
                        onChange={(e) => handleSettingChange('privacy', 'showProfile', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Mostra Presenze</h4>
                      <p className="text-sm text-slate-400">Rendi le tue presenze visibili ai colleghi</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.privacy.showAttendance}
                        onChange={(e) => handleSettingChange('privacy', 'showAttendance', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Mostra Orario</h4>
                      <p className="text-sm text-slate-400">Rendi il tuo orario di lavoro visibile</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.privacy.showSchedule}
                        onChange={(e) => handleSettingChange('privacy', 'showSchedule', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-6">Impostazioni Sicurezza</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Cambia Password</h4>
                    <p className="text-sm text-slate-400 mb-4">Aggiorna la tua password per mantenere l'account sicuro</p>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                      Cambia Password
                    </button>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Autenticazione a Due Fattori</h4>
                    <p className="text-sm text-slate-400 mb-4">Aggiungi un livello extra di sicurezza al tuo account</p>
                    <button className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                      Attiva 2FA
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-8 pt-6 border-t border-slate-700">
              <button
                onClick={handleSaveSettings}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
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