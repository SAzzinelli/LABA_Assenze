import React from 'react';
import { Calculator, Clock, Users, Heart, Plane, AlertTriangle, Info } from 'lucide-react';
import { useAuthStore } from '../utils/store';

const MonteOreCalculator = ({ user, workSchedule }) => {
  const { apiCall } = useAuthStore();
  const [leaveBalances, setLeaveBalances] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Carica saldi ferie dal database
  React.useEffect(() => {
    const loadLeaveBalances = async () => {
      try {
        setLoading(true);
        const response = await apiCall('/api/leave-balances?year=2025');
        if (response.ok) {
          const data = await response.json();
          setLeaveBalances(data);
        } else {
          // Fallback a dati mock se API fallisce
          setLeaveBalances(getMockLeaveBalances());
        }
      } catch (error) {
        console.error('Error loading leave balances:', error);
        setLeaveBalances(getMockLeaveBalances());
      } finally {
        setLoading(false);
      }
    };

    loadLeaveBalances();
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
          // Sottrai la pausa pranzo se presente
          if (day.lunchBreak) {
            const [start, end] = day.lunchBreak.split('-');
            dayHours -= calculateHours(start, end);
          }
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
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center">
        <Calculator className="h-6 w-6 mr-3 text-indigo-400" />
        Monte Ore e Calcoli
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
              <span className={`font-semibold ${overtime.weekly > 0 ? 'text-yellow-400' : overtime.weekly < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {overtime.weekly > 0 ? '+' : ''}{overtime.weekly.toFixed(1)}h
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
              {leaveBalances.map((balance) => {
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
