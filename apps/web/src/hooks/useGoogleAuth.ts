import { useCallback } from 'react';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Provides helpers for Google OAuth login / account linking / logout.
 */
export function useGoogleAuth() {
  const { user, clearAuth } = useAuthStore();

  /**
   * Opens Google OAuth consent screen.
   * If the user is already anonymously logged in, passes their userId as `state`
   * so the backend can merge their anonymous data into the Google account.
   */
  const loginWithGoogle = useCallback((redirectTo?: string) => {
    if (redirectTo) sessionStorage.setItem('google_auth_redirect', redirectTo);
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  }, []);

  /**
   * Link current anonymous account to Google.
   * Gets the OAuth URL from backend (with state=userId), then redirects.
   */
  const linkGoogle = useCallback((redirectTo?: string) => {
    if (redirectTo) sessionStorage.setItem('google_auth_redirect', redirectTo);
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  }, []);

  /**
   * Logs out — clears server sessions and local tokens.
   */
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore — clear local anyway */ }
    clearAuth();
    window.location.href = '/';
  }, [clearAuth]);

  return { loginWithGoogle, linkGoogle, logout };
}
