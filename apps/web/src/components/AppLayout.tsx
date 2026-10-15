import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useExitGuard } from '../hooks/useExitGuard';
import { Bell, Mic, Crown, SlidersHorizontal, X,
  Music, Gamepad2, Sparkles, Film, BookOpen, Plane, UtensilsCrossed,
  Trophy, Cpu, Palette, Code2, Dumbbell,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useFriendStore } from '../store/friend.store';
import { useOnlineCount } from '../hooks/useOnlineCount';
import { api } from '../lib/api';
import { useSocketEvent } from '../hooks/useSocket';
import { FriendProfileModal } from './FriendProfileModal';
import { useCallStore } from '../store/call.store';
import { formatDuration } from '../lib/utils';

// ── Shared sub-components ───────────────────────────────────────────────────

function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <img src="/logo.png" alt="AppleTalk" style={{ width: size, height: size, flexShrink: 0 }} />
  );
}

function AvatarBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(150deg,#1f5c3d,#0c2e1d)',
        border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.12)',
        cursor: 'pointer',
      }}
    >
      <img src="/logo.png" alt="profile" style={{ width: 22, height: 22, objectFit: 'contain' }} />
    </button>
  );
}

const FILTER_INTERESTS = [
  { slug: 'music', label: 'Music', icon: Music },
  { slug: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { slug: 'anime', label: 'Anime', icon: Sparkles },
  { slug: 'movies', label: 'Movies', icon: Film },
  { slug: 'books', label: 'Books', icon: BookOpen },
  { slug: 'travel', label: 'Travel', icon: Plane },
  { slug: 'food', label: 'Food', icon: UtensilsCrossed },
  { slug: 'sports', label: 'Sports', icon: Trophy },
  { slug: 'tech', label: 'Tech', icon: Cpu },
  { slug: 'art', label: 'Art', icon: Palette },
  { slug: 'coding', label: 'Coding', icon: Code2 },
  { slug: 'fitness', label: 'Fitness', icon: Dumbbell },
];

// ── AppLayout ───────────────────────────────────────────────────────────────

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { incomingRequests, chatUnread } = useFriendStore();
  const onlineCount = useOnlineCount();
  const { status: callStatus, remoteStream, callStartedAt, callChatUnread } = useCallStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [callElapsed, setCallElapsed] = useState(0);

  // Global audio element for call — persists even when CallPage is unmounted (minimized)
  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = remoteStream ?? null;
  }, [remoteStream]);

  // Timer for the floating call bar
  useEffect(() => {
    if (callStatus !== 'active' || !callStartedAt) return;
    const interval = setInterval(() => setCallElapsed(Math.floor((Date.now() - callStartedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [callStatus, callStartedAt]);

  const [notifOpen, setNotifOpen] = useState(false);

  // Filter state
  const [filterInterests, setFilterInterests] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mangotalk_filter_interests') ?? '[]'); } catch { return []; }
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const activeFilterCount = filterInterests.length > 0 ? 1 : 0;

  useEffect(() => {
    localStorage.setItem('mangotalk_filter_interests', JSON.stringify(filterInterests));
  }, [filterInterests]);

  function toggleFilterInterest(slug: string) {
    setFilterInterests(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  }

  useEffect(() => {
    if (!filterDrawerOpen) return;
    window.history.pushState({ __drawerOpen: true }, '');
    function onPopState() { setFilterDrawerOpen(false); }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [filterDrawerOpen]);
  const [notifications, setNotifications] = useState<
    { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }[]
  >([]);

  const unreadNotifCount = notifications.filter(n => !n.read).length;
  const pendingRequestCount = incomingRequests.length;
  const totalChatUnread = Object.values(chatUnread).reduce((sum, n) => sum + n, 0);
  const friendsBadge = pendingRequestCount + totalChatUnread;

  // Request browser notification permission as soon as the user is logged in
  useEffect(() => {
    if (!user) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get<{ id: string; type: string; title: string; body: string; read: boolean; createdAt: string }[]>(
      '/notifications',
    )
      .then(res => setNotifications(res.data))
      .catch(() => {});
  }, []);

  useSocketEvent('notification:new', (notif) => {
    setNotifications(prev => [notif, ...prev]);
  });

  function openNotifications() {
    setNotifOpen(v => !v);
    if (!notifOpen && unreadNotifCount > 0) {
      api.patch('/notifications/read').catch(() => {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }

  const { showExitModal, isPwa, confirmExit, cancelExit } = useExitGuard();

  const currentPath = location.pathname;
  const isHome = currentPath === '/match';

  // Desktop nav items (no Profile — accessed via avatar)
  const desktopNavItems = [
    { to: '/', label: 'Home' },
    { to: '/match', label: 'Matchmaking' },
    { to: '/friends', label: 'Friends', badge: friendsBadge },
    { to: '/history', label: 'History' },
  ];

  const isPremium = user?.isPremium ?? false;

  // Mobile bottom nav items (4 tabs + 1 center mic)
  const mobileNavLeft: { to: string; label: string; icon: ({ active, isPremium }: { active: boolean; isPremium?: boolean }) => React.ReactElement; badge?: number }[] = [
    { to: '/', label: 'Feed', icon: FeedIcon },
    { to: '/friends', label: 'Friends', icon: FriendsIcon, badge: friendsBadge },
  ];
  const mobileNavRight: { to: string; label: string; icon: ({ active, isPremium }: { active: boolean; isPremium?: boolean }) => React.ReactElement; badge?: number }[] = [
    { to: '/history', label: 'History', icon: HistoryIcon },
    { to: '/profile', label: 'Profile', icon: ProfileIcon },
  ];

  return (
    <div className="h-dvh flex flex-col overflow-hidden relative" style={{ background: '#05140d' }}>
      {/* ── Background atmosphere ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 70% at 50% -8%, rgba(163,230,53,0.20), transparent 55%),' +
            'radial-gradient(90% 60% at 88% 22%, rgba(16,185,129,0.16), transparent 60%),' +
            'radial-gradient(120% 80% at 0% 100%, rgba(88,163,64,0.10), transparent 55%),' +
            'linear-gradient(180deg,#0a2013,#05140d)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.45,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* ══════════ DESKTOP HEADER ══════════ */}
      <header className="hidden lg:flex relative z-20 items-center justify-between px-11 py-6 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <LogoIcon size={42} />
          <span style={{ fontSize: 24, fontWeight: 800, color: '#f4fbe9', letterSpacing: '-0.02em', fontFamily: "'Oxanium', sans-serif" }}>
            Apple<span style={{ color: isPremium ? '#f59e0b' : '#a3e635' }}>Talk</span>
          </span>
        </div>

        {/* Right side — online pill + nav pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

          {/* Online pill — standalone, outside nav pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: isPremium ? 'rgba(245,158,11,0.13)' : 'rgba(163,230,53,0.13)', border: 'none',
            borderRadius: 99, padding: '7px 14px',
          }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: isPremium ? '#f59e0b' : '#a3e635', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: isPremium ? '#fef3c7' : '#d3f099', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {onlineCount.toLocaleString()} online
            </span>
          </div>

          {/* Nav pill */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 99,
              padding: '6px 8px',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.05)',
            }}
          >

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 8, borderRight: '1px solid rgba(255,255,255,0.09)' }}>
            {desktopNavItems.map(({ to, label, badge }) => (
              <Link
                key={to}
                to={to}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 14,
                  fontWeight: currentPath === to ? 800 : 500,
                  color: currentPath === to ? '#1a2e05' : '#aecdba',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  background: currentPath === to ? (isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)') : 'transparent',
                  padding: '7px 16px',
                  borderRadius: 99,
                  transition: 'background 0.25s, color 0.25s',
                }}
              >
                {label}
                {(badge ?? 0) > 0 && (
                  <span style={{
                    minWidth: 16, height: 16, borderRadius: 99,
                    background: '#f59e0b', color: '#fff',
                    fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {(badge ?? 0) > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            ))}

            {/* Premium nav link */}
            <Link
              to="/premium"
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textDecoration: 'none',
                padding: '5px 14px',
                borderRadius: 99,
                background: currentPath === '/premium'
                  ? 'linear-gradient(150deg,#fde68a,#f59e0b)'
                  : isPremium
                    ? 'rgba(245,158,11,0.12)'
                    : 'rgba(245,158,11,0.10)',
                border: currentPath === '/premium' ? 'none' : '1px solid rgba(245,158,11,0.35)',
                transition: 'background 0.25s',
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 14,
                fontWeight: currentPath === '/premium' ? 800 : 600,
                color: currentPath === '/premium' ? '#1a2e05' : '#f59e0b',
                whiteSpace: 'nowrap',
              }}>
                <Crown size={13} color={currentPath === '/premium' ? '#92400e' : '#f59e0b'} />
                Premium
              </span>
              {isPremium && (
                <span style={{ fontSize: 9, color: currentPath === '/premium' ? '#92400e' : '#d97706', fontWeight: 600, lineHeight: 1, marginTop: 1 }}>
                  Current plan
                </span>
              )}
            </Link>
          </div>

          {/* Interests filter button (desktop) */}
          <div className="relative">
            <button
              onClick={() => setFilterDrawerOpen(v => !v)}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: activeFilterCount > 0 ? (isPremium ? 'rgba(245,158,11,0.12)' : 'rgba(163,230,53,0.12)') : 'rgba(255,255,255,0.05)',
                border: activeFilterCount > 0 ? `1px solid ${isPremium ? 'rgba(245,158,11,0.4)' : 'rgba(163,230,53,0.4)'}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={16} color="#c5e88a" strokeWidth={2.2} />
            </button>
            {filterInterests.length > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, background: isPremium ? '#f59e0b' : '#a3e635', color: '#1a2e05', fontSize: 9, fontWeight: 700, borderRadius: 99, width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {filterInterests.length}
              </span>
            )}
          </div>

          {/* Bell */}
          <div className="relative">
            <button
              onClick={openNotifications}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <Bell size={17} color="#c5e88a" strokeWidth={2} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            {notifOpen && <NotifDropdown notifications={notifications} onClose={() => setNotifOpen(false)} />}
          </div>

          {/* Profile */}
          <Link
            to="/profile"
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: currentPath === '/profile' ? (isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)') : 'rgba(255,255,255,0.05)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none', transition: 'background 0.25s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={currentPath === '/profile' ? '#1a2e05' : '#c5e88a'}>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7" />
            </svg>
          </Link>

          </div>{/* end nav pill */}
        </div>{/* end right side */}
      </header>

      {/* ══════════ MOBILE HEADER ══════════ */}
      <header className="lg:hidden relative z-20 flex flex-col shrink-0 px-5 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}>
        {/* Row 1: logo + interests slot + avatar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={36} />
            <span style={{ fontSize: 20, fontWeight: 800, color: '#f4fbe9', letterSpacing: '-0.02em', fontFamily: "'Oxanium', sans-serif" }}>
              Apple<span style={{ color: isPremium ? '#f59e0b' : '#a3e635' }}>Talk</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Crown — navigate to Premium */}
            <Link
              to="/premium"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Crown size={16} color="#f59e0b" />
            </Link>
            {/* Interests filter button (mobile) */}
            <button
              onClick={() => setFilterDrawerOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: activeFilterCount > 0 ? (isPremium ? 'rgba(245,158,11,0.12)' : 'rgba(163,230,53,0.12)') : 'rgba(255,255,255,0.07)',
                border: activeFilterCount > 0 ? `1px solid ${isPremium ? 'rgba(245,158,11,0.4)' : 'rgba(163,230,53,0.4)'}` : 'none',
                cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={14} color="#c5e88a" strokeWidth={2.4} />
              {filterInterests.length > 0 && (
                <span style={{ background: isPremium ? '#f59e0b' : '#a3e635', color: '#1a2e05', fontSize: 9, fontWeight: 700, borderRadius: 99, width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {filterInterests.length}
                </span>
              )}
            </button>
            {/* Bell */}
            <div className="relative">
              <button
                onClick={openNotifications}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <Bell size={17} color="#c5e88a" strokeWidth={2} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotifDropdown notifications={notifications} onClose={() => setNotifOpen(false)} />}
            </div>
          </div>
        </div>
      </header>

      {/* ── Global audio for call (persists when CallPage is minimized) ── */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* ── Floating call bar (shown when call is active but user is elsewhere) ── */}
      {callStatus === 'active' && location.pathname !== '/call' && (
        <div
          onClick={() => navigate('/call')}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#16a34a',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            height: 'calc(44px + env(safe-area-inset-top, 0px))',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            gap: 10, paddingBottom: 10,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(22,163,74,0.4)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '0.01em' }}>Touch to return to call</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: "'Oxanium', sans-serif", fontWeight: 700 }}>{formatDuration(callElapsed)}</span>
          {callChatUnread > 0 && (
            <span style={{ minWidth: 18, height: 18, borderRadius: 99, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
              {callChatUnread > 9 ? '9+' : callChatUnread}
            </span>
          )}
        </div>
      )}

      {/* ── Page content ── */}
      <main className="flex-1 relative min-h-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>

      {/* ══════════ FILTER DRAWER ══════════ */}
      {filterDrawerOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setFilterDrawerOpen(false)} style={{ backdropFilter: 'blur(4px)' }} />}
      <div
        className={`fixed top-0 left-0 right-0 z-50 flex flex-col transition-transform duration-300 ${filterDrawerOpen ? 'translate-y-0' : '-translate-y-full'}`}
        style={{ height: '50dvh', background: 'rgba(9,26,17,0.97)', borderBottom: `1px solid ${isPremium ? 'rgba(245,158,11,0.15)' : 'rgba(163,230,53,0.15)'}`, borderRadius: '0 0 24px 24px', backdropFilter: 'blur(20px)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      >
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={15} color={isPremium ? '#f59e0b' : '#a3e635'} strokeWidth={2} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f4fbe9' }}>Interests Filter</span>
            {filterInterests.length > 0 && (
              <span style={{ minWidth: 18, height: 18, borderRadius: 99, background: isPremium ? '#f59e0b' : '#a3e635', color: '#1a2e05', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                {filterInterests.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {filterInterests.length > 0 && (
              <button onClick={() => setFilterInterests([])} style={{ fontSize: 12, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Reset</button>
            )}
            <button onClick={() => setFilterDrawerOpen(false)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={15} color="#8fcea8" />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#8fcea8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Select interests to match with similar people
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FILTER_INTERESTS.map(i => (
              <button
                key={i.slug}
                onClick={() => toggleFilterInterest(i.slug)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 13px', borderRadius: 99,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  background: filterInterests.includes(i.slug) ? (isPremium ? 'rgba(245,158,11,0.15)' : 'rgba(163,230,53,0.15)') : 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${filterInterests.includes(i.slug) ? (isPremium ? 'rgba(245,158,11,0.5)' : 'rgba(163,230,53,0.5)') : 'rgba(255,255,255,0.09)'}`,
                  color: filterInterests.includes(i.slug) ? (isPremium ? '#f59e0b' : '#a3e635') : '#8fcea8',
                }}
              >
                <i.icon size={11} />
                <span>{i.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: '12px 20px 20px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setFilterDrawerOpen(false)}
            style={{ background: isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)', border: 'none', borderRadius: 99, padding: '11px 40px', fontSize: 14, fontWeight: 700, color: '#1a2e05', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'none' }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* ══════════ FRIEND PROFILE MODAL ══════════ */}
      <FriendProfileModal />

      {/* ══════════ EXIT GUARD MODAL ══════════ */}
      {showExitModal && (
        <div
          className="fixed inset-0 z-[999] flex items-end justify-center pb-10 px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={cancelExit}
        >
          <div
            className="w-full max-w-xs rounded-2xl overflow-hidden"
            style={{ background: '#0d2318', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-white font-semibold text-base mb-1">Exit App?</p>
              <p className="text-zinc-400 text-sm">You can come back anytime.</p>
            </div>
            <div className="flex border-t border-white/8">
              <button
                onClick={cancelExit}
                className="flex-1 py-3.5 text-sm font-semibold text-zinc-300 hover:bg-white/5 transition-colors"
              >
                Stay
              </button>
              <div className="w-px bg-white/8" />
              <button
                onClick={confirmExit}
                className="flex-1 py-3.5 text-sm font-semibold text-red-400 hover:bg-white/5 transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MOBILE FLOATING BOTTOM NAV ══════════ */}
      <div className="lg:hidden fixed left-0 right-0 z-20 px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', pointerEvents: 'none' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 26px',
            borderRadius: 26,
            background: 'rgba(9,26,17,0.96)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 -2px 30px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.06)',
            pointerEvents: 'auto',
          }}
        >
          {/* Left tabs */}
          {mobileNavLeft.map(({ to, label, icon: Icon, badge }) => {
            const isActive = currentPath === to;
            return (
              <Link
                key={to}
                to={to}
                replace
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textDecoration: 'none', position: 'relative' }}
              >
                <div className="relative">
                  <Icon active={isActive} isPremium={isPremium} />
                  {(badge ?? 0) > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -6,
                      minWidth: 14, height: 14, borderRadius: 99,
                      background: '#f59e0b', color: '#fff',
                      fontSize: 8, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px',
                    }}>
                      {(badge ?? 0) > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500, color: isActive ? (isPremium ? '#f59e0b' : '#a3e635') : '#6f9c81', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Center mic button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: -34 }}>
            <button
              onClick={() => navigate('/match')}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: isPremium ? 'linear-gradient(160deg,#fde68a,#f59e0b 60%,#b45309)' : 'linear-gradient(160deg,#bef264,#84cc16 60%,#65a30d)',
                border: '4px solid #091a11',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'none',
                cursor: 'pointer',
              }}
            >
              <Mic size={25} color="#1a2e05" strokeWidth={2.3} />
            </button>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#6f9c81', whiteSpace: 'nowrap', letterSpacing: '0.03em', fontFamily: "'Oxanium', sans-serif" }}>
              Matchmaking
            </span>
          </div>

          {/* Right tabs */}
          {mobileNavRight.map(({ to, label, icon: Icon, badge }) => {
            const isActive = currentPath === to;
            return (
              <Link
                key={to}
                to={to}
                replace
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textDecoration: 'none', position: 'relative' }}
              >
                <div className="relative">
                  <Icon active={isActive} isPremium={isPremium} />
                  {(badge ?? 0) > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 99, background: '#f59e0b', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                      {(badge ?? 0) > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500, color: isActive ? (isPremium ? '#f59e0b' : '#a3e635') : '#6f9c81', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Nav icon components ─────────────────────────────────────────────────────

function FeedIcon({ active, isPremium }: { active: boolean; isPremium?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? (isPremium ? '#f59e0b' : '#a3e635') : '#6f9c81'} strokeWidth="2">
      <path d="M4 6h16M4 10h16M4 14h10M4 18h8" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon({ active, isPremium }: { active: boolean; isPremium?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? (isPremium ? '#f59e0b' : '#a3e635') : '#6f9c81'} strokeWidth="2.3">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function FriendsIcon({ active, isPremium }: { active: boolean; isPremium?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? (isPremium ? '#f59e0b' : '#a3e635') : '#6f9c81'} strokeWidth="2">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="17" cy="8" r="2.6" />
      <path d="M16 15c2.8.3 5 2.4 5 5" />
    </svg>
  );
}

function HistoryIcon({ active, isPremium }: { active: boolean; isPremium?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? (isPremium ? '#f59e0b' : '#a3e635') : '#6f9c81'} strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function ProfileIcon({ active, isPremium }: { active: boolean; isPremium?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? (isPremium ? '#f59e0b' : '#a3e635') : '#6f9c81'} strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7" />
    </svg>
  );
}

// ── Notification dropdown ───────────────────────────────────────────────────

function NotifDropdown({
  notifications,
  onClose,
}: {
  notifications: { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-11 z-40 w-72 rounded-2xl shadow-xl overflow-hidden"
        style={{ background: 'rgba(9,26,17,0.95)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(12px)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-semibold" style={{ color: '#f4fbe9' }}>Notifications</p>
          {notifications.some(n => !n.read) && (
            <button
              onClick={() => { api.patch('/notifications/read').catch(() => {}); onClose(); }}
              className="text-xs transition-colors"
              style={{ color: '#8fcea8' }}
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#8fcea8' }}>No notifications yet</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="px-4 py-3 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.07)', background: !n.read ? 'rgba(163,230,53,0.05)' : 'transparent' }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: n.type === 'subscription_approved' ? '#4ade80' : '#f87171' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#f4fbe9' }}>{n.title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#8fcea8' }}>{n.body}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(143,206,168,0.5)' }}>{new Date(n.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
