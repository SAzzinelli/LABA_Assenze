import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Users, 
  Clock, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  User
} from 'lucide-react';

const EmailManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [emailType, setEmailType] = useState('attendance');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [personalEmail, setPersonalEmail] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const sendEmail = async () => {
    if (!selectedEmployee) {
      setResult({ type: 'error', message: 'Seleziona un dipendente' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/email/reminder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: emailType,
          userId: selectedEmployee,
          customMessage: emailType === 'custom' ? customMessage : undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult({ type: 'success', message: data.message });
        setCustomMessage('');
      } else {
        setResult({ type: 'error', message: data.error || 'Errore nell\'invio' });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setResult({ type: 'error', message: 'Errore di connessione' });
    } finally {
      setLoading(false);
    }
  };

  const sendWeeklyReport = async () => {
    if (!selectedEmployee) {
      setResult({ type: 'error', message: 'Seleziona un dipendente' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/email/weekly-report', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedEmployee,
          weekNumber: new Date().getWeek()
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult({ type: 'success', message: data.message });
      } else {
        setResult({ type: 'error', message: data.error || 'Errore nell\'invio' });
      }
    } catch (error) {
      console.error('Error sending weekly report:', error);
      setResult({ type: 'error', message: 'Errore di connessione' });
    } finally {
      setLoading(false);
    }
  };

  const updatePersonalEmail = async () => {
    if (!selectedEmployee || !personalEmail) {
      setResult({ type: 'error', message: 'Seleziona un dipendente e inserisci un\'email' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/employees/${selectedEmployee}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalEmail: personalEmail
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult({ type: 'success', message: 'Email personale aggiornata con successo' });
        setPersonalEmail('');
        setShowEmailConfig(false);
        fetchEmployees(); // Ricarica la lista dipendenti
      } else {
        setResult({ type: 'error', message: data.error || 'Errore nell\'aggiornamento' });
      }
    } catch (error) {
      console.error('Error updating personal email:', error);
      setResult({ type: 'error', message: 'Errore di connessione' });
    } finally {
      setLoading(false);
    }
  };

  const selectedEmployeeData = employees.find(emp => emp.id === selectedEmployee);

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center">
            <Mail className="h-8 w-8 mr-3 text-blue-400" />
            Gestione Email
          </h1>
          <p className="text-slate-400 mt-2">
            Invia promemoria e report via email ai dipendenti
          </p>
        </div>

        {/* Configurazione Email Personali */}
        <div className="mb-8 bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white flex items-center mb-4">
            <User className="h-5 w-5 mr-2 text-purple-400" />
            Configurazione Email Personali
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Dipendente
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(e.target.value);
                  const emp = employees.find(emp => emp.id === e.target.value);
                  setPersonalEmail(emp?.personalEmail || '');
                }}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona un dipendente</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} - {emp.department}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Personale
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="esempio@gmail.com"
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={updatePersonalEmail}
                  disabled={loading || !selectedEmployee || !personalEmail}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Salva'
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {selectedEmployeeData && (
            <div className="mt-4 bg-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-2">Email Configurate</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email Aziendale:</span>
                  <span className="text-white">{selectedEmployeeData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email Personale:</span>
                  <span className="text-white">
                    {selectedEmployeeData.personalEmail || 'Non configurata'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email per Notifiche:</span>
                  <span className="text-green-400">
                    {selectedEmployeeData.personalEmail || selectedEmployeeData.email}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Email Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Promemoria Email */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white flex items-center mb-4">
              <Clock className="h-5 w-5 mr-2 text-orange-400" />
              Promemoria Email
            </h2>

            <div className="space-y-4">
              {/* Selezione Dipendente */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Dipendente
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona un dipendente</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} - {emp.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tipo Promemoria
                </label>
                <select
                  value={emailType}
                  onChange={(e) => setEmailType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="attendance">Promemoria Timbratura</option>
                  <option value="custom">Messaggio Personalizzato</option>
                </select>
              </div>

              {/* Messaggio Personalizzato */}
              {emailType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Messaggio
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Inserisci il messaggio personalizzato..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Anteprima Dipendente */}
              {selectedEmployeeData && (
                <div className="bg-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Anteprima</h3>
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-blue-400" />
                    <span className="text-white">
                      {selectedEmployeeData.firstName} {selectedEmployeeData.lastName}
                    </span>
                    <span className="text-slate-400 text-sm">
                      ({selectedEmployeeData.department})
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">
                    Email: {selectedEmployeeData.email || 'Non configurata'}
                  </p>
                </div>
              )}

              {/* Pulsante Invia */}
              <button
                onClick={sendEmail}
                disabled={loading || !selectedEmployee}
                className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Invia Promemoria
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Report Settimanale */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white flex items-center mb-4">
              <FileText className="h-5 w-5 mr-2 text-green-400" />
              Report Settimanale
            </h2>

            <div className="space-y-4">
              {/* Selezione Dipendente */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Dipendente
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona un dipendente</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} - {emp.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Info Report */}
              <div className="bg-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Report Include</h3>
                <ul className="text-slate-400 text-sm space-y-1">
                  <li>• Ore lavorate settimanali</li>
                  <li>• Giorni di presenza</li>
                  <li>• Ore straordinario</li>
                  <li>• Saldo ore</li>
                  <li>• Link ai dettagli completi</li>
                </ul>
              </div>

              {/* Pulsante Invia Report */}
              <button
                onClick={sendWeeklyReport}
                disabled={loading || !selectedEmployee}
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Invia Report Settimanale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Risultato */}
        {result && (
          <div className={`mt-6 p-4 rounded-lg flex items-center ${
            result.type === 'success' 
              ? 'bg-green-500/20 border border-green-400/30 text-green-300' 
              : 'bg-red-500/20 border border-red-400/30 text-red-300'
          }`}>
            {result.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {result.message}
          </div>
        )}

        {/* Info Email */}
        <div className="mt-8 bg-slate-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white flex items-center mb-4">
            <Mail className="h-5 w-5 mr-2 text-blue-400" />
            Informazioni Sistema Email
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <h4 className="font-medium text-white mb-2">Email Automatiche</h4>
              <ul className="space-y-1">
                <li>• Notifiche nuove richieste → Admin</li>
                <li>• Risposte approvazione → Dipendenti</li>
                <li>• Promemoria timbratura → Dipendenti</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Email Manuali</h4>
              <ul className="space-y-1">
                <li>• Promemoria personalizzati</li>
                <li>• Report settimanali</li>
                <li>• Comunicazioni urgenti</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailManagement;
