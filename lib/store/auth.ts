import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SchoolUser } from '@/lib/types/school';
import { extractUser } from '@/lib/auth/jwt';

const SYMFONY_API_URL = process.env.NEXT_PUBLIC_SYMFONY_API_URL ?? '';

export interface AuthState {
  user: SchoolUser | null;
  accessToken: string | null; // stored in sessionStorage for direct Symfony API calls
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: SchoolUser | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          // 1. Authenticate with Symfony directly
          const authRes = await fetch(`${SYMFONY_API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!authRes.ok) {
            const data = await authRes.json().catch(() => ({}));
            throw new Error(data.message ?? 'Invalid credentials');
          }

          const { access_token, refresh_token } = await authRes.json();

          // 2. Store tokens in httpOnly cookies via BFF
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token, refresh_token }),
          });

          // 3. Extract user from JWT and store token for direct Symfony calls
          const user = extractUser(access_token);
          set({ user, accessToken: access_token, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Login failed',
            isLoading: false,
          });
        }
      },

      logout: async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        set({ user: null, accessToken: null, isAuthenticated: false, error: null });
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage clears on tab close for security
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
