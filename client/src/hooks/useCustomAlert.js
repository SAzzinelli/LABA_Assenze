import { useState } from 'react';

export const useCustomAlert = () => {
  const [alert, setAlert] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: null,
    showCancel: false,
    confirmText: 'OK',
    cancelText: 'Annulla'
  });

  const showAlert = ({
    type = 'info',
    title,
    message,
    onConfirm,
    showCancel = false,
    confirmText = 'OK',
    cancelText = 'Annulla'
  }) => {
    setAlert({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
      showCancel,
      confirmText,
      cancelText
    });
  };

  const hideAlert = () => {
    setAlert(prev => ({ ...prev, isOpen: false }));
  };

  const showSuccess = (message, title = 'Successo') => {
    showAlert({ type: 'success', title, message });
  };

  const showError = (message, title = 'Errore') => {
    showAlert({ type: 'error', title, message });
  };

  const showWarning = (message, title = 'Attenzione') => {
    showAlert({ type: 'warning', title, message });
  };

  const showInfo = (message, title = 'Informazione') => {
    showAlert({ type: 'info', title, message });
  };

  const showConfirm = ({
    message,
    title = 'Conferma',
    onConfirm,
    confirmText = 'Conferma',
    cancelText = 'Annulla'
  }) => {
    showAlert({
      type: 'warning',
      title,
      message,
      onConfirm,
      showCancel: true,
      confirmText,
      cancelText
    });
  };

  return {
    alert,
    showAlert,
    hideAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm
  };
};

