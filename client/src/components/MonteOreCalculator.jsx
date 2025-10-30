import React from 'react';
import { Calculator, Clock, Users, Heart, Plane, AlertTriangle, Info, DollarSign, TrendingUp, TrendingDown, Activity, Calendar } from 'lucide-react';
import { useAuthStore } from '../utils/store';

const MonteOreCalculator = ({ user, workSchedule }) => {
  const { apiCall } = useAuthStore();
  const [leaveBalances, setLeaveBalances] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [balanceHistory, setBalanceHistory] = React.useState([]);
  const [currentBalance, setCurrentBalance] = React.useState(0);

  // Carica saldi ferie e banca ore dal database
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Carica balance totale
        if (user?.id) {
          const balanceResponse = await apiCall(`/api/attendance/total-balances?userIds=${user.id}`);
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            const balance = balanceData.balances[user.id] || 0;
            setCurrentBalance(balance);
          }
          
          // Carica history recente (ultimi 10 record)
          const historyResponse = await apiCall(`/api/attendance?userId=${user.id}&limit=10`);
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setBalanceHistory(historyData || []);
          }
        }
        
        // Carica saldi ferie
        const response = await apiCall('/api/leave-balances?year=2025');
        if (response.ok) {
          const data = await response.json();
          // Converti oggetto in array per compatibilità
          const balancesArray = [
            {
              leave_type: 'vacation',
              total_entitled: data.vacation?.total || 26,
              used: data.vacation?.used || 0,
              pending: data.vacation?.pending || 0,
              remaining: data.vacation?.remaining || 26
            },
            {
              leave_type: 'sick',
              total_entitled: data.sick?.total || 180,
              used: data.sick?.used || 0,
              pending: data.sick?.pending || 0,
              remaining: data.sick?.remaining || 180
            },
            {
              leave_type: 'permission',
              total_entitled: data.permission?.total || 104,
              used: data.permission?.used || 0,
              pending: data.permission?.pending || 0,
              remaining: data.permission?.remaining || 104
            }
          ];
          setLeaveBalances(balancesArray);
        } else {
          // Fallback a dati mock se API fallisce
          setLeaveBalances(getMockLeaveBalances());
        }
      } catch (error) {
        console.error('Error loading balances:', error);
        setLeaveBalances(getMockLeaveBalances());
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Dati mock per fallback
  const getMockLeaveBalances = () => {
    const currentYear = new Date().getFullYear();
    const hireYear = user?.hireDate ? new Date(user.hireDate).getFullYear() : currentYear;
    const yearsOfService = currentYear - hireYear;
    
    // Calcolo ferie base + bonus anzianità
    let vacationDays = 26; // Base italiana
    if (yearsOfService >= 10) vacationDays += 2;
    if (yearsOfService >= 15) vacationDays += 2;
    if (yearsOfService >= 20) vacationDays += 2;
    
    return [
      {
        leave_type: 'vacation',
        total_entitled: vacationDays,
        used: 5,
        pending: 2,
        remaining: vacationDays - 5 - 2
      },
      {
        leave_type: 'sick',
        total_entitled: 180, // Giorni malattia annui
        used: 3,
        pending: 0,
        remaining: 177
      },
      {
        leave_type: 'permission',
        total_entitled: 104, // Ore permessi annui
        used: 16,
        pending: 4,
        remaining: 84
      }
    ];
  };
  
  // Calcolo ore settimanali teoriche
  const calculateWeeklyHours = () => {
    let totalHours = 0;
    Object.values(workSchedule).forEach(day => {
      if (day.active) {
        let dayHours = 0;
        
        if (day.workType === 'morning' && day.morning) {
          const [start, end] = day.morning.split('-');
          dayHours += calculateHours(start, end);
        }
        
        if (day.workType === 'afternoon' && day.afternoon) {
          const [start, end] = day.afternoon.split('-');
          dayHours += calculateHours(start, end);
        }
        
        if (day.workType === 'full') {
          if (day.morning) {
            const [start, end] = day.morning.split('-');
            dayHours += calculateHours(start, end);
          }
          if (day.afternoon) {
            const [start, end] = day.afternoon.split('-');
            dayHours += calculateHours(start, end);
          }
          // NON sottrarre la pausa pranzo: è già esclusa dal calcolo mattina/pomeriggio
          // La pausa pranzo (13:00-14:00) è il gap tra mattina e pomeriggio
        }
        
        totalHours += dayHours;
      }
    });
    return totalHours;
  };

  const calculateHours = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return (endMinutes - startMinutes) / 60;
  };

  // Calcolo ferie annuali (in base al contratto italiano)
  const calculateAnnualVacation = () => {
    const baseDays = 26; // Minimo legale in Italia
    let bonusDays = 0;
    
    // Bonus per anzianità (esempio)
    const hireYear = user?.hireDate ? new Date(user.hireDate).getFullYear() : new Date().getFullYear();
    const yearsWorked = new Date().getFullYear() - hireYear;
    
    if (yearsWorked >= 10) bonusDays += 2;
    if (yearsWorked >= 15) bonusDays += 2;
    if (yearsWorked >= 20) bonusDays += 2;
    
    return baseDays + bonusDays;
  };

  // Calcolo permessi ROL (Recupero Ore Lavorate)
  const calculateROLHours = () => {
    const weeklyHours = calculateWeeklyHours();
    const standardWeeklyHours = 40; // Ore standard settimanali
    
    if (weeklyHours > standardWeeklyHours) {
      const extraHours = weeklyHours - standardWeeklyHours;
      const rolHours = Math.floor(extraHours * 52); // Ore annuali in più
      return Math.floor(rolHours / 8); // Converti in giorni (8 ore = 1 giorno)
    }
    
    return 0;
  };

  // Calcolo permessi malattia
  const calculateSickLeave = () => {
    // In Italia, malattia è retribuita al 100% per i primi 3 giorni, poi varia
    return {
      maxDaysPerYear: 180, // Massimo giorni malattia retribuiti
      first3Days: '100% retribuiti',
      after3Days: 'Retribuzione variabile per CCNL'
    };
  };

  // Calcolo permessi legge 104
  const calculate104Permissions = () => {
    if (!user?.has104) return null;
    
    return {
      monthlyHours: 3, // Ore mensili per assistenza
      annualHours: 36, // Ore annuali totali
      description: 'Permessi per assistenza familiare con handicap grave'
    };
  };

  // Calcolo ore di straordinario
  const calculateOvertime = () => {
    const weeklyHours = calculateWeeklyHours();
    const standardWeeklyHours = 40;
    
    if (weeklyHours > standardWeeklyHours) {
      return {
        weekly: weeklyHours - standardWeeklyHours,
        annual: Math.floor((weeklyHours - standardWeeklyHours) * 52),
        compensation: 'Retribuzione maggiorata o recupero ore'
      };
    }
    
    return { weekly: 0, annual: 0, compensation: 'Nessuno straordinario' };
  };

  const weeklyHours = calculateWeeklyHours();
  const annualVacation = calculateAnnualVacation();
  const rolHours = calculateROLHours();
  const sickLeave = calculateSickLeave();
  const permissions104 = calculate104Permissions();
  const overtime = calculateOvertime();

  return (
    <div className="space-y-6">
      {/* Banca Ore Attuale - In evidenza */}
      <div className="bg-slate-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-indigo-400" />
          Banca Ore Attuale
        </h4>
        <div className="flex items-center justify-center py-8">
          <div className={`text-6xl font-bold ${
            currentBalance > 0 
              ? 'text-green-400' 
              : currentBalance < 0 
                ? 'text-red-400' 
                : 'text-slate-400'
          }`}>
            {currentBalance > 0 ? '+' : ''}
            {Math.floor(currentBalance)}
            <span className="text-4xl">h</span>
            {Math.abs(Math.round((currentBalance % 1) * 60))}
            <span className="text-3xl">m</span>
          </div>
        </div>
        <div className="text-center mt-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            currentBalance > 0 
              ? 'bg-green-500/20 text-green-300 border border-green-400/30' 
              : currentBalance < 0 
                ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                : 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
          }`}>
            {currentBalance > 0 && <TrendingUp className="h-4 w-4 mr-1" />}
            {currentBalance < 0 && <TrendingDown className="h-4 w-4 mr-1" />}
            {currentBalance === 0 ? 'In pari' : currentBalance > 0 ? 'In credito' : 'In debito'}
          </span>
        </div>
      </div>

      {/* Ultime Fluttuazioni */}
      <div className="bg-slate-700 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-amber-400" />
          Ultime Fluttuazioni
        </h4>
        {balanceHistory.length > 0 ? (
          <div className="space-y-3">
            {balanceHistory.map((record, index) => (
              <div key={index} className="bg-slate-600 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-slate-400 mr-3" />
                  <div>
                    <p className="text-white font-medium">
                      {new Date(record.date).toLocaleDateString('it-IT', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                    <p className="text-slate-400 text-sm">
                      Ore attese: {Math.floor(record.expected_hours || 0)}h {Math.round(((record.expected_hours || 0) % 1) * 60)}m
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    record.balance_hours > 0 
                      ? 'text-green-400' 
                      : record.balance_hours < 0 
                        ? 'text-red-400' 
                        : 'text-slate-400'
                  }`}>
                    {record.balance_hours > 0 ? '+' : ''}
                    {Math.floor(record.balance_hours || 0)}h {Math.round(Math.abs(((record.balance_hours || 0) % 1) * 60))}m
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    Effettive: {Math.floor(record.actual_hours || 0)}h {Math.round(((record.actual_hours || 0) % 1) * 60)}m
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessuna fluttuazione registrata</p>
          </div>
        )}
      </div>

      {/* Calcoli e Dettagli */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center">
          <Calculator className="h-6 w-6 mr-3 text-indigo-400" />
          Calcoli e Dettagli
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ore Settimanali */}
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-white flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-400" />
              Ore Settimanali
            </h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-300">Ore teoriche:</span>
              <span className="text-white font-semibold">{weeklyHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Ore standard:</span>
              <span className="text-white font-semibold">40h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Differenza:</span>
              <span className={`font-semibold ${(weeklyHours - 40) > 0 ? 'text-yellow-400' : (weeklyHours - 40) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {(weeklyHours - 40) > 0 ? '+' : ''}{(weeklyHours - 40).toFixed(1)}h
              </span>
            </div>
          </div>
        </div>

        {/* Saldi Ferie/Permessi */}
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-white flex items-center">
              <Plane className="h-5 w-5 mr-2 text-green-400" />
              Saldi 2025
            </h4>
          </div>
          {loading ? (
            <div className="text-center text-slate-400">Caricamento saldi...</div>
          ) : (
            <div className="space-y-2">
              {(Array.isArray(leaveBalances) ? leaveBalances : []).map((balance) => {
                const typeLabels = {
                  vacation: 'Ferie',
                  sick: 'Malattia',
                  permission: 'Permessi'
                };
                const typeIcons = {
                  vacation: '✈️',
                  sick: '🏥',
                  permission: '⏰'
                };
                
                return (
                  <div key={balance.leave_type} className="border-b border-slate-600 pb-2 last:border-b-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-300 flex items-center">
                        {typeIcons[balance.leave_type]} {typeLabels[balance.leave_type]}
                      </span>
                      <span className="text-white font-semibold">
                        {balance.remaining} / {balance.total_entitled}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Usati: {balance.used}</span>
                      {balance.pending > 0 && <span>In attesa: {balance.pending}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Permessi ROL */}
        {rolHours > 0 && (
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-white flex items-center">
                <Clock className="h-5 w-5 mr-2 text-purple-400" />
                Permessi ROL
              </h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">Ore extra annuali:</span>
                <span className="text-white font-semibold">{overtime.annual}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Giorni ROL:</span>
                <span className="text-purple-400 font-bold">{rolHours} giorni</span>
              </div>
              <p className="text-slate-400 text-sm mt-2">
                {overtime.compensation}
              </p>
            </div>
          </div>
        )}

        {/* Malattia */}
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-white flex items-center">
              <Heart className="h-5 w-5 mr-2 text-red-400" />
              Permessi Malattia
            </h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-300">Max giorni/anno:</span>
              <span className="text-white font-semibold">{sickLeave.maxDaysPerYear}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Primi 3 giorni:</span>
              <span className="text-green-400 font-semibold">{sickLeave.first3Days}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Dopo 3 giorni:</span>
              <span className="text-yellow-400 font-semibold">{sickLeave.after3Days}</span>
            </div>
          </div>
        </div>

        {/* Legge 104 */}
        {permissions104 && (
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-white flex items-center">
                <Users className="h-5 w-5 mr-2 text-amber-400" />
                Legge 104
              </h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">Ore mensili:</span>
                <span className="text-white font-semibold">{permissions104.monthlyHours}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Ore annuali:</span>
                <span className="text-amber-400 font-bold">{permissions104.annualHours}h</span>
              </div>
              <p className="text-slate-400 text-sm mt-2">
                {permissions104.description}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Note Legali */}
      <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
          <div>
            <h5 className="text-blue-300 font-semibold mb-2">Note Legali</h5>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• I calcoli sono basati sulla normativa italiana vigente</li>
              <li>• Le ore di straordinario sono soggette a limiti legali</li>
              <li>• I permessi legge 104 sono cumulabili con ferie e malattia</li>
              <li>• Consultare sempre il CCNL applicabile per dettagli specifici</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Avviso Contratto */}
      <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
          <div>
            <h5 className="text-yellow-300 font-semibold mb-2">Importante</h5>
            <p className="text-yellow-200 text-sm">
              Questi calcoli sono indicativi. Il monte ore effettivo dipende dal contratto individuale, 
              dal CCNL applicabile e dalle specifiche normative aziendali. 
              Consultare sempre l'ufficio HR per conferme.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonteOreCalculator;
