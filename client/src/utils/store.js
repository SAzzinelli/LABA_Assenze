import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,

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
            
            // Avvia l'auto-refresh del token
            get().startTokenRefresh();
            
            return { success: true };
          } else {
            set({ loading: false });
            return { success: false, error: data.error };
          }
        } catch (error) {
          console.error('Login error:', error);
          set({ loading: false });
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
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            loading: false,
          });
        }
      },

      // Check authentication
      checkAuth: () => {
        const { token, user } = get();
        if (token && user) {
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
                console.log('❌ Auto-refresh fallito');
                clearInterval(refreshInterval);
              }
            } catch (error) {
              console.error('❌ Errore auto-refresh:', error);
            }
          }
        }, 30 * 60 * 1000); // 30 minuti

        return refreshInterval;
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

        // Aggiungi parametri di test se la modalità test è attiva
        let finalUrl = url;
        const testMode = localStorage.getItem('testMode') === 'true';
        if (testMode) {
          const testDate = localStorage.getItem('simulatedDate');
          const testTime = localStorage.getItem('simulatedTime');
          if (testDate && testTime) {
            const separator = url.includes('?') ? '&' : '?';
            finalUrl = `${url}${separator}testDate=${testDate}&testTime=${testTime}`;
            // Aggiungi anche header per test mode
            headers['X-Test-Mode'] = 'true';
            headers['X-Test-Date'] = testDate;
            headers['X-Test-Time'] = testTime;
          }
        }

        let response = await fetch(finalUrl, {
          ...options,
          headers,
          credentials: 'include',
        });

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
              response = await fetch(finalUrl, {
                ...options,
                headers,
                credentials: 'include',
              });
            } else {
              console.log('❌ Refresh token fallito, logout richiesto');
              // Se il refresh fallisce, fai logout
              set({
                user: null,
                token: null,
                isAuthenticated: false,
              });
              // Reindirizza al login
              window.location.href = '/login';
            }
          } catch (refreshError) {
            console.error('❌ Errore durante refresh token:', refreshError);
            // Se c'è un errore nel refresh, fai logout
            set({
              user: null,
              token: null,
              isAuthenticated: false,
            });
            window.location.href = '/login';
          }
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
      }),
    }
  )
);