import { useEffect, useRef, useState, useCallback } from 'react';

const DESKTOP_NOTIFICATIONS_KEY = 'desktopNotificationsEnabled';

export function useDesktopNotifications() {
  // Inizializza il permesso - Safari potrebbe non avere sempre 'default' inizialmente
  const getInitialPermission = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'default';
    }
    // Safari potrebbe non restituire 'default' se non ha mai fatto richiesta
    // Quindi forziamo 'default' se non è né 'granted' né 'denied'
    const perm = Notification.permission;
    if (!perm || (perm !== 'granted' && perm !== 'denied')) {
      return 'default';
    }
    return perm;
  };

  const [permission, setPermission] = useState(getInitialPermission());
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY);
    return saved === 'true' && permission === 'granted';
  });
  const previousNotificationsRef = useRef([]);

  // Controlla se il browser supporta le notifiche
  const isSupported = () => {
    return 'Notification' in window;
  };

  // Aggiorna solo lo stato del permesso senza fare una nuova richiesta
  const updatePermission = () => {
    if (!isSupported()) {
      return;
    }
    const currentPermission = Notification.permission;
    setPermission(currentPermission);
    if (currentPermission === 'granted') {
      setEnabled(true);
      localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'true');
    } else {
      setEnabled(false);
      localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
    }
  };

  // Richiedi permesso per le notifiche
  const requestPermission = async () => {
    if (!isSupported()) {
      alert('Il tuo browser non supporta le notifiche desktop');
      return false;
    }

    const currentPermission = Notification.permission;
    
    // Se il permesso è già granted, aggiorna solo lo stato
    if (currentPermission === 'granted') {
      updatePermission();
      return true;
    }

    // Se il permesso è già denied, non tentare di richiederlo
    // L'utente deve abilitarlo manualmente dalle impostazioni del browser
    if (currentPermission === 'denied') {
      updatePermission();
      return false;
    }

    // Se il permesso è 'default', possiamo richiederlo
    // Safari richiede che questo avvenga in un contesto di interazione utente (click)
    try {
      console.log('🔔 Attempting to request notification permission...');
      console.log('🔔 Notification object:', typeof Notification);
      console.log('🔔 Notification.requestPermission type:', typeof Notification.requestPermission);
      console.log('🔔 Current permission before request:', Notification.permission);
      
      // Verifica HTTPS (richiesto per notifiche su Chrome/Safari)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.error('❌ Notifiche richiedono HTTPS (tranne localhost)');
        alert('⚠️ Le notifiche richiedono una connessione HTTPS. Il sito deve essere servito tramite HTTPS per funzionare.');
        return false;
      }
      
      // Safari supporta sia Promise-based che callback-based
      // Prova prima Promise-based (moderno), poi callback-based (legacy)
      let result;
      
      if (typeof Notification.requestPermission === 'function') {
        console.log('🔔 Using Promise-based API...');
        // Promise-based API (standard moderno) - Safari 16+ supporta questo
        try {
          // Chiama direttamente Notification.requestPermission() 
          // Questo dovrebbe mostrare il prompt del browser
          console.log('🔔 Calling Notification.requestPermission() now...');
          result = await Notification.requestPermission();
          console.log('🔔 Permission result (Promise):', result);
          console.log('🔔 Notification.permission after request:', Notification.permission);
        } catch (promiseError) {
          // Se la Promise fallisce, potrebbe essere che Safari usi ancora la callback API
          console.log('🔔 Promise API failed, trying callback API...', promiseError);
          
          // Usa callback-based API (legacy Safari)
          return new Promise((resolve) => {
            console.log('🔔 Using callback-based API...');
            Notification.requestPermission((callbackResult) => {
              console.log('🔔 Permission result (Callback):', callbackResult);
              setPermission(callbackResult);
              if (callbackResult === 'granted') {
                setEnabled(true);
                localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'true');
                setTimeout(() => {
                  showNotification('Notifiche abilitate', 'Riceverai notifiche per le nuove richieste', '/dashboard');
                }, 100);
                resolve(true);
              } else {
                setEnabled(false);
                localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
                resolve(false);
              }
            });
          });
        }
      } else {
        console.error('❌ Notification.requestPermission is not a function!');
        // Callback-based API (browser molto vecchi)
        return new Promise((resolve) => {
          console.log('🔔 Using callback-based API (only option)...');
          Notification.requestPermission((callbackResult) => {
            console.log('🔔 Permission result (Callback-only):', callbackResult);
            setPermission(callbackResult);
            if (callbackResult === 'granted') {
              setEnabled(true);
              localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'true');
              setTimeout(() => {
                showNotification('Notifiche abilitate', 'Riceverai notifiche per le nuove richieste', '/dashboard');
              }, 100);
              resolve(true);
            } else {
              setEnabled(false);
              localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
              resolve(false);
            }
          });
        });
      }

      // Se siamo qui, abbiamo ottenuto il risultato dalla Promise API
      setPermission(result);
      
      if (result === 'granted') {
        setEnabled(true);
        localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'true');
        // Mostra una notifica di test (ma solo se permission è granted)
        setTimeout(() => {
          showNotification('Notifiche abilitate', 'Riceverai notifiche per le nuove richieste', '/dashboard');
        }, 100);
        return true;
      } else {
        setEnabled(false);
        localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
        // Se il risultato è 'denied', potrebbe essere che Safari l'abbia bloccato automaticamente
        // ma non significa che il sito sia nella lista - potrebbe semplicemente essere stato negato
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      // In caso di errore, non assumiamo denied - potrebbe essere un errore di rete o altro
      // Manteniamo il permesso corrente
      return false;
    }
  };

  // Disabilita le notifiche
  const disable = () => {
    setEnabled(false);
    localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
  };

  // Mostra una notifica desktop - memoizzata per evitare ricreazioni
  const showNotification = useCallback((title, message, url = null) => {
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
  }, [enabled, permission]);

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

  // Controlla nuove notifiche e mostra notifiche desktop
  // Usa useCallback per evitare che la funzione cambi ad ogni render
  const checkNewNotifications = useCallback((currentNotifications) => {
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
  }, [enabled, permission, showNotification]); // Dipendenze: enabled, permission e showNotification

  // Aggiorna il permesso se cambia (es. l'utente lo cambia manualmente)
  useEffect(() => {
    if (isSupported()) {
      const currentPerm = getInitialPermission();
      setPermission(currentPerm);
      
      // Se il permesso è stato revocato dall'utente, disabilita
      if (currentPerm !== 'granted') {
        setEnabled(false);
        localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
      } else {
        // Se è granted, abilita
        setEnabled(true);
        localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'true');
      }
    }
  }, []);

  return {
    isSupported: isSupported(),
    permission,
    enabled: enabled && permission === 'granted',
    requestPermission,
    updatePermission,
    disable,
    showNotification,
    checkNewNotifications
  };
}

