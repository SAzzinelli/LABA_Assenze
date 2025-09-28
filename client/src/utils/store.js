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
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          loading: false,
        });
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