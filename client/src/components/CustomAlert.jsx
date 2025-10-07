import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

const CustomAlert = ({ 
  isOpen, 
  onClose, 
  type = 'info', 
  title, 
  message, 
  confirmText = 'OK', 
  onConfirm,
  showCancel = false,
  cancelText = 'Annulla'
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    handleClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-400" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-400" />;
      case 'warning':
        return <AlertCircle className="h-6 w-6 text-yellow-400" />;
      default:
        return <Info className="h-6 w-6 text-blue-400" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500/10 border-green-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Alert Modal */}
      <div className={`
        relative bg-slate-800 border rounded-lg p-6 max-w-md w-full mx-4
        transform transition-all duration-200
        ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        ${getBgColor()}
      `}>
        {/* Icon and Title */}
        <div className="flex items-center mb-4">
          {getIcon()}
          <h3 className="text-lg font-semibold text-white ml-3">
            {title}
          </h3>
        </div>

        {/* Message */}
        <p className="text-slate-300 mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          {showCancel && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${getButtonColor()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomAlert;