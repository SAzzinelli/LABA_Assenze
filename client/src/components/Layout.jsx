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
  RefreshCw,
  Eye,
  EyeOff
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

  // Marca notifica come non letta
  const markAsUnread = async (notificationId) => {
    try {
      const response = await apiCall(`/api/notifications/${notificationId}/unread`, {
        method: 'PUT'
      });
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: false } : n)
        );
        setUnreadCount(prev => prev + 1);
      } else if (response.status === 401) {
        // Token scaduto, fai logout automatico
        logout();
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error marking notification as unread:', error);
    }
  };

  // Marca tutte le notifiche come lette
  const markAllAsRead = async () => {
    try {
      const response = await apiCall('/api/notifications/read-all', {
        method: 'PUT'
      });
      if (response.ok) {
        // Aggiorna tutte le notifiche come lette
        setNotifications(prev => 
          prev.map(n => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
      } else if (response.status === 401) {
        // Token scaduto, fai logout automatico
        logout();
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Carica notifiche al mount e ogni 30 secondi
  // Usa useRef per evitare che loadNotifications cambi ad ogni render
  const loadNotificationsRef = React.useRef(null);
  loadNotificationsRef.current = React.useCallback(async () => {
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
  }, [apiCall, checkNewNotifications, logout]);

  React.useEffect(() => {
    if (user) {
      // Carica immediatamente
      loadNotificationsRef.current();
      // Poi ogni 30 secondi
      const interval = setInterval(() => {
        loadNotificationsRef.current();
      }, 30000); // Aggiorna ogni 30 secondi
      return () => clearInterval(interval);
    }
  }, [user]); // Solo user come dipendenza - loadNotificationsRef.current è sempre aggiornato

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
    { name: 'Banca Ore', href: '/banca-ore-admin', icon: DollarSign, roles: ['admin', 'supervisor'] },
    { name: 'Recuperi', href: '/recuperi-ore', icon: RefreshCw },
    { name: 'Permessi', href: '/permessi', icon: FileText },
    { name: 'Permessi 104', href: '/permessi-104', icon: Accessibility, showIf: (u) => (u?.has_104 === true || u?.has104 === true) || u?.role === 'admin' },
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
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col flex-grow bg-zinc-900 border-r border-zinc-800 shadow-xl">
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
                      ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-zinc-900 hover:text-white hover:shadow-md'
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
          <div className="flex-shrink-0 p-4 border-t border-zinc-900">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
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
                className="ml-2 p-1 rounded text-white hover:text-slate-200 hover:bg-zinc-800 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay - Full width su mobile piccolo, max-w-xs su mobile grande */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ease-in-out ${
        sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        <div 
          className="fixed inset-0 bg-black transition-opacity duration-300 ease-in-out"
          style={{ opacity: sidebarOpen ? 0.5 : 0 }}
          onClick={() => setSidebarOpen(false)}
        />
        <div className={`relative flex-1 flex flex-col w-full sm:max-w-xs bg-zinc-900 transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}>
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
                          ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white'
                          : 'text-slate-300 hover:bg-zinc-900 hover:text-white'
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
            
            {/* User Profile e Logout - Mobile */}
            <div className="flex-shrink-0 p-4 border-t border-zinc-900">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
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
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium touch-manipulation min-h-[44px]"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-14 sm:h-16 bg-zinc-900 border-b border-zinc-800 shadow-lg">
          <button
            className="px-3 sm:px-4 py-3 border-r border-zinc-900 text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-600 lg:hidden touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                  className="bg-black p-2 sm:p-1 rounded-full text-white hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-white relative touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
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
                    <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-zinc-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
                      <div className="flex flex-col h-full">
                        {/* Header */}
                        <div className="p-6 border-b border-zinc-900">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white flex items-center">
                              <Bell className="h-6 w-6 mr-3 text-slate-400" />
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
                            <p className="text-sm text-slate-400 mt-2">
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
                                  className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                                    notification.is_read 
                                      ? 'opacity-60 bg-zinc-800 border border-zinc-700' 
                                      : 'bg-zinc-800 border border-zinc-600 shadow-lg'
                                  }`}
                                  style={{
                                    animationDelay: `${index * 50}ms`,
                                    animation: 'slideInRight 0.3s ease-out forwards'
                                  }}
                                >
                                  <div className="flex items-start space-x-3">
                                    {!notification.is_read && (
                                      <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0 bg-slate-400" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between mb-1">
                                        <p className="text-sm font-semibold text-white">
                                          {notification.title}
                                        </p>
                                        <div className="flex items-center space-x-1 ml-2">
                                          {notification.is_read ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                markAsUnread(notification.id);
                                              }}
                                              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded transition-colors"
                                              title="Segna come non letta"
                                            >
                                              <EyeOff className="h-3.5 w-3.5" />
                                            </button>
                                          ) : (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                markAsRead(notification.id);
                                              }}
                                              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded transition-colors"
                                              title="Segna come letta"
                                            >
                                              <Eye className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-sm text-slate-300 mb-2 space-y-3" dangerouslySetInnerHTML={{
                                        __html: (() => {
                                          let msg = notification.message;
                                          
                                          // Per notifiche di modifica permesso, formatta in modo speciale
                                          if (notification.type === 'permission_modification_request') {
                                            // Prima formatta i nomi e le date
                                            msg = msg.replace(
                                              /(\b[A-Z][a-z]+ [A-Z][a-z]+\b)/g,
                                              '<strong class="font-bold text-white">$1</strong>'
                                            );
                                            
                                            msg = msg.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match, year, month, day) => {
                                              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                              return date.toLocaleDateString('it-IT', { 
                                                day: '2-digit', 
                                                month: 'long', 
                                                year: 'numeric',
                                                timeZone: 'Europe/Rome'
                                              });
                                            });
                                            
                                            // Dividi il messaggio in righe
                                            const lines = msg.split('\n');
                                            let html = '';
                                            let currentSection = null;
                                            
                                            lines.forEach((line, index) => {
                                              line = line.trim();
                                              if (!line) return; // Salta righe vuote
                                              
                                              // Rileva sezioni con emoji
                                              if (line.match(/^📅 .+:$/)) {
                                                currentSection = 'info';
                                                const title = line.replace(/^📅 (.+):$/, '$1');
                                                html += `<div class="mt-3 first:mt-0"><p class="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-2"><span>📅</span> ${title}</p>`;
                                              } else if (line.match(/^💬 .+:$/)) {
                                                currentSection = 'reason';
                                                const title = line.replace(/^💬 (.+):$/, '$1');
                                                html += `<div class="mt-3"><p class="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-2 flex items-center gap-2"><span>💬</span> ${title}</p>`;
                                              } else if (line.match(/^✏️ .+:$/)) {
                                                currentSection = 'changes';
                                                const title = line.replace(/^✏️ (.+):$/, '$1');
                                                html += `<div class="mt-3"><p class="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2 flex items-center gap-2"><span>✏️</span> ${title}</p>`;
                                              } else if (line.startsWith('   ')) {
                                                // Riga indentata (dettaglio di una sezione)
                                                const content = line.substring(3);
                                                html += `<p class="text-slate-300 ml-4 mb-1.5">${content}</p>`;
                                              } else {
                                                // Riga normale (testo principale)
                                                html += `<p class="text-slate-300 mb-1.5">${line}</p>`;
                                              }
                                            });
                                            
                                            // Chiudi eventuali sezioni aperte
                                            if (currentSection) {
                                              html += '</div>';
                                            }
                                            
                                            return html;
                                          }
                                          
                                          // Formattazione standard per altre notifiche
                                          msg = msg.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match, year, month, day) => {
                                            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                            return date.toLocaleDateString('it-IT', { 
                                              day: '2-digit', 
                                              month: 'long', 
                                              year: 'numeric',
                                              timeZone: 'Europe/Rome'
                                            });
                                          });
                                          msg = msg.replace(
                                            /(\b[A-Z][a-z]+ [A-Z][a-z]+\b)/g,
                                            '<strong class="font-bold text-white">$1</strong>'
                                          );
                                          msg = msg.replace(/\n/g, '<br>');
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
                                        }                                        )}
                                        {notification.request_id && (
                                          <span className="ml-2 text-slate-400 text-xs">
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
                        <div className="p-4 border-t border-slate-700 space-y-2">
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Leggi tutte ({unreadCount})
                            </button>
                          )}
                          <button
                            onClick={() => setNotificationsOpen(false)}
                            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
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