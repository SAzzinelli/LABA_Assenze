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
  const { isSupported, enabled, permission, updatePermission, disable } = useDesktopNotifications();
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
      customMessage: ''
    }
  });

  // Stati per Email Management
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  // Stati per Google Calendar Test
  const [calendarTestForm, setCalendarTestForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'permission',
    hours: 2,
    reason: 'Test evento Google Calendar',
    entryTime: '',
    exitTime: ''
  });
  const [calendarTestLoading, setCalendarTestLoading] = useState(false);
  const [calendarTestResult, setCalendarTestResult] = useState(null);
  const [employees, setEmployees] = useState([]);

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

  const sendEmail = async () => {
    setEmailLoading(true);
    setEmailResult(null);
    
    try {
      if (!settings.emailManagement.selectedEmployee) {
        setEmailResult({ success: false, message: 'Seleziona un dipendente' });
        setEmailLoading(false);
        return;
      }

      if (!settings.emailManagement.customMessage.trim()) {
        setEmailResult({ success: false, message: 'Inserisci un messaggio' });
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
          type: 'custom',
          message: settings.emailManagement.customMessage
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEmailResult({ success: true, message: data.message || 'Email inviata con successo' });
        // Reset form dopo invio riuscito
        setSettings(prev => ({
          ...prev,
          emailManagement: {
            ...prev.emailManagement,
            selectedEmployee: '',
            customMessage: ''
          }
        }));
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
    }
    if (activeTab === 'googleCalendarTest') {
      fetchEmployeesForCalendar();
    }
  }, [activeTab]);

  const fetchEmployeesForCalendar = async () => {
    try {
      const response = await apiCall('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || data || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

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
      { id: 'emailManagement', name: 'Email', icon: Mail },
      { id: 'googleCalendarTest', name: 'Google Calendar Test', icon: Calendar },
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
                        ? 'Le notifiche sono state bloccate. Vedi istruzioni sotto per abilitarle manualmente.'
                        : 'Clicca su "Abilita" per richiedere il permesso per le notifiche desktop'
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
                  ) : (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Rileva il browser
                        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
                        
                        console.log('🔔 ============================================');
                        console.log('🔔 Button clicked - Requesting notification permission...');
                        console.log('🔔 Browser detection:', { isSafari, isChrome, isFirefox });
                        console.log('🔔 User Agent:', navigator.userAgent);
                        console.log('🔔 Current Notification.permission:', Notification.permission);
                        console.log('🔔 window.location.protocol:', window.location.protocol);
                        console.log('🔔 window.location.hostname:', window.location.hostname);
                        console.log('🔔 Is HTTPS?:', window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                        console.log('🔔 Notification object exists?:', typeof Notification !== 'undefined');
                        console.log('🔔 Notification.requestPermission exists?:', typeof Notification.requestPermission);
                        console.log('🔔 Notification.requestPermission type:', typeof Notification.requestPermission);
                        
                        // Verifica HTTPS (richiesto per notifiche)
                        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                        if (!isSecure) {
                          console.error('❌ HTTPS required for notifications');
                          alert('⚠️ Le notifiche richiedono una connessione HTTPS. Il sito deve essere servito tramite HTTPS per funzionare.');
                          return;
                        }

                        // Se il permesso è già denied, informa l'utente
                        if (Notification.permission === 'denied') {
                          console.warn('⚠️ Permission already denied - user must enable manually');
                          updatePermission();
                          return;
                        }

                        // Verifica che Notification.requestPermission esista
                        if (typeof Notification.requestPermission !== 'function') {
                          console.error('❌ Notification.requestPermission is not a function!');
                          alert('⚠️ Il browser non supporta la richiesta di permesso per le notifiche.');
                          return;
                        }

                        console.log('🔔 Calling Notification.requestPermission() NOW (synchronously in click handler)...');
                        
                        // IMPORTANTE: Chiama Notification.requestPermission() DIRETTAMENTE nel click handler
                        // Questo è richiesto da Safari (e raccomandato da altri browser) per mostrare il prompt
                        try {
                          // Chiama direttamente - può restituire una Promise o undefined (callback API)
                          const result = Notification.requestPermission();
                          
                          console.log('🔔 Notification.requestPermission() returned:', result);
                          console.log('🔔 Return type:', typeof result);
                          
                          // Gestisci il risultato (può essere una Promise o una stringa diretta)
                          if (result && typeof result.then === 'function') {
                            // Promise-based API (Chrome, Firefox, Safari 16+)
                            console.log('🔔 Promise-based API detected - waiting for result...');
                            result.then((permissionResult) => {
                              console.log('🔔 ✅ Permission result from Promise:', permissionResult);
                              console.log('🔔 Notification.permission after Promise resolve:', Notification.permission);
                              updatePermission();
                              
                              if (permissionResult === 'granted') {
                                setTimeout(() => {
                                  try {
                                    new Notification('Notifiche abilitate', {
                                      body: 'Riceverai notifiche per le nuove richieste',
                                      icon: '/favicon.ico',
                                      tag: 'permission-granted'
                                    });
                                    console.log('🔔 ✅ Test notification shown');
                                  } catch (err) {
                                    console.error('❌ Error showing test notification:', err);
                                  }
                                }, 100);
                              } else {
                                console.log('🔔 ⚠️ Permission denied or dismissed:', permissionResult);
                              }
                            }).catch((error) => {
                              console.error('❌ Error in permission promise:', error);
                              updatePermission();
                            });
                          } else if (typeof result === 'string') {
                            // Alcuni browser (molto rari) restituiscono direttamente la stringa
                            console.log('🔔 ✅ Direct string result:', result);
                            console.log('🔔 Notification.permission:', Notification.permission);
                            updatePermission();
                            
                            if (result === 'granted') {
                              setTimeout(() => {
                                try {
                                  new Notification('Notifiche abilitate', {
                                    body: 'Riceverai notifiche per le nuove richieste',
                                    icon: '/favicon.ico',
                                    tag: 'permission-granted'
                                  });
                                  console.log('🔔 ✅ Test notification shown');
                                } catch (err) {
                                  console.error('❌ Error showing test notification:', err);
                                }
                              }, 100);
                            }
                          } else {
                            // Callback-based API (Safari legacy) - dovremmo passare una callback
                            // Ma alcuni Safari moderni possono restituire undefined e poi chiamare la callback
                            console.log('🔔 ⚠️ Callback-based API or undefined result - checking permission after short delay...');
                            
                            // Aspetta un po' e controlla il permesso
                            setTimeout(() => {
                              const delayedPermission = Notification.permission;
                              console.log('🔔 Notification.permission after delay:', delayedPermission);
                              updatePermission();
                              
                              if (delayedPermission === 'granted') {
                                try {
                                  new Notification('Notifiche abilitate', {
                                    body: 'Riceverai notifiche per le nuove richieste',
                                    icon: '/favicon.ico',
                                    tag: 'permission-granted'
                                  });
                                  console.log('🔔 ✅ Test notification shown');
                                } catch (err) {
                                  console.error('❌ Error showing test notification:', err);
                                }
                              }
                            }, 500);
                            
                            // Prova anche con callback esplicita per Safari legacy
                            if (isSafari && typeof Notification.requestPermission === 'function') {
                              console.log('🔔 Attempting callback-based API for Safari...');
                              try {
                                Notification.requestPermission((callbackResult) => {
                                  console.log('🔔 ✅ Permission result from callback:', callbackResult);
                                  console.log('🔔 Notification.permission:', Notification.permission);
                                  updatePermission();
                                  
                                  if (callbackResult === 'granted') {
                                    setTimeout(() => {
                                      try {
                                        new Notification('Notifiche abilitate', {
                                          body: 'Riceverai notifiche per le nuove richieste',
                                          icon: '/favicon.ico',
                                          tag: 'permission-granted'
                                        });
                                        console.log('🔔 ✅ Test notification shown');
                                      } catch (err) {
                                        console.error('❌ Error showing test notification:', err);
                                      }
                                    }, 100);
                                  }
                                });
                              } catch (callbackError) {
                                console.warn('⚠️ Callback API also failed:', callbackError);
                              }
                            }
                          }
                        } catch (error) {
                          console.error('❌ Error calling Notification.requestPermission():', error);
                          console.error('❌ Error details:', {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                          });
                          updatePermission();
                        }
                        
                        console.log('🔔 ============================================');
                      }}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        permission === 'denied' 
                          ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                      disabled={permission === 'denied'}
                    >
                      {permission === 'denied' ? 'Bloccato - Vedi istruzioni sotto' : 'Abilita'}
                    </button>
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
                <p className="text-yellow-400 text-sm font-medium mb-2">
                  ℹ️ Notifiche bloccate
                </p>
                <p className="text-yellow-400 text-sm mb-2">
                  Il permesso per le notifiche è stato bloccato. Per abilitarlo:
                </p>
                {(() => {
                  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
                  
                  if (isChrome) {
                    return (
                      <ol className="text-yellow-300 text-xs list-decimal list-inside space-y-1 ml-2">
                        <li>Clicca sull'icona del lucchetto o del sito (a sinistra della barra degli indirizzi)</li>
                        <li>Seleziona "Notifiche"</li>
                        <li>Cambia da "Blocca" a "Consenti"</li>
                        <li>Ricarica la pagina</li>
                      </ol>
                    );
                  } else if (isSafari) {
                    return (
                      <ol className="text-yellow-300 text-xs list-decimal list-inside space-y-1 ml-2">
                        <li>Vai su Safari → Impostazioni → Siti web</li>
                        <li>Seleziona "Notifiche" nella barra laterale</li>
                        <li>Cerca questo sito nella lista</li>
                        <li>Imposta il permesso su "Consenti"</li>
                        <li>Ricarica la pagina</li>
                      </ol>
                    );
                  } else {
                    return (
                      <ol className="text-yellow-300 text-xs list-decimal list-inside space-y-1 ml-2">
                        <li>Vai nelle impostazioni del browser</li>
                        <li>Cerca "Notifiche" o "Permessi sito"</li>
                        <li>Trova questo sito nella lista</li>
                        <li>Cambia il permesso da "Blocca" a "Consenti"</li>
                        <li>Ricarica la pagina</li>
                      </ol>
                    );
                  }
                })()}
              </div>
            )}
            {permission === 'default' && (
              <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <p className="text-blue-300 text-sm">
                  💡 Clicca su "Abilita" per richiedere il permesso per le notifiche. Il browser mostrerà un prompt per confermare.
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

  const handleCalendarTest = async () => {
    if (!calendarTestForm.employeeId || !calendarTestForm.date) {
      setCalendarTestResult({ success: false, message: 'Compila tutti i campi obbligatori' });
      return;
    }

    setCalendarTestLoading(true);
    setCalendarTestResult(null);

    try {
      const response = await apiCall('/api/admin/google-calendar/test-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calendarTestForm)
      });

      const data = await response.json();
      
      if (response.ok) {
        setCalendarTestResult({ 
          success: true, 
          message: 'Evento creato con successo!',
          eventId: data.eventId 
        });
        // Reset form
        setCalendarTestForm({
          employeeId: '',
          date: new Date().toISOString().split('T')[0],
          type: 'permission',
          hours: 2,
          reason: 'Test evento Google Calendar',
          entryTime: '',
          exitTime: ''
        });
      } else {
        setCalendarTestResult({ 
          success: false, 
          message: data.error || 'Errore nella creazione dell\'evento' 
        });
      }
    } catch (error) {
      console.error('Error creating test event:', error);
      setCalendarTestResult({ 
        success: false, 
        message: 'Errore di connessione' 
      });
    } finally {
      setCalendarTestLoading(false);
    }
  };

  const renderGoogleCalendarTestTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <p className="text-yellow-300 text-sm">
            ⚠️ <strong>Modalità Test:</strong> Questa funzione crea eventi di test su Google Calendar senza approvare permessi reali. 
            Usa questa funzione solo per testare l'integrazione.
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Genera Evento Test</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Dipendente *
              </label>
              <select
                value={calendarTestForm.employeeId}
                onChange={(e) => setCalendarTestForm({ ...calendarTestForm, employeeId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleziona dipendente</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Data *
              </label>
              <input
                type="date"
                value={calendarTestForm.date}
                onChange={(e) => setCalendarTestForm({ ...calendarTestForm, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipo *
              </label>
              <select
                value={calendarTestForm.type}
                onChange={(e) => setCalendarTestForm({ ...calendarTestForm, type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="permission">Permesso</option>
                <option value="permission_104">Permesso 104</option>
                <option value="vacation">Ferie</option>
                <option value="sick_leave">Malattia</option>
              </select>
            </div>

            {calendarTestForm.type === 'permission' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Ore *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="8"
                    value={calendarTestForm.hours}
                    onChange={(e) => setCalendarTestForm({ ...calendarTestForm, hours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Ora Entrata (opzionale, es. 10:00)
                  </label>
                  <input
                    type="time"
                    value={calendarTestForm.entryTime}
                    onChange={(e) => setCalendarTestForm({ ...calendarTestForm, entryTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Ora Uscita (opzionale, es. 12:00)
                  </label>
                  <input
                    type="time"
                    value={calendarTestForm.exitTime}
                    onChange={(e) => setCalendarTestForm({ ...calendarTestForm, exitTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Motivo
              </label>
              <input
                type="text"
                value={calendarTestForm.reason}
                onChange={(e) => setCalendarTestForm({ ...calendarTestForm, reason: e.target.value })}
                placeholder="Motivo del permesso/test"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleCalendarTest}
              disabled={calendarTestLoading || !calendarTestForm.employeeId || !calendarTestForm.date}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center"
            >
              <Calendar className="h-5 w-5 mr-2" />
              {calendarTestLoading ? 'Generazione...' : 'Genera Evento Test'}
            </button>
          </div>

          {calendarTestResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              calendarTestResult.success 
                ? 'bg-green-900/20 border border-green-500/30' 
                : 'bg-red-900/20 border border-red-500/30'
            }`}>
              <p className={calendarTestResult.success ? 'text-green-300' : 'text-red-300'}>
                {calendarTestResult.success ? '✅ ' : '❌ '}
                {calendarTestResult.message}
                {calendarTestResult.eventId && (
                  <span className="block text-xs mt-1">Event ID: {calendarTestResult.eventId}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEmailManagementTab = () => {
    return (
      <div className="space-y-6">
        {/* Info Email Automatiche */}
        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-6">
          <div className="flex items-start">
            <Mail className="h-5 w-5 mr-3 text-indigo-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Email Automatiche</h3>
              <p className="text-slate-300 text-sm mb-3">
                Il sistema invia automaticamente email quando:
              </p>
              <ul className="text-slate-400 text-sm space-y-1 list-disc list-inside">
                <li>Un dipendente richiede un permesso, ferie o malattia → Email agli admin</li>
                <li>Un admin approva o rifiuta una richiesta → Email al dipendente</li>
                <li>Viene creata o accettata una proposta di recupero ore → Email alle parti coinvolte</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Invio Email Manuale */}
          <div className="bg-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white flex items-center mb-4">
            <Send className="h-5 w-5 mr-2 text-indigo-400" />
            Invio Email Manuale
            </h3>
          <p className="text-slate-400 text-sm mb-6">
            Invia un'email personalizzata a un dipendente specifico.
          </p>

            <div className="space-y-4">
              <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Dipendente <span className="text-red-400">*</span>
              </label>
                <div className="relative">
                  <select
                    value={settings.emailManagement.selectedEmployee}
                    onChange={(e) => handleSettingChange('emailManagement', 'selectedEmployee', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                  <option value="">Seleziona un dipendente</option>
                    {settings.emailManagement.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                      {emp.firstName || emp.first_name} {emp.lastName || emp.last_name} {emp.email ? `(${emp.email})` : ''}
                      </option>
                    ))}
                  </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Messaggio <span className="text-red-400">*</span>
              </label>
                  <textarea
                    value={settings.emailManagement.customMessage}
                    onChange={(e) => handleSettingChange('emailManagement', 'customMessage', e.target.value)}
                className="w-full px-4 py-3 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows="6"
                placeholder="Scrivi il messaggio che vuoi inviare al dipendente..."
              />
              <p className="text-slate-500 text-xs mt-1">
                Il messaggio verrà inviato come email al dipendente selezionato.
              </p>
                </div>

              <button
                onClick={sendEmail}
              disabled={emailLoading || !settings.emailManagement.selectedEmployee || !settings.emailManagement.customMessage.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center font-medium"
              >
                {emailLoading ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Invio in corso...
                </>
                ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Invia Email
                </>
                )}
              </button>

              {emailResult && (
              <div className={`p-4 rounded-lg flex items-start ${
                emailResult.success 
                  ? 'bg-green-900/30 border border-green-500/30 text-green-300' 
                  : 'bg-red-900/30 border border-red-500/30 text-red-300'
                }`}>
                  {emailResult.success ? (
                  <CheckCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium">{emailResult.success ? 'Email inviata con successo' : 'Errore nell\'invio'}</p>
                  <p className="text-sm mt-1 opacity-90">{emailResult.message}</p>
                </div>
              </div>
            )}
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
      case 'googleCalendarTest': return renderGoogleCalendarTestTab();
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
