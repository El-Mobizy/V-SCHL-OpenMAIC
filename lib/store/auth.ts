import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SchoolUser } from '@/lib/types/school';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';

export interface AuthState {
  user: SchoolUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = await api.auth.login(email, password);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (e) {
          const msg = e instanceof ApiError ? e.detail : 'Login failed';
          set({ error: msg, isLoading: false });
        }
      },

      logout: async () => {
        try {
          await api.auth.logout();
        } catch {}
        set({ user: null, isAuthenticated: false, error: null });
      },

      hydrate: async () => {
        try {
          const { user } = await api.auth.me();
          set({ user, isAuthenticated: true });
        } catch (e) {
          if (e instanceof ApiError && e.code === 'UNAUTHORIZED') {
            set({ user: null, isAuthenticated: false });
          }
          // On NETWORK/SERVER: keep persisted state; a real 401 from any API call will clear it.
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
);

export const selectStudentUuid = (s: AuthState) => s.user?.student_uuid ?? '';
