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
  ChevronLeft,
  Sparkles
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, color: 'from-blue-500 to-cyan-500' },
    { name: 'Dipendenti', href: '/employees', icon: Users, color: 'from-purple-500 to-pink-500' },
    { name: 'Presenze', href: '/attendance', icon: Clock, color: 'from-emerald-500 to-teal-500' },
    { name: 'Richieste Permessi', href: '/leave-requests', icon: FileText, color: 'from-amber-500 to-orange-500' },
    { name: 'Profilo', href: '/profile', icon: User, color: 'from-indigo-500 to-purple-500' },
    { name: 'Impostazioni', href: '/settings', icon: Settings, color: 'from-slate-500 to-gray-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full glass">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Presenze LABA
                  </h1>
                </div>
              </div>
              <nav className="mt-8 px-2 space-y-2">
                {navigation.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : ''}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <span className="ml-3 font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex lg:flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-72'}`}>
        <div className="flex flex-col w-full">
          <div className="flex flex-col h-0 flex-1 glass">
            <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
              {/* Logo */}
              <div className="flex items-center px-4 mb-8">
                <div className="h-10 w-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center animate-float">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                {!sidebarCollapsed && (
                  <h1 className="ml-3 text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Presenze LABA
                  </h1>
                )}
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-3 space-y-2">
                {navigation.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`nav-item ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center' : ''}`}
                      title={sidebarCollapsed ? item.name : ''}
                    >
                      <div className={`p-2 rounded-xl ${isActive ? 'bg-white/20 shadow-lg' : ''}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      {!sidebarCollapsed && <span className="ml-3 font-medium">{item.name}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            {/* User profile at bottom */}
            <div className="flex-shrink-0 border-t border-slate-700/50 p-4">
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </div>
                </div>
                {!sidebarCollapsed && (
                  <>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-semibold text-slate-100">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {user?.role?.replace('_', ' ')}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="ml-2 p-2 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex flex-col flex-1 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'}`}>
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex-shrink-0 flex h-16 glass border-b border-slate-700/50">
          <button
            className="px-4 border-r border-slate-700/50 text-slate-400 hover:text-slate-300 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <button
            className="hidden lg:flex px-4 border-r border-slate-700/50 text-slate-400 hover:text-slate-300 transition-colors"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft className={`h-5 w-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
          
          <div className="flex-1 px-6 flex justify-between items-center">
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <div className="relative w-full max-w-lg">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <span className="sr-only">Search</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ml-4 flex items-center space-x-4">
              {/* Notifications */}
              <button className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;