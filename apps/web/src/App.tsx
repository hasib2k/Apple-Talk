import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/auth.store';
import { useFriendStore } from './store/friend.store';
import { useCallStore } from './store/call.store';
import { useFriendSocket } from './hooks/useFriendSocket';
import { useSocket, useSocketEvent } from './hooks/useSocket';
import { FriendRequestToast } from './components/FriendRequestToast';
import { FriendCallToast } from './components/FriendCallToast';
import { Wifi, Phone, X } from 'lucide-react';
import { AppLayout } from './components/AppLayout';
import { InAppBrowserOverlay } from './components/InAppBrowserOverlay';
import LandingPage from './pages/LandingPage';
import FaqPage from './pages/FaqPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import FriendsPage from './pages/FriendsPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import CallPage from './pages/CallPage';
import AdminPage from './pages/AdminPage';
import PremiumPage from './pages/PremiumPage';
import FeedPage from './pages/FeedPage';
import GoogleAuthSuccess from './pages/GoogleAuthSuccess';
import PostDetailPage from './pages/PostDetailPage';
import SpikePage from './pages/SpikePage';

function AppRoutes() {
  const socket = useSocket();
  const navigate = useNavigate();

  // Active friend socket listeners (runs globally for all pages)
  useFriendSocket();

  // Global: handle partner leaving while call is minimized
  // (when NOT minimized, useMatchmaking in CallPage handles it)
  useSocketEvent('call:partner-left', () => {
    const store = useCallStore.getState();
    if (!store.isMinimized) return;

    const isFriendCall = store.isFriendCall;
    store.reset();
    store.stopLocalStream();

    if (isFriendCall) {
      // Friend call: just clear state — floating bar disappears, user stays where they are
      return;
    }

    // Random matchmaking: auto re-queue and navigate back to /call
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    const filterInterests = (() => { try { return JSON.parse(localStorage.getItem('mangotalk_filter_interests') ?? '[]') as string[]; } catch { return [] as string[]; } })();
    const interests = filterInterests.length > 0 ? filterInterests : ((currentUser.interests as string[]) ?? []);
    const wantGender = (() => { if (!currentUser.isPremium) return null; const fg = localStorage.getItem('mangotalk_filter_gender'); return fg && fg !== 'both' ? fg : null; })();
    useCallStore.getState().setStatus('queued');
    socket.emit('matchmaking:join', {
      interests,
      region: currentUser.region ?? null,
      isPremium: currentUser.isPremium ?? false,
      purpose: localStorage.getItem('mangotalk_purpose') ?? undefined,
      wantGender,
    });
    navigate('/call');
  });

  // Global: store all incoming call chat messages so they persist across minimize/maximize
  useSocketEvent('call:chat', ({ text, time }) => {
    const store = useCallStore.getState();
    store.addCallChatMessage({ id: Date.now().toString() + Math.random(), sender: 'them', text, time });
    if (store.isMinimized) {
      useCallStore.setState(s => ({ callChatUnread: s.callChatUnread + 1 }));
    }
  });

  const { incomingRequests, removeIncomingRequest, addFriendFromAccept, incomingFriendCall, setIncomingFriendCall, setPendingFriendCallAccept, friendOnlineNotif, setFriendOnlineNotif, outgoingFriendCall, setOutgoingFriendCall } = useFriendStore();

  const [dismissedToastIds, setDismissedToastIds] = useState<Set<string>>(new Set());
  const [declinedToast, setDeclinedToast] = useState<string | null>(null);
  const [callKey, setCallKey] = useState(0);

  // Auto-dismiss friend online notification after 4s
  useEffect(() => {
    if (!friendOnlineNotif) return;
    const t = setTimeout(() => setFriendOnlineNotif(null), 4000);
    return () => clearTimeout(t);
  }, [friendOnlineNotif]);

  // Show first non-dismissed request as toast
  const activeToast = incomingRequests.find(r => !dismissedToastIds.has(r.id)) ?? null;

  function handleDismissToast(requesterId: string) {
    setDismissedToastIds(prev => new Set([...prev, requesterId]));
  }

  function handleAccept(requesterId: string) {
    const req = incomingRequests.find(r => r.id === requesterId);
    if (req) addFriendFromAccept({ id: req.id, alias: req.alias });
    removeIncomingRequest(requesterId);
    setDismissedToastIds(prev => { const s = new Set(prev); s.delete(requesterId); return s; });
    socket.emit('friend:respond', { requesterId, accept: true });
  }

  function handleReject(requesterId: string) {
    removeIncomingRequest(requesterId);
    setDismissedToastIds(prev => { const s = new Set(prev); s.delete(requesterId); return s; });
    socket.emit('friend:respond', { requesterId, accept: false });
  }

  // Ref keeps the latest outgoingFriendCall value synchronously — avoids race condition
  // where cancel clears state (removing the listener) before matchmaking:matched arrives
  const outgoingCallRef = useRef(outgoingFriendCall);
  useEffect(() => { outgoingCallRef.current = outgoingFriendCall; }, [outgoingFriendCall]);

  // Always-active listener — uses ref so it survives state changes without re-registering
  useEffect(() => {
    function onMatched(data: { roomId: string; partnerId: string; partnerAlias: string; peerType: 'initiator' | 'receiver'; partnerRegion?: string | null; partnerGender?: string | null; partnerIsPremium?: boolean; partnerIsLinked?: boolean }) {
      if (!outgoingCallRef.current) return; // not a friend call, ignore
      outgoingCallRef.current = null; // prevent double-handling
      const store = useCallStore.getState();
      store.setMatched(data.roomId, data.partnerId, data.partnerAlias, data.peerType, data.partnerRegion ?? undefined, data.partnerGender ?? null, data.partnerIsPremium ?? false, data.partnerIsLinked ?? false);
      store.setIsFriendCall(true);
      socket.emit('call:ready', { roomId: data.roomId });
      setOutgoingFriendCall(null);
      navigate('/call');
    }

    function onDeclined() {
      if (!outgoingCallRef.current) return;
      const alias = outgoingCallRef.current.toAlias;
      outgoingCallRef.current = null;
      setOutgoingFriendCall(null);
      setDeclinedToast(alias);
      setTimeout(() => setDeclinedToast(null), 3000);
    }

    socket.on('matchmaking:matched', onMatched);
    socket.on('friend:call-declined', onDeclined);
    return () => {
      socket.off('matchmaking:matched', onMatched);
      socket.off('friend:call-declined', onDeclined);
    };
  }, [socket]); // only re-registers when socket changes, not on every outgoingFriendCall update

  // Auto-cancel outgoing call after 30s (handles disconnects / unresponsive receivers)
  useEffect(() => {
    if (!outgoingFriendCall) return;
    const timer = setTimeout(() => {
      socket.emit('friend:call-cancel', { targetUserId: outgoingFriendCall.toId });
      outgoingCallRef.current = null;
      setOutgoingFriendCall(null);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [outgoingFriendCall]);

  function handleCancelOutgoingCall() {
    if (!outgoingFriendCall) return;
    socket.emit('friend:call-cancel', { targetUserId: outgoingFriendCall.toId });
    outgoingCallRef.current = null; // clear synchronously before state update triggers re-render
    setOutgoingFriendCall(null);
  }

  function handleFriendCallAccept(fromId: string) {
    setIncomingFriendCall(null);
    const callState = useCallStore.getState();
    if (callState.status !== 'idle') {
      // Properly end the current call so the old partner gets notified
      if (callState.roomId) {
        socket.emit('call:end', { roomId: callState.roomId, reason: 'hangup' });
      }
      callState.reset();
    }
    setPendingFriendCallAccept(fromId);
    setCallKey(k => k + 1); // force CallPage remount so useEffect[] re-runs
    navigate('/call');
  }

  function handleFriendCallDecline(fromId: string) {
    setIncomingFriendCall(null);
    socket.emit('friend:call-decline', { callerId: fromId });
  }

  return (
    <>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/match" replace />} />
          <Route path="/match" element={<HomePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/app" element={<Navigate to="/match" replace />} />
          <Route path="/home" element={<Navigate to="/match" replace />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/post/:id" element={<PostDetailPage />} />
        </Route>
        <Route path="/call" element={<CallPage key={callKey} />} />
        <Route path="*" element={<Navigate to="/match" replace />} />
      </Routes>

      {activeToast && (
        <FriendRequestToast
          key={activeToast.id}
          request={activeToast}
          onAccept={handleAccept}
          onReject={handleReject}
          onDismiss={handleDismissToast}
        />
      )}

      {incomingFriendCall && (
        <FriendCallToast
          call={incomingFriendCall}
          onAccept={handleFriendCallAccept}
          onDecline={handleFriendCallDecline}
        />
      )}

      {friendOnlineNotif && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-leaf-800 rounded-2xl px-4 py-3 shadow-xl animate-slide-up" style={{ top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))' }}>
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <Wifi size={14} className="text-green-400 shrink-0" />
          <span className="text-sm text-white font-medium whitespace-nowrap">
            <span className="text-mango-400">{friendOnlineNotif.alias}</span> is online
          </span>
          <button onClick={() => setFriendOnlineNotif(null)} className="ml-1 text-leaf-400 hover:text-white transition-colors text-xs">✕</button>
        </div>
      )}

      {/* Outgoing friend call overlay */}
      {outgoingFriendCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-leaf-800 rounded-3xl px-8 py-8 flex flex-col items-center gap-5 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-mango-500/20 border-2 border-mango-500/40 flex items-center justify-center animate-pulse">
              <Phone size={28} className="text-mango-400" />
            </div>
            <div className="text-center">
              <p className="text-white/50 text-sm">Calling</p>
              <p className="text-white font-bold text-lg">{outgoingFriendCall.toAlias}</p>
            </div>
            <button
              onClick={handleCancelOutgoingCall}
              className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 px-5 py-2.5 rounded-full text-sm transition-all"
            >
              <X size={15} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Declined toast */}
      {declinedToast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 rounded-2xl px-4 py-3 shadow-xl animate-slide-up whitespace-nowrap" style={{ top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))' }}>
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <span className="text-sm text-white"><span className="text-mango-400">{declinedToast}</span> is not available right now</span>
        </div>
      )}
    </>
  );
}

function AuthenticatedGate() {
  const { loading, error, initialize } = useAuth();

  if (loading) {
    return (
      <div className="h-dvh bg-leaf-900 flex flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="AppleTalk" className="animate-pulse" style={{ width: 96, height: 96, objectFit: 'contain' }} />
        <p className="text-leaf-300 text-sm font-medium">Loading AppleTalk...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh bg-leaf-900 flex flex-col items-center justify-center gap-4 px-6">
        <span className="text-5xl">⚠️</span>
        <p className="text-white font-semibold text-center">Could not connect to server</p>
        <p className="text-leaf-400 text-sm text-center">{error}</p>
        <button
          onClick={initialize}
          className="mt-2 bg-mango-500 hover:bg-mango-600 text-white font-semibold px-6 py-3 rounded-full text-sm transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return <AppRoutes />;
}

function AuthGate() {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  // Google-linked users stay logged in (7-day token)
  if (user?.isLinked) {
    return <AuthenticatedGate />;
  }

  // Anonymous users must pass through login page on each new browser session
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
          <Route path="/spike" element={<SpikePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/auth/google/success" element={<GoogleAuthSuccess />} />
          <Route path="*" element={<AuthGate />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
