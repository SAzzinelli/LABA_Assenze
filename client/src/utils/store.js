import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      tokenExpiryMonitorInterval: null,

      // Login function
      login: async (email, password) => {
        set({ loading: true });
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (data.success) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              loading: false,
            });
            
            // Avvia l'auto-refresh del token e il monitoraggio della scadenza
            get().startTokenRefresh();
            get().startTokenExpiryMonitor();
            
            return { success: true };
          } else {
            set({ loading: false });
            // Se Cloudflare è down, mostra un messaggio più chiaro
            if (data.code === 'CLOUDFLARE_DOWN' || data.code === 'DATABASE_CONNECTION_ERROR') {
              return { success: false, error: data.error || 'Servizio temporaneamente non disponibile' };
            }
            return { success: false, error: data.error };
          }
        } catch (error) {
          console.error('Login error:', error);
          set({ loading: false });
          // Se la risposta è 503, probabilmente è un problema di servizio
          if (error.response?.status === 503) {
            return { success: false, error: 'Servizio temporaneamente non disponibile. Riprova tra qualche minuto.' };
          }
          return { success: false, error: 'Errore di connessione' };
        }
      },

      // Register function
      register: async (userData) => {
        set({ loading: true });
        
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(userData),
          });

          const data = await response.json();

          if (data.success) {
            set({ loading: false });
            return { success: true, message: data.message };
          } else {
            set({ loading: false });
            return { success: false, error: data.error };
          }
        } catch (error) {
          console.error('Registration error:', error);
          set({ loading: false });
          return { success: false, error: 'Errore di connessione' };
        }
      },

      // Logout function
      logout: async () => {
        try {
          // Chiama l'endpoint di logout se abbiamo un token
          const { token } = get();
          if (token) {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              credentials: 'include',
            });
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Pulisci sempre lo stato locale
          const { tokenExpiryMonitorInterval } = get();
          if (tokenExpiryMonitorInterval) {
            clearInterval(tokenExpiryMonitorInterval);
          }
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            loading: false,
            tokenExpiryMonitorInterval: null,
          });
        }
      },

      // Check if token is expired (helper function)
      isTokenExpired: (token) => {
        if (!token) return true;
        try {
          // JWT tokens have 3 parts separated by dots: header.payload.signature
          const parts = token.split('.');
          if (parts.length !== 3) return true;
          
          // Decode the payload (second part)
          const payload = JSON.parse(atob(parts[1]));
          
          // Check if token has expiry (exp field is in seconds since epoch)
          if (payload.exp) {
            const expirationTime = payload.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            return currentTime >= expirationTime;
          }
          
          // If no expiry field, assume it's expired
          return true;
        } catch (error) {
          console.error('Error checking token expiry:', error);
          return true; // If we can't decode, assume expired
        }
      },

      // Check authentication
      checkAuth: () => {
        const { token, user } = get();
        if (token && user) {
          // Verifica se il token è scaduto
          if (get().isTokenExpired(token)) {
            console.log('🔒 Token scaduto, logout automatico...');
            get().logout();
            set({ isAuthenticated: false });
            return false;
          }
          set({ isAuthenticated: true });
          return true;
        }
        set({ isAuthenticated: false });
        return false;
      },

      // Set loading state
      setLoading: (loading) => {
        set({ loading });
      },

      // Auto-refresh token every 30 minutes
      startTokenRefresh: () => {
        const refreshInterval = setInterval(async () => {
          const { token, user } = get();
          if (token && user) {
            // Verifica se il token è scaduto prima di tentare il refresh
            if (get().isTokenExpired(token)) {
              console.log('🔒 Token scaduto durante auto-refresh, logout automatico...');
              clearInterval(refreshInterval);
              get().logout();
              window.location.href = '/login';
              return;
            }

            try {
              console.log('🔄 Auto-refresh token...');
              const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                credentials: 'include',
              });

              if (response.ok) {
                const data = await response.json();
                set({
                  token: data.token,
                  user: data.user,
                });
                console.log('✅ Token auto-rinnovato');
              } else {
                console.log('❌ Auto-refresh fallito, logout automatico...');
                clearInterval(refreshInterval);
                get().logout();
                window.location.href = '/login';
              }
            } catch (error) {
              console.error('❌ Errore auto-refresh:', error);
              clearInterval(refreshInterval);
              get().logout();
              window.location.href = '/login';
            }
          } else {
            clearInterval(refreshInterval);
          }
        }, 30 * 60 * 1000); // 30 minuti

        return refreshInterval;
      },

      // Monitor token expiry every 5 minutes
      startTokenExpiryMonitor: () => {
        // Pulisci l'intervallo esistente se presente
        const existingInterval = get().tokenExpiryMonitorInterval;
        if (existingInterval) {
          clearInterval(existingInterval);
        }

        const checkInterval = setInterval(() => {
          const { token, user, isAuthenticated } = get();
          
          // Se l'utente è autenticato ma il token è scaduto, fai logout
          if (isAuthenticated && token) {
            if (get().isTokenExpired(token)) {
              console.log('🔒 Token scaduto rilevato, logout automatico...');
              clearInterval(checkInterval);
              set({ tokenExpiryMonitorInterval: null });
              get().logout();
              window.location.href = '/login';
            }
          } else if (isAuthenticated && !token) {
            // Se l'utente risulta autenticato ma non c'è token, fai logout
            console.log('🔒 Token mancante, logout automatico...');
            clearInterval(checkInterval);
            set({ tokenExpiryMonitorInterval: null });
            get().logout();
            window.location.href = '/login';
          }
        }, 5 * 60 * 1000); // Controlla ogni 5 minuti

        set({ tokenExpiryMonitorInterval: checkInterval });
        return checkInterval;
      },

      // Helper function for authenticated API calls
      apiCall: async (url, options = {}) => {
        const { token } = get();
        const headers = {
          'Content-Type': 'application/json',
          ...options.headers,
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        let response;
        try {
          response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
        } catch (networkError) {
          // Gestisce errori di rete (TypeError: Load failed, CORS errors, ecc.)
          console.error('❌ Network error in apiCall:', url, networkError);
          // Restituisce una risposta fittizia per permettere al chiamante di gestire l'errore
          return new Response(null, {
            status: 0, // Status 0 indica errore di rete
            statusText: networkError.message || 'Network Error',
            ok: false
          });
        }
        
        // Non loggare errori 403 per endpoint admin-only (attesi per dipendenti)
        // Questi endpoint hanno controlli lato backend e non dovrebbero essere chiamati da dipendenti
        if (response.status === 403) {
          const adminOnlyEndpoints = ['/api/attendance/current', '/api/attendance/sick-today'];
          const isAdminOnlyEndpoint = adminOnlyEndpoints.some(endpoint => url.includes(endpoint));
          if (isAdminOnlyEndpoint) {
            // Silently return per evitare errori in console - sono attesi per dipendenti
            return response;
          }
        }

        // Se riceviamo un 401, proviamo a refreshare il token
        if (response.status === 401 && token) {
          console.log('🔄 Token scaduto, tentativo di refresh...');
          
          try {
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              credentials: 'include',
            });

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              console.log('✅ Token rinnovato con successo');
              
              // Aggiorna il token nello store
              set({
                token: refreshData.token,
                user: refreshData.user,
              });

              // Riprova la chiamata originale con il nuovo token
              headers.Authorization = `Bearer ${refreshData.token}`;
              response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',
              });
            } else {
              console.log('❌ Refresh token fallito, logout richiesto');
              // Se il refresh fallisce, fai logout
              get().logout();
              // Reindirizza al login
              window.location.href = '/login';
              return response; // Ritorna la response originale
            }
          } catch (refreshError) {
            console.error('❌ Errore durante refresh token:', refreshError);
            // Se c'è un errore nel refresh, fai logout
            get().logout();
            window.location.href = '/login';
            return response; // Ritorna la response originale
          }
        }
        
        // Se riceviamo un 401 senza token o se il token è scaduto, fai logout
        if (response.status === 401 && (!token || get().isTokenExpired(token))) {
          console.log('🔒 Token non valido o scaduto (401), logout automatico...');
          get().logout();
          window.location.href = '/login';
        }

        return response;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        // Non salvare tokenExpiryMonitorInterval (non serializzabile)
      }),
    }
  )
);