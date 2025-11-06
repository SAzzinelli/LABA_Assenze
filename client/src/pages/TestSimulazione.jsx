import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../utils/store';
import { Clock, Calendar, User, Settings, TestTube, CheckCircle, XCircle, AlertCircle, Play, Square } from 'lucide-react';

const TestSimulazione = () => {
  const { user, apiCall } = useAuthStore();
  const [testMode, setTestMode] = useState(false);
  const [simulatedDate, setSimulatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [simulatedTime, setSimulatedTime] = useState(new Date().toTimeString().substring(0, 5));
  const [testData, setTestData] = useState({
    attendance: null,
    hours: null,
    balance: null,
    permissions: null,
    permission104: null,
    dashboard: null
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Salva la modalità test nel localStorage
  useEffect(() => {
    const saved = localStorage.getItem('testMode');
    if (saved === 'true') {
      setTestMode(true);
      const savedDate = localStorage.getItem('simulatedDate');
      const savedTime = localStorage.getItem('simulatedTime');
      if (savedDate) setSimulatedDate(savedDate);
      if (savedTime) setSimulatedTime(savedTime);
    }
  }, []);

  // Carica modalità test dal database
  useEffect(() => {
    const loadTestMode = async () => {
      try {
        const response = await apiCall('/api/test-mode');
        if (response.ok) {
          const data = await response.json();
          if (data.active) {
            setTestMode(true);
            setSimulatedDate(data.date);
            setSimulatedTime(data.time);
            // Salva anche in localStorage per compatibilità
            localStorage.setItem('testMode', 'true');
            localStorage.setItem('simulatedDate', data.date);
            localStorage.setItem('simulatedTime', data.time);
          }
        }
      } catch (error) {
        console.error('Error loading test mode:', error);
      }
    };
    loadTestMode();
  }, []);

  // Salva modalità test nel database quando cambia
  useEffect(() => {
    const saveTestMode = async () => {
      try {
        const response = await apiCall('/api/test-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active: testMode,
            date: testMode ? simulatedDate : null,
            time: testMode ? simulatedTime : null
          })
        });
        
        if (response.ok) {
          // Salva anche in localStorage per compatibilità
          if (testMode) {
            localStorage.setItem('testMode', 'true');
            localStorage.setItem('simulatedDate', simulatedDate);
            localStorage.setItem('simulatedTime', simulatedTime);
          } else {
            localStorage.removeItem('testMode');
            localStorage.removeItem('simulatedDate');
            localStorage.removeItem('simulatedTime');
          }
          console.log('✅ Test mode salvata nel database');
        }
      } catch (error) {
        console.error('Error saving test mode:', error);
      }
    };
    
    // Salva solo se i valori sono stati impostati (evita salvataggi iniziali)
    if (simulatedDate && simulatedTime) {
      saveTestMode();
    }
  }, [testMode, simulatedDate, simulatedTime]);

  const runFullTest = async () => {
    setLoading(true);
    try {
      // Test tutte le funzionalità
      const [hoursRes, balanceRes, attendanceRes, permissionsRes, permission104Res] = await Promise.all([
        apiCall(`/api/attendance/test-hours?time=${simulatedTime}&date=${simulatedDate}`),
        apiCall(`/api/attendance/hours-balance?year=${new Date(simulatedDate).getFullYear()}&month=${new Date(simulatedDate).getMonth() + 1}&testDate=${simulatedDate}&testTime=${simulatedTime}`),
        apiCall(`/api/attendance?testDate=${simulatedDate}&testTime=${simulatedTime}`),
        apiCall(`/api/leave-requests?type=permission&testDate=${simulatedDate}&testTime=${simulatedTime}`),
        apiCall(`/api/leave-requests?type=permission_104&testDate=${simulatedDate}&testTime=${simulatedTime}`)
      ]);

      setTestData({
        hours: hoursRes.ok ? await hoursRes.json() : null,
        balance: balanceRes.ok ? await balanceRes.json() : null,
        attendance: attendanceRes.ok ? await attendanceRes.json() : null,
        permissions: permissionsRes.ok ? await permissionsRes.json() : null,
        permission104: permission104Res.ok ? await permission104Res.json() : null
      });
    } catch (error) {
      console.error('Test error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours) => {
    if (!hours && hours !== 0) return '--';
    const h = Math.floor(Math.abs(hours));
    const m = Math.round((Math.abs(hours) - h) * 60);
    return `${hours < 0 ? '-' : ''}${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <TestTube className="h-8 w-8 mr-3 text-indigo-400" />
                Test & Simulazione
              </h1>
              <p className="text-slate-400">
                Simula date e orari per testare tutte le funzionalità del sistema
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-lg font-medium ${testMode ? 'bg-green-600' : 'bg-slate-700'}`}>
                {testMode ? (
                  <span className="flex items-center">
                    <Play className="h-4 w-4 mr-2" />
                    Modalità Test ATTIVA
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Square className="h-4 w-4 mr-2" />
                    Modalità Test DISATTIVATA
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Test Mode Toggle */}
          <div className="bg-slate-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center">
                <Settings className="h-5 w-5 mr-2 text-indigo-400" />
                Configurazione Test
              </h2>
              <button
                onClick={() => setTestMode(!testMode)}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  testMode
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {testMode ? 'Disattiva Test Mode' : 'Attiva Test Mode'}
              </button>
            </div>

            {testMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Data Simulata
                  </label>
                  <input
                    type="date"
                    value={simulatedDate}
                    onChange={(e) => setSimulatedDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Clock className="h-4 w-4 inline mr-2" />
                    Orario Simulato
                  </label>
                  <input
                    type="time"
                    value={simulatedTime}
                    onChange={(e) => setSimulatedTime(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {testMode && (
              <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-300 text-sm flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Modalità Test Attiva:</strong> Tutti i calcoli e le visualizzazioni useranno la data e l'orario simulati. 
                    I dati di test non vengono salvati nel database reale.
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-slate-800 rounded-lg overflow-hidden mb-6">
          <div className="p-6">
            <div className="space-y-6">
              <div className="space-y-6">
                <div className="bg-slate-700 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-4">Modalità Test Globale</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Quando la modalità test è attiva, tutti i dati creati nelle sezioni normali (Presenze, Permessi, Malattie, 104) vengono salvati in tabelle di test separate e non influiscono sui dati reali.
                  </p>
                  
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                    <p className="text-yellow-300 text-sm">
                      <strong>Come funziona:</strong>
                    </p>
                    <ul className="text-yellow-200 text-sm mt-2 space-y-1 list-disc list-inside">
                      <li>Attiva la modalità test con data e ora simulate</li>
                      <li>Vai nelle sezioni normali (Presenze, Permessi, Malattie, 104)</li>
                      <li>Crea i dati normalmente - verranno salvati come dati di test</li>
                      <li>L'admin può approvare/rifiutare le richieste come in modalità normale</li>
                      <li>Quando disattivi la modalità test, i dati di test non vengono più mostrati</li>
                    </ul>
                  </div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Test Completo Sistema</h3>
                    <button
                      onClick={runFullTest}
                      disabled={loading || !testMode}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                    >
                      {loading ? 'Test in corso...' : 'Esegui Test Completo'}
                    </button>
                  </div>
                </div>

                {testData.hours && (
                  <div className="bg-slate-700 rounded-lg p-6 mt-6">
                    <h4 className="text-lg font-bold mb-4">Risultati Test</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Ore Attese</p>
                        <p className="text-2xl font-bold text-white">{testData.hours.expectedHours}h</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Ore Lavorate</p>
                        <p className="text-2xl font-bold text-blue-400">{testData.hours.actualHours?.toFixed(1) || 0}h</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Saldo</p>
                        <p className={`text-2xl font-bold ${testData.hours.balanceHours >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatHours(testData.hours.balanceHours)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestSimulazione;

