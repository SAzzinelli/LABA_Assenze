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
        const currentYear = year || new Date().getFullYear();
        const response = await apiCall(`/api/holidays?year=${currentYear}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`📅 Loaded ${data.length} holidays for year ${currentYear}`);
          setHolidays(data || []);
        } else {
          console.error('Failed to load holidays:', response.status);
        }
      } catch (error) {
        console.error('Error loading holidays:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHolidays();
  }, [year, apiCall]);

  const getUpcomingHolidays = () => {
    const today = new Date();
    return holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= today;
    }).slice(0, 3);
  };

  const upcomingHolidays = getUpcomingHolidays();

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <Calendar className="h-6 w-6 mr-3 text-green-400" />
          Giorni Festivi {year}
        </h3>
        <div className="text-center text-slate-400">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div 
        className="flex items-center justify-between cursor-pointer mb-4"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-xl font-bold text-white flex items-center">
          <Calendar className="h-6 w-6 mr-3 text-green-400" />
          Giorni Festivi {year}
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
                    : 'bg-slate-700/50 border-slate-600'
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

          <div className="mt-4 pt-4 border-t border-slate-600">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Totale giorni festivi {year}:</span>
              <span className="font-semibold text-white">{holidays.length} giorni</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HolidaysCalendar;
