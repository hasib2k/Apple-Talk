import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
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
import DashboardPage from './pages/DashboardPage';
import LobbyPage from './pages/LobbyPage';
import RoomPage from './pages/RoomPage';

function AuthenticatedGate() {
  const { loading, error, initialize } = useAuth();

  if (loading) {
    return (
      <div className="h-dvh bg-leaf-900 flex flex-col items-center justify-center gap-4" style={{ background: '#0b2417' }}>
        <img src="/logo.png" alt="AppleTalk" className="animate-pulse" style={{ width: 96, height: 96, objectFit: 'contain' }} />
        <p style={{ color: '#8fcea8', fontSize: 14, fontWeight: 500 }}>Loading AppleTalk...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6" style={{ background: '#0b2417' }}>
        <AlertTriangle size={44} color="#f87171" />
        <p style={{ color: '#fff', fontWeight: 600 }}>Could not connect to server</p>
        <p style={{ color: '#8fcea8', fontSize: 14 }}>{error}</p>
        <button onClick={initialize} style={{ marginTop: 8, background: '#84cc16', color: '#1a2e05', fontWeight: 600, padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return <DashboardPage />;
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
          {/* Meeting links — accessible to logged-in users and (dev) guests */}
          <Route path="/room/:code" element={<LobbyPage />} />
          <Route path="/room/:code/live" element={<RoomPage />} />
          <Route path="*" element={<AuthGate />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
