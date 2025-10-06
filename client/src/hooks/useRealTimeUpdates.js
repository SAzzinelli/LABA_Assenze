import { useEffect, useRef } from 'react';
import { useAuthStore } from '../utils/store';

export const useRealTimeUpdates = (callbacks = {}) => {
  const { user } = useAuthStore();
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const lastUpdateRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    // Initialize WebSocket connection with fallback
    const initializeSocket = () => {
      try {
        // Per Railway, usiamo Socket.IO invece di WebSocket nativi
        const socketUrl = window.location.origin;
        
        // Import Socket.IO dinamicamente
        import('socket.io-client').then(({ io }) => {
          socketRef.current = io(socketUrl, {
            transports: ['websocket', 'polling'], // Fallback automatico
            upgrade: true,
            rememberUpgrade: true,
            timeout: 20000,
            forceNew: true
          });

          socketRef.current.on('connect', () => {
            console.log('🔌 Socket.IO connesso');
            
            // Join user to their room
            socketRef.current.emit('join', {
              userId: user.id,
              role: user.role
            });
          });

          socketRef.current.on('attendance_changed', (data) => {
            console.log('📨 Aggiornamento presenze ricevuto:', data);
            callbacks.onAttendanceUpdate?.(data);
          });

          socketRef.current.on('new_leave_request', (data) => {
            console.log('📨 Nuova richiesta permesso ricevuta:', data);
            callbacks.onLeaveRequestUpdate?.(data);
          });

          socketRef.current.on('request_updated', (data) => {
            console.log('📨 Richiesta aggiornata ricevuta:', data);
            callbacks.onRequestDecision?.(data);
          });

          socketRef.current.on('employee_updated', (data) => {
            console.log('📨 Dipendente aggiornato ricevuto:', data);
            callbacks.onEmployeeUpdate?.(data);
          });

          socketRef.current.on('stats_updated', (data) => {
            console.log('📨 Statistiche aggiornate ricevute:', data);
            callbacks.onStatsUpdate?.(data);
          });

          socketRef.current.on('disconnect', (reason) => {
            console.log('🔌 Socket.IO disconnesso:', reason);
            
            // Riconnessione automatica
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('🔄 Tentativo di riconnessione Socket.IO...');
              initializeSocket();
            }, 5000);
          });

          socketRef.current.on('connect_error', (error) => {
            console.log('⚠️ Errore connessione Socket.IO:', error.message);
          });

        }).catch((error) => {
          console.log('⚠️ Socket.IO non disponibile, usando polling fallback');
        });
      } catch (error) {
        console.log('⚠️ Errore inizializzazione Socket.IO, usando polling fallback');
      }
    };

    initializeSocket();

    // Fallback polling system
    const startPolling = () => {
      pollingIntervalRef.current = setInterval(async () => {
        try {
          // Controlla se ci sono aggiornamenti
          const response = await fetch('/api/updates/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              userId: user.id, 
              lastUpdate: lastUpdateRef.current 
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.hasUpdates) {
              lastUpdateRef.current = data.timestamp;
              // Trigger refresh callbacks
              callbacks.onEmployeeUpdate?.({ type: 'refresh' });
              callbacks.onAttendanceUpdate?.({ type: 'refresh' });
              callbacks.onLeaveRequestUpdate?.({ type: 'refresh' });
            }
          }
        } catch (error) {
          // Silently fail, polling will retry
        }
      }, 10000); // Poll ogni 10 secondi
    };

    // Avvia polling dopo 2 secondi (per dare tempo ai WebSocket)
    const pollingTimeout = setTimeout(startPolling, 2000);

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (pollingTimeout) {
        clearTimeout(pollingTimeout);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [user, callbacks]);

  // Function to emit updates
  const emitUpdate = (type, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(type, data);
    }
  };

  return {
    emitUpdate,
    isConnected: socketRef.current?.connected || false
  };
};

export default useRealTimeUpdates;
