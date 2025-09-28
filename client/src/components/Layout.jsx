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
  Sparkles
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Dipendenti', href: '/employees', icon: Users, roles: ['admin'] },
    { name: 'Presenze', href: user?.role === 'admin' ? '/admin-attendance' : '/attendance', icon: Clock },
    { name: 'Richieste Permessi', href: '/leave-requests', icon: FileText },
    { name: 'Profilo', href: '/profile', icon: User },
    { name: 'Impostazioni', href: '/settings', icon: Settings },
  ];

  const filteredNavigation = navigation.filter(item => {
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
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
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
                <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
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
                <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
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
              <button className="bg-slate-800 p-1 rounded-full text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white relative">
                <Bell className="h-6 w-6" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
              </button>
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