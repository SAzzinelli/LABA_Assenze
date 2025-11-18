import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/store';
import { useDesktopNotifications } from '../hooks/useDesktopNotifications';
import {
  LogOut,
  Bell,
  Home,
  Users,
  Clock,
  FileText,
  User,
  Settings,
  Menu,
  X,
  Sparkles,
  Heart,
  Plane,
  DollarSign,
  Mail,
  CheckCircle,
  XCircle,
  Accessibility,
  RefreshCw
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout, apiCall } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { checkNewNotifications } = useDesktopNotifications();

  const handleLogout = async () => {
    await logout();
  };

  // Carica notifiche
  const loadNotifications = async () => {
    try {
      const response = await apiCall('/api/notifications?limit=10&unread_only=false');
      if (response.ok) {
        const data = await response.json();
        // Controlla nuove notifiche per mostrare notifiche desktop
        checkNewNotifications(data);
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      } else if (response.status === 401) {
        // Token scaduto, fai logout automatico
        logout();
        window.location.href = '/login';
      } else {
        // Log altri errori HTTP per debug
        console.warn('⚠️ Failed to load notifications:', response.status, response.statusText);
      }
    } catch (error) {
      // Gestisci errori di rete in modo più dettagliato
      if (error instanceof TypeError && error.message.includes('Load failed')) {
        console.warn('⚠️ Network error loading notifications (possibly CORS or connection issue):', error.message);
        // Non bloccare l'app per errori di rete temporanei
        // Le notifiche verranno ricaricate al prossimo intervallo
      } else {
        console.error('❌ Error loading notifications:', error);
      }
    }
  };

  // Marca notifica come letta
  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Naviga alla pagina corretta basata sul tipo di richiesta
    if (notification.request_id && notification.request_type) {
      switch (notification.request_type) {
        case 'permission':
          navigate('/permessi');
          break;
        case 'vacation':
          navigate('/ferie');
          break;
        case 'sick':
          navigate('/malattia');
          break;
        default:
          navigate('/dashboard');
      }
    }
    
    setNotificationsOpen(false);
  };

  // Marca notifica come letta
  const markAsRead = async (notificationId) => {
    try {
      const response = await apiCall(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else if (response.status === 401) {
        // Token scaduto, fai logout automatico
        logout();
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Carica notifiche al mount e ogni 30 secondi
  React.useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000); // Aggiorna ogni 30 secondi
      return () => clearInterval(interval);
    }
  }, [user, checkNewNotifications]);

  // Funzione per tradurre i ruoli in italiano
  const getRoleDisplay = (role) => {
    const roleTranslations = {
      'admin': 'Amministratore',
      'employee': 'Dipendente',
      'manager': 'Manager',
      'hr': 'Risorse Umane'
    };
    return roleTranslations[role] || role;
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Profilo', href: '/profilo', icon: User, hideForAdmin: true },
    { name: 'Dipendenti', href: '/dipendenti', icon: Users, roles: ['admin', 'supervisor'] },
    { name: 'Presenze', href: (user?.role === 'admin' || user?.role === 'supervisor') ? '/admin-attendance' : '/presenze', icon: Clock },
    { name: 'Banca Ore', href: '/banca-ore', icon: DollarSign, showIf: (u) => u?.role !== 'admin' && u?.role !== 'supervisor' },
    { name: 'Recuperi Ore', href: '/recuperi-ore', icon: RefreshCw },
    { name: 'Permessi', href: '/permessi', icon: FileText },
    { name: 'Permessi 104', href: '/permessi-104', icon: Accessibility, showIf: (u) => u?.has_104 === true || u?.role === 'admin' },
    { name: 'Malattia', href: '/malattia', icon: Heart },
    { name: 'Ferie', href: '/ferie', icon: Plane },
    { name: 'Impostazioni', href: '/impostazioni', icon: Settings },
  ];

  const filteredNavigation = navigation.filter(item => {
    // Nascondi profilo per admin e supervisori
    if (item.hideForAdmin && (user?.role === 'admin' || user?.role === 'supervisor')) {
      return false;
    }
    
    // Controlla ruoli specifici
    if (item.roles && user) {
      return item.roles.includes(user.role);
    }
    
    // Controlla condizione showIf
    if (item.showIf && user) {
      return item.showIf(user);
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col flex-grow bg-slate-800 border-r border-slate-700 shadow-xl">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-6 py-4">
            <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center p-1">
              <img src="/logoSito.svg" alt="LABA Logo" className="h-6 w-6" />
            </div>
            <h1 className="ml-3 text-xl font-bold text-white">Presenze LABA</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {filteredNavigation.map((item) => {
              const IconComponent = item.icon;
              const isActive = location.pathname === item.href.split('#')[0]; // Ignora hash per active state
              const handleClick = (e) => {
                // Se il link contiene hash e siamo già sulla stessa pagina, gestisci lo scroll manualmente
                if (item.href.includes('#') && location.pathname === item.href.split('#')[0]) {
                  e.preventDefault();
                  const hash = item.href.split('#')[1];
                  window.location.hash = hash;
                  // Forza scroll dopo un breve delay
                  setTimeout(() => {
                    const element = document.getElementById(hash);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }
              };
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleClick}
                  className={`group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center">
                    <IconComponent className="mr-3 h-5 w-5" />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="flex-shrink-0 p-4 border-t border-slate-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {user?.role === 'admin' ? 'HR' : `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`}
                  </span>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">
                  {user?.role === 'admin' ? 'HR LABA' : `${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
                </p>
                <p className="text-xs text-slate-400">
                  {getRoleDisplay(user?.role)}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay - Full width su mobile piccolo, max-w-xs su mobile grande */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col w-full sm:max-w-xs bg-slate-800 transform transition-transform duration-300 ease-in-out">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center p-1">
                  <img src="/logoSito.svg" alt="LABA Logo" className="h-6 w-6" />
                </div>
                <h1 className="ml-3 text-xl font-bold text-white">Presenze LABA</h1>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                {filteredNavigation.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = location.pathname === item.href.split('#')[0]; // Ignora hash per active state
                  const handleClick = (e) => {
                    // Se il link contiene hash e siamo già sulla stessa pagina, gestisci lo scroll manualmente
                    if (item.href.includes('#') && location.pathname === item.href.split('#')[0]) {
                      e.preventDefault();
                      const hash = item.href.split('#')[1];
                      window.location.hash = hash;
                      // Forza scroll dopo un breve delay
                      setTimeout(() => {
                        const element = document.getElementById(hash);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }, 100);
                    }
                    // Chiudi sidebar mobile dopo click
                    setSidebarOpen(false);
                  };
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center justify-between px-2 py-2 text-base font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <div className="flex items-center">
                        <IconComponent className="mr-4 h-6 w-6" />
                        {item.name}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-14 sm:h-16 bg-slate-800 border-b border-slate-700 shadow-lg">
          <button
            className="px-3 sm:px-4 py-3 border-r border-slate-700 text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setSidebarOpen(true)}
            aria-label="Apri menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <div className="relative w-full max-w-lg">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <span className="sr-only">Search</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6">
              <div className="relative">
                <button 
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="bg-slate-800 p-2 sm:p-1 rounded-full text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white relative touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={`Notifiche${unreadCount > 0 ? ` (${unreadCount} non lette)` : ''}`}
                >
                  <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400">
                      <span className="sr-only">{unreadCount} notifiche non lette</span>
                    </span>
                  )}
                </button>
                
                {/* Sidebar Notifiche */}
                {notificationsOpen && (
                  <>
                    {/* Overlay */}
                    <div 
                      className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
                      onClick={() => setNotificationsOpen(false)}
                    />
                    
                    {/* Sidebar - Responsive: full width su mobile, w-96 su desktop */}
                    <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-slate-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
                      <div className="flex flex-col h-full">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-700">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white flex items-center">
                              <Bell className="h-6 w-6 mr-3 text-blue-400" />
                              Notifiche
                            </h3>
                            <button
                              onClick={() => setNotificationsOpen(false)}
                              className="text-slate-400 hover:text-white transition-colors duration-200"
                            >
                              <X className="h-6 w-6" />
                            </button>
                          </div>
                          {unreadCount > 0 && (
                            <p className="text-sm text-blue-400 mt-2">
                              {unreadCount} notifiche non lette
                            </p>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                              <Bell className="h-16 w-16 text-slate-600 mb-4" />
                              <h4 className="text-lg font-medium text-slate-300 mb-2">
                                Nessuna notifica
                              </h4>
                              <p className="text-sm text-slate-500">
                                Non hai ancora ricevuto notifiche
                              </p>
                            </div>
                          ) : (
                            <div className="p-4 space-y-3">
                              {notifications.map((notification, index) => (
                                <div
                                  key={notification.id}
                                  onClick={() => handleNotificationClick(notification)}
                                  className={`p-4 rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 ${
                                    (() => {
                                      // Mantieni sempre i colori, opacità leggermente inferiore se letta
                                      const opacity = notification.is_read ? '20' : '30';
                                      const borderOpacity = notification.is_read ? '30' : '50';
                                      const shadow = notification.is_read ? '' : 'shadow-lg';
                                      
                                      // Determina il colore basandosi sul type o sul contenuto del titolo/messaggio
                                      const title = (notification.title || '').toLowerCase();
                                      const message = (notification.message || '').toLowerCase();
                                      const type = notification.type || '';
                                      
                                      // Verifica se è approvata
                                      if (type === 'leave_approved' || title.includes('approvata') || message.includes('approvata')) {
                                        return `bg-green-900/${opacity} border border-green-500/${borderOpacity} ${shadow}`;
                                      }
                                      
                                      // Verifica se è rifiutata
                                      if (type === 'leave_rejected' || title.includes('rifiutata') || message.includes('rifiutata')) {
                                        return `bg-red-900/${opacity} border border-red-500/${borderOpacity} ${shadow}`;
                                      }
                                      
                                      // Default: blu
                                      return `bg-blue-900/${opacity} border border-blue-500/${borderOpacity} ${shadow}`;
                                    })()
                                  }`}
                                  style={{
                                    animationDelay: `${index * 50}ms`,
                                    animation: 'slideInRight 0.3s ease-out forwards'
                                  }}
                                >
                                  <div className="flex items-start space-x-3">
                                    <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                                      (() => {
                                        // Determina il colore basandosi sul type o sul contenuto del titolo/messaggio
                                        const title = (notification.title || '').toLowerCase();
                                        const message = (notification.message || '').toLowerCase();
                                        const type = notification.type || '';
                                        
                                        // Verifica se è approvata
                                        if (type === 'leave_approved' || title.includes('approvata') || message.includes('approvata')) {
                                          return 'bg-green-400';
                                        }
                                        
                                        // Verifica se è rifiutata
                                        if (type === 'leave_rejected' || title.includes('rifiutata') || message.includes('rifiutata')) {
                                          return 'bg-red-400';
                                        }
                                        
                                        // Default: blu
                                        return 'bg-blue-400';
                                      })()
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-white mb-1">
                                        {notification.title}
                                      </p>
                                      <p className="text-sm text-slate-300 mb-2" dangerouslySetInnerHTML={{
                                        __html: (() => {
                                          let msg = notification.message;
                                          // Formatta date in formato anglosassone (YYYY-MM-DD) in italiano
                                          // Parse as local time to avoid UTC timezone issues
                                          msg = msg.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match, year, month, day) => {
                                            // Parse as local date (year, month-1, day) to avoid UTC issues
                                            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                            return date.toLocaleDateString('it-IT', { 
                                              day: '2-digit', 
                                              month: 'long', 
                                              year: 'numeric',
                                              timeZone: 'Europe/Rome'
                                            });
                                          });
                                          // Metti in bold i nomi (Nome Cognome)
                                          msg = msg.replace(
                                            /(\b[A-Z][a-z]+ [A-Z][a-z]+\b)/g,
                                            '<strong class="font-bold text-white">$1</strong>'
                                          );
                                          return msg;
                                        })()
                                      }} />
                                      <p className="text-xs text-slate-500">
                                        {new Date(notification.created_at).toLocaleDateString('it-IT', {
                                          day: '2-digit',
                                          month: 'long',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          timeZone: 'Europe/Rome'
                                        })}
                                        {notification.request_id && (
                                          <span className="ml-2 text-blue-400 text-xs">
                                            Clicca per vedere la richiesta →
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-700">
                          <button
                            onClick={() => setNotificationsOpen(false)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                          >
                            Chiudi
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content - Responsive padding per mobile */}
        <main className="flex-1 overflow-x-hidden">
          <div className="py-2 sm:py-4 md:py-6 px-2 sm:px-3 md:px-4 lg:px-6">
            <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;