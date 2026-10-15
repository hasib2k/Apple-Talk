import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@mangotalk/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isInitialized: boolean;
  setAuth: (user: User, tokens: { accessToken: string; refreshToken: string }) => void;
  updateUser: (user: Partial<User>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isInitialized: false,

      setAuth: (user, tokens) => {
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isInitialized: true });
      },

      updateUser: (partial) =>
        set(state => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      clearAuth: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isInitialized: true });
      },
    }),
    {
      name: 'mangotalk-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
