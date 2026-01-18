import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plane, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Users,
  Clock,
  X,
  UserCheck
} from 'lucide-react';

const VacationCalendar = ({ vacationRequests = [], onDateClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [modalRequests, setModalRequests] = useState([]);

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  // Navigazione mesi
  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Genera giorni del mese
  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Inizia dalla domenica

    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) { // 6 settimane
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = currentDate.getMonth() === currentMonth;
      const isToday = currentDate.toDateString() === today.toDateString();
      
      // Trova richieste per questo giorno
      const dayRequests = vacationRequests.filter(request => {
        const start = new Date(request.startDate);
        const end = new Date(request.endDate);
        return currentDate >= start && currentDate <= end;
      });

      days.push({
        date: new Date(currentDate),
        isCurrentMonth,
        isToday,
        requests: dayRequests,
        hasAdminCreated: hasAdminCreatedVacations(dayRequests)
      });
    }

    return days;
  };

  // Ottieni statistiche per il mese
  const getMonthStats = () => {
    const approvedRequests = vacationRequests.filter(req => 
      req.status === 'approved' && 
      new Date(req.startDate).getMonth() === currentMonth &&
      new Date(req.startDate).getFullYear() === currentYear
    );
    
    const pendingRequests = vacationRequests.filter(req => 
      req.status === 'pending' && 
      new Date(req.startDate).getMonth() === currentMonth &&
      new Date(req.startDate).getFullYear() === currentYear
    );

    const totalDays = approvedRequests.reduce((sum, req) => {
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      return sum + Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }, 0);

    return {
      approved: approvedRequests.length,
      pending: pendingRequests.length,
      totalDays
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'rejected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-3 w-3" />;
      case 'pending':
        return <AlertCircle className="h-3 w-3" />;
      case 'rejected':
        return <XCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  // Verifica se una richiesta è stata creata da admin
  const isAdminCreated = (request) => {
    return request.notes && (
      request.notes.includes('[Creato dall\'admin]') || 
      request.notes.includes('[Creato automaticamente') ||
      request.approvedBy !== null
    );
  };

  // Verifica se un giorno ha ferie create da admin
  const hasAdminCreatedVacations = (dayRequests) => {
    return dayRequests.some(req => isAdminCreated(req));
  };

  // Apri modale dettagli
  const openDetailsModal = (date, requests) => {
    setModalDate(date);
    setModalRequests(requests);
    setShowDetailsModal(true);
  };

  // Genera lista giorni del mese (per vista mobile)
  const generateMonthDaysList = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysCount = lastDay.getDate();
    const today = new Date();
    
    const days = [];
    for (let day = 1; day <= daysCount; day++) {
      const currentDate = new Date(currentYear, currentMonth, day);
      const isToday = currentDate.toDateString() === today.toDateString();
      
      // Trova richieste per questo giorno
      const dayRequests = vacationRequests.filter(request => {
        const start = new Date(request.startDate);
        const end = new Date(request.endDate);
        return currentDate >= start && currentDate <= end;
      });

      days.push({
        date: new Date(currentDate),
        isToday,
        requests: dayRequests,
        hasAdminCreated: hasAdminCreatedVacations(dayRequests)
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const monthDaysList = generateMonthDaysList();
  const monthStats = getMonthStats();

  return (
    <div className="bg-zinc-950 rounded-lg overflow-x-hidden">
      {/* Header compatto mobile - Stack verticale con navigazione compatta */}
      <div className="p-3 sm:p-6">
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          {/* Titolo e mese/anno - Mobile friendly */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-xl font-bold text-white truncate">
                  {monthNames[currentMonth]} {currentYear}
          </h2>
                <p className="text-xs text-slate-400 sm:hidden">Calendario Ferie</p>
              </div>
        </div>
        
            {/* Navigazione mese - Compatta su mobile */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={goToPreviousMonth}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Mese precedente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToToday}
                className="px-2 sm:px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded-lg transition-colors touch-manipulation min-h-[44px] font-medium"
          >
                <span className="hidden sm:inline">OGGI</span>
                <span className="sm:hidden">Oggi</span>
          </button>
          <button
            onClick={goToNextMonth}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Mese successivo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
            </div>
        </div>
      </div>

        {/* Statistiche del mese - Compatte su mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-slate-700 rounded-lg p-2 sm:p-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-[10px] sm:text-sm mb-1">Approvate</p>
                <p className="text-lg sm:text-2xl font-bold text-green-400">{monthStats.approved}</p>
              </div>
              <CheckCircle className="h-4 w-4 sm:h-8 sm:w-8 text-green-400 flex-shrink-0 mx-auto sm:mx-0 mt-1 sm:mt-0" />
            </div>
          </div>
          
          <div className="bg-slate-700 rounded-lg p-2 sm:p-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-[10px] sm:text-sm mb-1">In Attesa</p>
                <p className="text-lg sm:text-2xl font-bold text-yellow-400">{monthStats.pending}</p>
        </div>
              <AlertCircle className="h-4 w-4 sm:h-8 sm:w-8 text-yellow-400 flex-shrink-0 mx-auto sm:mx-0 mt-1 sm:mt-0" />
            </div>
          </div>
          
          <div className="bg-slate-700 rounded-lg p-2 sm:p-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-[10px] sm:text-sm mb-1">Giorni</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-400">{monthStats.totalDays}</p>
        </div>
              <Plane className="h-4 w-4 sm:h-8 sm:w-8 text-blue-400 flex-shrink-0 mx-auto sm:mx-0 mt-1 sm:mt-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Vista Mobile: Lista verticale giorni (solo su mobile) */}
      <div className="lg:hidden px-3 pb-4 space-y-2 max-h-[70vh] overflow-y-auto">
        {monthDaysList.map((day) => (
          <div
            key={day.date.getTime()}
            onClick={() => {
              setSelectedDate(day.date);
              onDateClick?.(day.date, day.requests);
            }}
            className={`
              rounded-lg p-3 cursor-pointer transition-colors border
              ${day.hasAdminCreated 
                ? 'bg-purple-900/40 border-purple-500/50 hover:bg-purple-800/50' 
                : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}
              ${day.isToday ? 'ring-2 ring-blue-500' : ''}
              ${selectedDate && day.date.toDateString() === selectedDate.toDateString() ? 'bg-blue-600/20 ring-2 ring-blue-500' : ''}
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm
                  ${day.isToday ? 'bg-blue-500 text-white' : 'bg-slate-600 text-slate-200'}
                `}>
                  {day.date.getDate()}
                </div>
                <div>
                  <div className="text-white font-semibold">
                    {dayNames[day.date.getDay()]}
                  </div>
                  <div className="text-xs text-slate-400">
                    {day.date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                  </div>
                </div>
              </div>
              {day.requests.length > 0 && (
                <div className="flex items-center gap-1">
                  {day.requests.slice(0, 3).map((request, idx) => (
                    <div
                      key={idx}
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center ${getStatusColor(request.status)}
                      `}
                      title={`${request.submittedBy || 'Dipendente'}: ${request.status}`}
                    >
                      {getStatusIcon(request.status)}
                    </div>
                  ))}
                  {day.requests.length > 3 && (
                    <span className="text-xs text-slate-400 ml-1">+{day.requests.length - 3}</span>
                  )}
                </div>
              )}
            </div>
            
            {/* Mostra richieste se presenti */}
            {day.requests.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-600 space-y-1.5">
                {day.requests.slice(0, 3).map((request, idx) => (
                  <div
                    key={idx}
                    className={`
                      flex items-center gap-2 px-2 py-1.5 rounded ${getStatusColor(request.status)}
                    `}
                  >
                    {getStatusIcon(request.status)}
                    <span className="text-xs text-white font-medium flex-1 truncate">
                      {request.submittedBy || 'Dipendente'}
                    </span>
                    <span className="text-[10px] text-white/80">
                      {request.status === 'approved' ? 'Approvata' : 
                       request.status === 'pending' ? 'In attesa' : 'Rifiutata'}
                    </span>
                  </div>
                ))}
                {day.requests.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetailsModal(day.date, day.requests);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 text-center py-1 w-full cursor-pointer hover:underline"
                  >
                    + {day.requests.length - 3} altra/e richiesta/e
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vista Desktop: Calendario a griglia (solo su desktop) */}
      <div className="hidden lg:block bg-slate-700 rounded-lg p-4 mx-3 mb-4">
        {/* Header giorni settimana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center text-slate-400 text-sm font-medium py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Griglia giorni */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={`
                min-h-[80px] p-2 border rounded cursor-pointer transition-colors
                ${day.isCurrentMonth 
                  ? day.hasAdminCreated 
                    ? 'bg-purple-900/40 border-purple-500/50 hover:bg-purple-800/50' 
                    : 'bg-zinc-950 border-zinc-900 hover:bg-zinc-900'
                  : 'bg-black text-slate-500 border-zinc-900'}
                ${day.isToday ? 'ring-2 ring-blue-500' : ''}
                ${selectedDate && day.date.toDateString() === selectedDate.toDateString() ? 'bg-blue-600' : ''}
              `}
              onClick={() => {
                setSelectedDate(day.date);
                onDateClick?.(day.date, day.requests);
              }}
            >
              <div className="text-sm font-medium mb-1">
                {day.date.getDate()}
              </div>
              
              {/* Indicatori richieste */}
              <div className="space-y-1">
                {day.requests.slice(0, 3).map((request, reqIndex) => (
                  <div
                    key={reqIndex}
                    className={`
                      flex items-center space-x-1 px-1 py-0.5 rounded text-xs
                      ${getStatusColor(request.status)} text-white
                    `}
                    title={`${request.submittedBy || 'Dipendente'}: ${request.status}`}
                  >
                    {getStatusIcon(request.status)}
                    <span className="truncate">
                      {request.submittedBy ? request.submittedBy.split(' ')[0] : 'Dip'}
                    </span>
                  </div>
                ))}
                {day.requests.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetailsModal(day.date, day.requests);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 text-center w-full cursor-pointer hover:underline"
                  >
                    +{day.requests.length - 3} altre
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legenda - Compatta su mobile */}
      <div className="px-3 pb-3 sm:px-6 sm:pb-6">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded flex-shrink-0"></div>
          <span className="text-slate-300">Approvate</span>
        </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded flex-shrink-0"></div>
          <span className="text-slate-300">In Attesa</span>
        </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded flex-shrink-0"></div>
          <span className="text-slate-300">Rifiutate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded flex-shrink-0 border border-purple-400"></div>
          <span className="text-slate-300">Ferie Admin</span>
          </div>
        </div>
      </div>

      {/* Modale Dettagli Richieste */}
      {showDetailsModal && modalDate && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false);
            }
          }}
        >
          <div className="bg-zinc-950 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center">
                  <Calendar className="h-6 w-6 mr-2 text-blue-400" />
                  Dettagli Ferie
                </h2>
                <p className="text-slate-400 mt-1">
                  {modalDate.toLocaleDateString('it-IT', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-3">
              {modalRequests.map((request, idx) => (
                <div
                  key={idx}
                  className={`
                    bg-slate-700 rounded-lg p-4 border
                    ${getStatusColor(request.status)} border-opacity-30
                  `}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(request.status)}
                      <div>
                        <h3 className="text-white font-semibold">
                          {request.submittedBy || 'Dipendente sconosciuto'}
                        </h3>
                        {isAdminCreated(request) && (
                          <div className="flex items-center gap-1 mt-1">
                            <UserCheck className="h-3 w-3 text-purple-400" />
                            <span className="text-xs text-purple-300">Creata da Admin</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${request.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                        request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-red-500/20 text-red-300'}
                    `}>
                      {request.status === 'approved' ? 'Approvata' :
                       request.status === 'pending' ? 'In attesa' : 'Rifiutata'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>
                        Dal {new Date(request.startDate).toLocaleDateString('it-IT')} al {new Date(request.endDate).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>
                        {request.days_requested || Math.ceil((new Date(request.endDate) - new Date(request.startDate)) / (1000 * 60 * 60 * 24)) + 1} giorni
                      </span>
                    </div>
                    {request.submittedAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>
                          Richiesta: {new Date(request.submittedAt).toLocaleString('it-IT')}
                        </span>
                      </div>
                    )}
                    {request.approvedAt && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-slate-400" />
                        <span>
                          Approvata: {new Date(request.approvedAt).toLocaleString('it-IT')}
                        </span>
                      </div>
                    )}
                  </div>

                  {request.notes && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <p className="text-sm text-slate-300">
                        <strong className="text-slate-200">Note:</strong> {request.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VacationCalendar;
