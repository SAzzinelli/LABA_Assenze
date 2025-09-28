import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/store';
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuthStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    department: '',
    phone: '',
    birthDate: '',
    has104: false
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const result = await login(formData.email, formData.password);
        if (result.success) {
          navigate('/dashboard');
        } else {
          setError(result.error);
        }
      } else {
        const result = await register(formData);
        if (result.success) {
          setError('');
          setIsLogin(true);
          // Show success message
          alert('Registrazione completata! Ora puoi effettuare il login.');
        } else {
          setError(result.error);
        }
      }
    } catch (error) {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const departments = [
    'Amministrazione',
    'Segreteria', 
    'Orientamento',
    'Reparto IT'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl mb-4 animate-float">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Presenze LABA
          </h1>
          <p className="text-slate-400 mt-2">Sistema HR per la gestione delle presenze</p>
        </div>

        {/* Form Card */}
        <div className="glass-card p-8 rounded-3xl">
          {/* Toggle Login/Register */}
          <div className="flex mb-6 bg-slate-800/50 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                isLogin 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                !isLogin 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Registrati
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Login Form */}
            {isLogin ? (
              <>
                <div>
                  <label className="form-label">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="form-input pl-10"
                      placeholder="admin@laba.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="form-input pl-10 pr-10"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Register Form */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nome *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Cognome *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="form-input pl-10"
                      placeholder="nome@labafirenze.com"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Solo email @labafirenze.com</p>
                </div>

                <div>
                  <label className="form-label">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="form-input pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Dipartimento *</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="form-select"
                    required
                  >
                    <option value="">Seleziona dipartimento</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Telefono</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Data di Nascita</label>
                    <input
                      type="date"
                      name="birthDate"
                      value={formData.birthDate}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="has104"
                    name="has104"
                    checked={formData.has104}
                    onChange={handleInputChange}
                    className="mr-3 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="has104" className="form-label mb-0">
                    Ha diritto alla Legge 104
                  </label>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mt-6"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isLogin ? 'Accesso in corso...' : 'Registrazione...'}
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  {isLogin ? 'Accedi' : 'Registrati'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          {isLogin && (
            <div className="mt-6 p-4 bg-slate-800/50 rounded-xl">
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Credenziali Demo:</h4>
              <div className="text-xs text-slate-400 space-y-1">
                <p><strong>Admin:</strong> admin@laba.com / admin123</p>
                <p><strong>Dipendente:</strong> Registrati con email @labafirenze.com</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;