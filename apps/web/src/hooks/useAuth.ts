import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { api } from '../lib/api';
import { getDeviceFingerprint } from '../lib/fingerprint';
import { useAuthStore } from '../store/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export function useAuth() {
  const { user, accessToken, setAuth, isInitialized, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(!isInitialized);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    let fingerprint = 'fallback';
    try { fingerprint = await getDeviceFingerprint(); } catch { /* non-secure context */ }
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await api.post('/auth/init', { deviceFingerprint: fingerprint });
        setAuth(data.user, data.tokens);
        setLoading(false);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    console.error('Auth init error:', lastErr);
    setError('Failed to initialize. Please refresh.');
    setLoading(false);
  }, [setAuth]);

  useEffect(() => {
    const storedRefresh = localStorage.getItem('refreshToken');

    const boot = async () => {
      // If a refresh token exists, restore the session first.
      // Use raw axios (not the api instance) to avoid the 401 interceptor
      // redirecting to /login when the stored token is stale.
      if (storedRefresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken: storedRefresh });
          useAuthStore.getState().setAuth(data.user, data.tokens);
          setLoading(false);
          return;
        } catch {
          // refresh token expired/invalid — fall through to fresh init
        }
      }
      await initialize();
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = useCallback(async (updates: { anonAlias?: string }) => {
    const { data } = await api.patch('/users/me', updates);
    updateUser(data);
    return data;
  }, [updateUser]);

  return { user, loading, error, isAuthenticated: !!user, saveProfile, initialize };
}
