import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../utils/store';
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
  DollarSign
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout, apiCall } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
  };

  // Carica notifiche
  const loadNotifications = async () => {
    try {
      const response = await apiCall('/api/notifications?limit=10&unread_only=false');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      } else if (response.status === 401) {
        // Token scaduto, fai logout automatico
        logout();
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
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
  }, [user]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Profilo', href: '/profile', icon: User, hideForAdmin: true },
    { name: 'Dipendenti', href: '/employees', icon: Users, roles: ['admin'] },
    { name: 'Presenze', href: user?.role === 'admin' ? '/admin-attendance' : '/attendance', icon: Clock },
    { name: 'Permessi', href: '/leave-requests', icon: FileText },
    { name: 'Malattia', href: '/sick-leave', icon: Heart },
    { name: 'Ferie', href: '/vacation', icon: Plane },
,
    { name: 'Impostazioni', href: '/settings', icon: Settings },
  ];

  const filteredNavigation = navigation.filter(item => {
    // Nascondi profilo per admin
    if (item.hideForAdmin && user?.role === 'admin') {
      return false;
    }
    
    // Controlla ruoli specifici
    if (item.roles && user) {
      return item.roles.includes(user.role);
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow bg-slate-800 border-r border-slate-700">
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
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <IconComponent className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="flex-shrink-0 p-4 border-t border-slate-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-sm">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-400 capitalize">
                  {user?.role?.replace('_', ' ')}
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

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-800">
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
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <IconComponent className="mr-4 h-6 w-6" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-slate-800 border-b border-slate-700">
          <button
            className="px-4 border-r border-slate-700 text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
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
                  className="bg-slate-800 p-1 rounded-full text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white relative"
                >
                  <Bell className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400">
                      <span className="sr-only">{unreadCount} notifiche non lette</span>
                    </span>
                  )}
                </button>
                
                {/* Dropdown notifiche */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Notifiche</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          Nessuna notifica
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => {
                              if (!notification.is_read) {
                                markAsRead(notification.id);
                              }
                            }}
                            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                              !notification.is_read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start">
                              <div className={`w-2 h-2 rounded-full mt-2 mr-3 ${
                                !notification.is_read ? 'bg-blue-500' : 'bg-gray-300'
                              }`} />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(notification.created_at).toLocaleDateString('it-IT', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-2 border-t border-gray-200">
                      <button 
                        onClick={() => setNotificationsOpen(false)}
                        className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
                      >
                        Chiudi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;