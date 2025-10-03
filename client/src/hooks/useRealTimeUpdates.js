import { useEffect, useRef } from 'react';
import { useAuthStore } from '../utils/store';

export const useRealTimeUpdates = (callbacks = {}) => {
  const { user } = useAuthStore();
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    // Initialize WebSocket connection
    const initializeSocket = () => {
      try {
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

        socketRef.current.onclose = () => {
          console.log('🔌 WebSocket disconnesso');
          
          // Auto-reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Tentativo di riconnessione WebSocket...');
            initializeSocket();
          }, 3000);
        };

        socketRef.current.onerror = (error) => {
          console.error('❌ Errore WebSocket:', error);
        };

      } catch (error) {
        console.error('❌ Errore inizializzazione WebSocket:', error);
      }
    };

    initializeSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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
