import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';

/**
 * Landing page after Google OAuth redirect.
 * URL: /auth/google/success?accessToken=...&refreshToken=...&userId=...
 *
 * Reads tokens from query string, stores them, fetches full user profile,
 * then redirects to /app.
 */
export default function GoogleAuthSuccess() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      navigate('/', { replace: true });
      return;
    }

    // Store tokens so api interceptor picks them up
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    // Fetch full user profile with the new token
    api.get('/users/me')
      .then(res => {
        setAuth(res.data, { accessToken, refreshToken });
        const redirect = sessionStorage.getItem('google_auth_redirect') || '/';
        sessionStorage.removeItem('google_auth_redirect');
        navigate(redirect, { replace: true });
      })
      .catch(() => {
        navigate('/login', { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight: '100dvh', background: '#05140d',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <img src="/logo.png" alt="AppleTalk" style={{ width: 72, height: 72, objectFit: 'contain', opacity: 0.85 }} className="animate-pulse" />
      <p style={{ color: '#6f9c81', fontSize: 14, fontWeight: 500 }}>Signing you in...</p>
    </div>
  );
}
