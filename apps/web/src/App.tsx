import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/auth.store';
import { InAppBrowserOverlay } from './components/InAppBrowserOverlay';
import LandingPage from './pages/LandingPage';
import FaqPage from './pages/FaqPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import GoogleAuthSuccess from './pages/GoogleAuthSuccess';

// Placeholder home for the authenticated area.
// Phase 3 replaces this with the Google-Meet-style dashboard.
function HomePlaceholder() {
  const { user } = useAuthStore();
  return (
    <div style={{ minHeight: '100dvh', background: '#05140d', color: '#f4fbe9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'system-ui' }}>
      <img src="/logo.png" alt="AppleTalk" style={{ width: 72, height: 72, objectFit: 'contain' }} />
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>AppleTalk</h1>
      <p style={{ color: '#8fcea8' }}>Signed in as <b style={{ color: '#a3e635' }}>{user?.anonAlias ?? 'guest'}</b></p>
      <p style={{ color: '#6f9c81', fontSize: 14 }}>Meeting dashboard coming in Phase 3.</p>
    </div>
  );
}

function AuthenticatedGate() {
  const { loading, error, initialize } = useAuth();

  if (loading) {
    return (
      <div className="h-dvh bg-leaf-900 flex flex-col items-center justify-center gap-4" style={{ background: '#05140d' }}>
        <img src="/logo.png" alt="AppleTalk" className="animate-pulse" style={{ width: 96, height: 96, objectFit: 'contain' }} />
        <p style={{ color: '#8fcea8', fontSize: 14, fontWeight: 500 }}>Loading AppleTalk...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6" style={{ background: '#05140d' }}>
        <span style={{ fontSize: 48 }}>⚠️</span>
        <p style={{ color: '#fff', fontWeight: 600 }}>Could not connect to server</p>
        <p style={{ color: '#8fcea8', fontSize: 14 }}>{error}</p>
        <button onClick={initialize} style={{ marginTop: 8, background: '#84cc16', color: '#1a2e05', fontWeight: 600, padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return <HomePlaceholder />;
}

function AuthGate() {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  // Google-linked users stay logged in; anonymous/guest must pass the login page each session.
  if (user?.isLinked) {
    return <AuthenticatedGate />;
  }
  if (localStorage.getItem('anon_session_active') !== 'true') {
    return <Navigate to="/login" replace />;
  }
  return <AuthenticatedGate />;
}

export default function App() {
  return (
    <>
      <InAppBrowserOverlay />
      <BrowserRouter>
        <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/about" element={<LandingPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/auth/google/success" element={<GoogleAuthSuccess />} />
          <Route path="*" element={<AuthGate />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
