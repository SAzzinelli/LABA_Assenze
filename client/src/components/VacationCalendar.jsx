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
  Clock
} from 'lucide-react';

const VacationCalendar = ({ vacationRequests = [], onDateClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);

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
        requests: dayRequests
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

  const calendarDays = generateCalendarDays();
  const monthStats = getMonthStats();

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      {/* Header con navigazione */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Calendar className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">
            Calendario Ferie - {monthNames[currentMonth]} {currentYear}
          </h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            OGGI
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Statistiche del mese */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Ferie Approvate</p>
              <p className="text-2xl font-bold text-green-400">{monthStats.approved}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">In Attesa</p>
              <p className="text-2xl font-bold text-yellow-400">{monthStats.pending}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Giorni Totali</p>
              <p className="text-2xl font-bold text-blue-400">{monthStats.totalDays}</p>
            </div>
            <Plane className="h-8 w-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-slate-700 rounded-lg p-4">
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
                min-h-[80px] p-2 border border-slate-600 rounded-lg cursor-pointer transition-colors
                ${day.isCurrentMonth ? 'bg-slate-800 hover:bg-slate-600' : 'bg-slate-900 text-slate-500'}
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
                  <div className="text-xs text-slate-400 text-center">
                    +{day.requests.length - 3} altre
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-6 flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-slate-300">Approvate</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span className="text-slate-300">In Attesa</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-slate-300">Rifiutate</span>
        </div>
      </div>
    </div>
  );
};

export default VacationCalendar;
