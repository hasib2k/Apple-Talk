import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { api } from '../lib/api';
import { getDeviceFingerprint } from '../lib/fingerprint';
import { connectSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth.store';
import { registerPush } from '../lib/push';

const BASE_URL = import.meta.env.VITE_API_URL || '';

let _disconnectHandlerActive = false;
let _sessionReplaced = false;

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
        connectSocket(data.tokens.accessToken);
        registerPush().catch(() => {});
        // If server has no gender but localStorage does, sync it back to the DB.
        // This handles the case where the API call failed silently during onboarding,
        // or the DB was reset while the user's localStorage still had their gender.
        if (!data.user.gender) {
          const localGender = localStorage.getItem('mangotalk_my_gender');
          if (localGender === 'male' || localGender === 'female') {
            api.patch('/users/me', { gender: localGender })
              .then(res => updateUser(res.data))
              .catch(() => {});
          }
        }
        setLoading(false);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
      }
    }
    console.error('Auth init error:', lastErr);
    setError('Failed to initialize. Please refresh.');
    setLoading(false);
  }, [setAuth]);

  useEffect(() => {
    const storedRefresh = localStorage.getItem('refreshToken');

    const boot = async () => {
      // If a refresh token exists, always try to restore the session first.
      // Don't require accessToken in memory — page reload clears that.
      // Use raw axios (not the api instance) to avoid the 401 interceptor redirecting
      // to /login when the stored token is stale — we want to fall through to initialize() instead.
      if (storedRefresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken: storedRefresh });
          const { useAuthStore: store } = await import('../store/auth.store');
          store.getState().setAuth(data.user, data.tokens);
          connectSocket(data.tokens.accessToken);
          registerPush().catch(() => {});
          setLoading(false);
          return data.tokens.accessToken as string;
        } catch {
          // refresh token expired or invalid — fall through to fresh init
        }
      }
      await initialize();
      return useAuthStore.getState().accessToken ?? '';
    };

    boot().then(token => {
      const s = connectSocket(token);

      function onDisconnect(reason: string) {
        if (_sessionReplaced) {
          // Kicked by another tab/device logging in — don't re-initialize
          _sessionReplaced = false;
          return;
        }
        if (reason === 'io server disconnect') initialize();
      }
      function onPremiumUpdated(payload: { isPremium: boolean; premiumUntil: string | null }) {
        useAuthStore.getState().updateUser({ isPremium: payload.isPremium, premiumUntil: payload.premiumUntil ? new Date(payload.premiumUntil) : null });
      }

      s.on('user:premium-updated', onPremiumUpdated);
      if (!_disconnectHandlerActive) {
        _disconnectHandlerActive = true;
        s.on('session:replaced', () => { _sessionReplaced = true; });
        s.on('disconnect', onDisconnect);
      }
    });
    // Don't disconnect on unmount — socket must stay alive across page navigation
  }, []);

  const saveProfile = useCallback(async (updates: { anonAlias?: string; region?: string; gender?: string; interests?: string[] }) => {
    const { data } = await api.patch('/users/me', updates);
    updateUser(data);
    return data;
  }, [updateUser]);

  return { user, loading, error, isAuthenticated: !!user, saveProfile, initialize };
}
