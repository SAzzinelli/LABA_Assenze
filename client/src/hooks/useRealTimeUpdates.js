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
        // Prima prova WebSocket nativi (come nel repository plot)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        socketRef.current = new WebSocket(wsUrl);

        socketRef.current.onopen = () => {
          console.log('🔌 WebSocket connesso');
          
          // Join user to their room
          socketRef.current.send(JSON.stringify({
            type: 'join',
            userId: user.id,
            role: user.role
          }));
        };

        socketRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 Messaggio WebSocket ricevuto:', data);

            // Handle different types of updates
            switch (data.type) {
              case 'attendance_changed':
                callbacks.onAttendanceUpdate?.(data);
                break;
              case 'new_leave_request':
                callbacks.onLeaveRequestUpdate?.(data);
                break;
              case 'request_updated':
                callbacks.onRequestDecision?.(data);
                break;
              case 'employee_updated':
                callbacks.onEmployeeUpdate?.(data);
                break;
              case 'stats_updated':
                callbacks.onStatsUpdate?.(data);
                break;
              default:
                console.log('📨 Messaggio WebSocket non gestito:', data);
            }
          } catch (error) {
            console.error('Errore parsing messaggio WebSocket:', error);
          }
        };

        socketRef.current.onclose = (event) => {
          console.log('🔌 WebSocket disconnesso:', event.code, event.reason);
          
          // Solo se non è una chiusura normale, riprova dopo 5 secondi
          if (event.code !== 1000) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('🔄 Tentativo di riconnessione WebSocket...');
              initializeSocket();
            }, 5000);
          }
        };

        socketRef.current.onerror = (error) => {
          console.log('⚠️ WebSocket non disponibile, usando polling fallback');
          // Non loggare come errore, è normale in produzione
        };
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
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type,
        ...data
      }));
    }
  };

  return {
    emitUpdate,
    isConnected: socketRef.current?.readyState === WebSocket.OPEN
  };
};

export default useRealTimeUpdates;
