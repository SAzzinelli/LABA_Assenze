import React from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../utils/store';

const HolidaysCalendar = ({ year = new Date().getFullYear() }) => {
  const { apiCall } = useAuthStore();
  const [holidays, setHolidays] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  React.useEffect(() => {
    const loadHolidays = async () => {
      try {
        setLoading(true);
        // Carica festivi per 2025 e 2026
        const [response2025, response2026] = await Promise.all([
          apiCall('/api/holidays?year=2025'),
          apiCall('/api/holidays?year=2026')
        ]);
        
        let allHolidays = [];
        
        if (response2025.ok) {
          const data2025 = await response2025.json();
          allHolidays = [...(data2025 || [])];
          console.log(`📅 Loaded ${data2025.length} holidays for year 2025`);
        }
        
        if (response2026.ok) {
          const data2026 = await response2026.json();
          allHolidays = [...allHolidays, ...(data2026 || [])];
          console.log(`📅 Loaded ${data2026.length} holidays for year 2026`);
        }
        
        // Ordina per data
        allHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        setHolidays(allHolidays);
        console.log(`📅 Total holidays loaded: ${allHolidays.length}`);
      } catch (error) {
        console.error('Error loading holidays:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHolidays();
  }, [apiCall]);

  const getUpcomingHolidays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filtra tutti i festivi futuri
    const futureHolidays = holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      holidayDate.setHours(0, 0, 0, 0);
      return holidayDate >= today;
    });
    
    // Assicurati di includere almeno alcuni festivi del 2026 se ci sono
    const holidays2025 = futureHolidays.filter(h => new Date(h.date).getFullYear() === 2025);
    const holidays2026 = futureHolidays.filter(h => new Date(h.date).getFullYear() === 2026);
    
    // Mostra tutti i festivi futuri, ma almeno alcuni del 2026 se ci sono
    if (holidays2026.length > 0) {
      // Mostra tutti i festivi del 2025 e almeno i primi 5 del 2026
      return [...holidays2025, ...holidays2026.slice(0, 5)];
    }
    
    // Se non ci sono festivi del 2026, mostra tutti quelli futuri (max 20 per non sovraccaricare)
    return futureHolidays.slice(0, 20);
  };

  const upcomingHolidays = getUpcomingHolidays();

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <Calendar className="h-6 w-6 mr-3 text-green-400" />
          Giorni Festivi A.A. 2025/2026
        </h3>
        <div className="text-center text-slate-400">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
      <div 
        className="flex items-center justify-between cursor-pointer mb-4"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-xl font-bold text-white flex items-center">
          <Calendar className="h-6 w-6 mr-3 text-green-400" />
          Giorni Festivi A.A. 2025/2026
        </h3>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        )}
      </div>

      {!isCollapsed && (
        <>
          {upcomingHolidays.length === 0 ? (
        <div className="text-center text-slate-400">
          <p>Nessun giorno festivo programmato</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingHolidays.map((holiday) => {
            const holidayDate = new Date(holiday.date);
            const isToday = holidayDate.toDateString() === new Date().toDateString();
            const daysUntil = Math.ceil((holidayDate - new Date()) / (1000 * 60 * 60 * 24));

            return (
              <div
                key={holiday.id}
                className={`p-3 rounded-lg border ${
                  isToday
                    ? 'bg-green-900/30 border-green-500'
                    : 'bg-zinc-800/50 border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-semibold">{holiday.name}</h4>
                    <p className="text-slate-300 text-sm">
                      {holidayDate.toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'long'
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    {isToday ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-600 text-white">
                        <Clock className="h-3 w-3 mr-1" />
                        Oggi
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm">
                        {daysUntil === 1 ? 'Domani' : `Tra ${daysUntil} giorni`}
                      </span>
                    )}
                  </div>
                </div>
                {holiday.description && (
                  <p className="text-slate-400 text-xs mt-2">{holiday.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Totale giorni festivi A.A. 2025/2026:</span>
              <span className="font-semibold text-white">{holidays.length} giorni</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span>2025: {holidays.filter(h => new Date(h.date).getFullYear() === 2025).length} giorni</span>
              <span>2026: {holidays.filter(h => new Date(h.date).getFullYear() === 2026).length} giorni</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HolidaysCalendar;
