import { useEffect, useRef, useState } from 'react';

const DESKTOP_NOTIFICATIONS_KEY = 'desktopNotificationsEnabled';

export function useDesktopNotifications() {
  const [permission, setPermission] = useState(Notification.permission || 'default');
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY);
    return saved === 'true' && permission === 'granted';
  });
  const previousNotificationsRef = useRef([]);

  // Controlla se il browser supporta le notifiche
  const isSupported = () => {
    return 'Notification' in window;
  };

  // Richiedi permesso per le notifiche
  const requestPermission = async () => {
    if (!isSupported()) {
      alert('Il tuo browser non supporta le notifiche desktop');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setEnabled(true);
        localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'true');
        // Mostra una notifica di test
        showNotification('Notifiche abilitate', 'Riceverai notifiche per le nuove richieste', '/dashboard');
        return true;
      } else {
        setEnabled(false);
        localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  // Disabilita le notifiche
  const disable = () => {
    setEnabled(false);
    localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
  };

  // Mostra una notifica desktop
  const showNotification = (title, message, url = null) => {
    if (!enabled || permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico', // Usa l'icona del sito se disponibile
        badge: '/favicon.ico',
        tag: 'presenze-laba-hr', // Evita notifiche duplicate
        requireInteraction: false, // Si chiude automaticamente
        silent: false // Suona il suono di sistema
      });

      // Se clicca sulla notifica, apri la pagina se specificata
      if (url) {
        notification.onclick = () => {
          window.focus();
          window.location.href = url;
          notification.close();
        };
      }

      // Chiudi automaticamente dopo 5 secondi
      setTimeout(() => {
        notification.close();
      }, 5000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  // Controlla nuove notifiche e mostra notifiche desktop
  const checkNewNotifications = (currentNotifications) => {
    if (!enabled || permission !== 'granted' || !currentNotifications || currentNotifications.length === 0) {
      previousNotificationsRef.current = currentNotifications || [];
      return;
    }

    const previousIds = new Set(previousNotificationsRef.current.map(n => n.id));
    const newNotifications = currentNotifications.filter(n => !previousIds.has(n.id) && !n.is_read);

    // Mostra notifiche per quelle nuove e non lette
    newNotifications.forEach(notification => {
      const url = getNotificationUrl(notification);
      showNotification(notification.title || 'Nuova notifica', notification.message || '', url);
    });

    previousNotificationsRef.current = currentNotifications;
  };

  // Ottieni l'URL corretto per il tipo di notifica
  const getNotificationUrl = (notification) => {
    if (notification.request_id && notification.request_type) {
      switch (notification.request_type) {
        case 'permission':
          return '/permessi';
        case 'vacation':
          return '/ferie';
        case 'sick':
        case 'sick_leave':
          return '/malattia';
        case 'permission_104':
          return '/permessi-104';
        default:
          return '/dashboard';
      }
    }
    return '/dashboard';
  };

  // Aggiorna il permesso se cambia (es. l'utente lo cambia manualmente)
  useEffect(() => {
    if (isSupported()) {
      setPermission(Notification.permission);
      
      // Se il permesso è stato revocato dall'utente, disabilita
      if (Notification.permission !== 'granted') {
        setEnabled(false);
        localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
      }
    }
  }, []);

  return {
    isSupported: isSupported(),
    permission,
    enabled: enabled && permission === 'granted',
    requestPermission,
    disable,
    showNotification,
    checkNewNotifications
  };
}

