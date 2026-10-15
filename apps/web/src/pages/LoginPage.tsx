import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';
import { getDeviceFingerprint } from '../lib/fingerprint';
import { usePwaInstall } from '../hooks/usePwaInstall';

const API_BASE = import.meta.env.VITE_API_URL || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const { accessToken, user, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [loadingAnon, setLoadingAnon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { canInstall, triggerInstall } = usePwaInstall();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    type GoogleAccounts = { accounts: { id: { initialize: (cfg: object) => void; prompt: () => void } } };

    function initOneTap() {
      const g = (window as { google?: GoogleAccounts }).google;
      if (!g) return;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            const { data } = await api.post('/auth/google/one-tap', { credential: response.credential });
            setAuth(data.user, data.tokens);
            localStorage.setItem('anon_session_active', 'true');
            navigate('/', { replace: true });
          } catch {
            setError('Google sign-in failed. Please try again.');
          }
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (g.accounts.id.prompt as any)((notification: any) => {
        if (notification.isNotDisplayed()) {
          console.log('[OneTap] not displayed:', notification.getNotDisplayedReason());
        } else if (notification.isSkippedMoment()) {
          console.log('[OneTap] skipped:', notification.getSkippedReason());
        }
      });
    }

    // If the GSI script already finished loading, init immediately
    if ((window as { google?: GoogleAccounts }).google) {
      initOneTap();
      return;
    }

    // Otherwise wait for the script to load
    const script = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi/client"]');
    if (!script) return;
    script.addEventListener('load', initOneTap);
    return () => script.removeEventListener('load', initOneTap);
  }, [navigate, setAuth]);

  // Google users: always let through. Anonymous users: only if they passed gate this session.
  if (accessToken && (user?.isLinked || localStorage.getItem('anon_session_active') === 'true')) {
    return <Navigate to="/" replace />;
  }

  async function handleAnonymous() {
    setLoadingAnon(true);
    setError(null);
    try {
      let fingerprint = 'fallback';
      try { fingerprint = await getDeviceFingerprint(); } catch { /* non-secure context */ }
      const { data } = await api.post('/auth/init', { deviceFingerprint: fingerprint });
      setAuth(data.user, data.tokens);
      localStorage.setItem('anon_session_active', 'true');
      navigate('/', { replace: true });
    } catch {
      setError('Failed to connect. Please try again.');
      setLoadingAnon(false);
    }
  }

  function handleGoogle() {
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  }

  return (
    <div className="h-dvh bg-leaf-900 flex relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-mango-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Install button — top right */}
      {canInstall && (
        <button
          onClick={triggerInstall}
          className="absolute top-4 right-4 z-10 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 border border-white/12 text-leaf-300 text-xs font-semibold hover:border-white/25 hover:text-white transition-all"
        >
          📲 Install App
        </button>
      )}

      {/* ── Desktop left panel: branding ── */}
      <div className="hidden lg:flex flex-col flex-1 items-center justify-center px-16 relative border-r border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-leaf-800/40 to-transparent pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-mango-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center gap-10 max-w-sm">
          <img src="/logo.png" alt="AppleTalk" className="w-28 h-28 object-contain drop-shadow-2xl" />
          <div>
            <h1 className="text-white text-4xl font-bold tracking-tight mb-3">AppleTalk</h1>
            <p className="text-leaf-400 text-base leading-relaxed">
              Connect with strangers.<br />Make real friends.
            </p>
          </div>
          <div className="flex flex-col gap-3.5 text-left w-full">
            {[
              { icon: '🎙️', text: 'Anonymous voice calls — no camera' },
              { icon: '🌍', text: 'Match by interests & region' },
              { icon: '👥', text: 'Build real friendships' },
              { icon: '✨', text: 'No judgment, just real conversations' },
              { icon: '🔒', text: '100% free, forever' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-xl shrink-0">{icon}</span>
                <span className="text-leaf-300 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (form) — full width on mobile, fixed width on desktop ── */}
      <div className="flex flex-col items-center justify-center px-6 relative flex-1 lg:flex-none lg:w-[460px] lg:shrink-0">

        {/* Logo + branding — mobile only */}
        <div className="flex flex-col items-center mb-10 lg:hidden">
          <img src="/logo.png" alt="AppleTalk" className="w-20 h-20 object-contain mb-4 drop-shadow-lg" />
          <h1 className="text-white text-2xl font-bold tracking-tight mb-1">AppleTalk</h1>
          <p className="text-leaf-400 text-sm text-center max-w-xs">
            Connect with strangers. Make real friends.
          </p>
        </div>

        {/* Desktop heading */}
        <div className="hidden lg:block mb-8 text-center w-full max-w-xs">
          <h2 className="text-white text-2xl font-bold mb-2">Welcome back</h2>
          <p className="text-leaf-400 text-sm">Sign in to continue to AppleTalk</p>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={handleGoogle}
            className="flex items-center justify-center gap-3 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 font-semibold px-5 py-3.5 rounded-2xl text-sm transition-all shadow-lg"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <button
            onClick={handleAnonymous}
            disabled={loadingAnon}
            className="flex items-center justify-center gap-3 bg-leaf-700 hover:bg-leaf-600 active:bg-leaf-600 border border-leaf-600 text-white font-semibold px-5 py-3.5 rounded-2xl text-sm transition-all disabled:opacity-60"
          >
            {loadingAnon ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <span className="text-base">👤</span>
                Continue without login
              </>
            )}
          </button>

          {/* Feature comparison hint */}
          <div className="mt-1 rounded-2xl bg-white/5 border border-white/8 px-4 py-3 flex flex-col gap-2.5 text-xs">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-mango-400">🔓</span>
              <div>
                <span className="text-white font-semibold">With Google login</span>
                <div className="text-white/60 mt-0.5">Premium Features · Random Call/Chat · Friends list · Profile · Feed posts · Saved history</div>
              </div>
            </div>
            <div className="w-full h-px bg-white/8" />
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-leaf-400">👤</span>
              <div>
                <span className="text-white/70 font-semibold">Without login</span>
                <div className="text-white/40 mt-0.5">Random Call/Chat · Friends list · Feed View Only · No Premium Features</div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}
        </div>

        {/* About */}
        <button
          onClick={() => navigate('/about')}
          className="mt-8 text-leaf-400 hover:text-mango-400 text-sm transition-colors underline underline-offset-2"
        >
          About AppleTalk
        </button>
      </div>
    </div>
  );
}
