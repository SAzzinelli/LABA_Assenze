import { useEffect } from 'react';

export const useModal = (isOpen, onClose) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (event) => {
      // Controlla se il click è sul backdrop (non sul contenuto del modal)
      if (event.target === event.currentTarget) {
        onClose();
      }
    };

    // Aggiungi event listeners
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('click', handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);
};
