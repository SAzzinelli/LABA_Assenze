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

    // WebSocket temporaneamente disabilitati per Railway
    // Usiamo solo polling fallback che funziona sempre
    console.log('🔌 WebSocket disabilitati per Railway, usando polling fallback');
    
    // Avvia subito il polling
    const startPolling = () => {
      pollingIntervalRef.current = setInterval(async () => {
        try {
          // Solo se l'utente ha un token
          if (!user.token) {
            return;
          }
          
          // Controlla se ci sono aggiornamenti
          const response = await fetch('/api/updates/check', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
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

    startPolling();

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };

  }, [user, callbacks]);

  // Function to emit updates (disabilitata per Railway)
  const emitUpdate = (type, data) => {
    // WebSocket disabilitati, non fare nulla
    console.log('📤 EmitUpdate chiamato ma WebSocket disabilitati:', type, data);
  };

  return {
    emitUpdate,
    isConnected: false // WebSocket disabilitati
  };
};

export default useRealTimeUpdates;
