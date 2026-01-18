import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const HourPicker = ({ 
  value, 
  onChange, 
  label, 
  placeholder = "Seleziona orario",
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState(value || '');

  useEffect(() => {
    setSelectedTime(value || '');
  }, [value]);

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    onChange(time);
    setIsOpen(false);
  };

  const formatDisplayTime = (time) => {
    if (!time) return placeholder;
    // Rimuovi i secondi se presenti (09:00:00 -> 09:00)
    return time.includes(':') ? time.substring(0, 5) : time;
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg
            text-left text-white placeholder-slate-400
            focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent
            transition-colors duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600 cursor-pointer'}
            ${isOpen ? 'ring-2 ring-indigo-500 border-transparent' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            <span className={selectedTime ? 'text-white' : 'text-slate-400'}>
              {formatDisplayTime(selectedTime)}
            </span>
            <Clock className="h-4 w-4 text-slate-400" />
          </div>
        </button>

        {isOpen && !disabled && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto transform -translate-y-1">
              <div className="p-3">
                <div className="grid grid-cols-3 gap-2">
                  {timeOptions.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleTimeSelect(time)}
                      className={`
                        px-4 py-3 text-sm rounded-lg transition-colors font-mono
                        ${selectedTime === time 
                          ? 'bg-indigo-600 text-white border border-indigo-500' 
                          : 'text-slate-300 hover:bg-slate-700 border border-transparent'
                        }
                      `}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HourPicker;
