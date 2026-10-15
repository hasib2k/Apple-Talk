import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, Crown, ChevronRight, Edit3,
  Music, Gamepad2, Sparkles, Film, BookOpen, Plane, UtensilsCrossed,
  Trophy, Cpu, Palette, Code2, Dumbbell,
  Phone, Mic, History, Zap, Users, Flame, Target,
  Trash2, AlertTriangle, LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { useFriendStore } from '../store/friend.store';
import { api } from '../lib/api';
import { RowSkeleton } from '../components/Shimmer';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { usePwaInstall } from '../hooks/usePwaInstall';

interface CallHistoryEntry {
  id: string;
  partnerId: string;
  partnerAlias: string;
  durationSecs: number;
  startedAt: string;
}

const INTERESTS: { slug: string; label: string; icon: LucideIcon }[] = [
  { slug: 'music',   label: 'Music',   icon: Music },
  { slug: 'gaming',  label: 'Gaming',  icon: Gamepad2 },
  { slug: 'anime',   label: 'Anime',   icon: Sparkles },
  { slug: 'movies',  label: 'Movies',  icon: Film },
  { slug: 'books',   label: 'Books',   icon: BookOpen },
  { slug: 'travel',  label: 'Travel',  icon: Plane },
  { slug: 'food',    label: 'Food',    icon: UtensilsCrossed },
  { slug: 'sports',  label: 'Sports',  icon: Trophy },
  { slug: 'tech',    label: 'Tech',    icon: Cpu },
  { slug: 'art',     label: 'Art',     icon: Palette },
  { slug: 'coding',  label: 'Coding',  icon: Code2 },
  { slug: 'fitness', label: 'Fitness', icon: Dumbbell },
];

function GoogleIconSm() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function AvatarBubble({ size = 'lg', premium = false }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; premium?: boolean }) {
  const px = size === 'xl' ? 100 : size === 'lg' ? 80 : size === 'sm' ? 36 : 44;
  const imgPx = size === 'xl' ? 60 : size === 'lg' ? 48 : size === 'sm' ? 22 : 28;
  return (
    <div style={{ width: px, height: px, borderRadius: '50%', background: 'linear-gradient(135deg,#1f5c3d,#0c2e1d)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: premium ? '2px solid #f59e0b' : '2px solid rgba(163,230,53,0.2)', flexShrink: 0, boxShadow: premium ? '0 0 12px rgba(245,158,11,0.4)' : undefined }}>
      <img src="/logo.png" alt="user" style={{ width: imgPx, height: imgPx, objectFit: 'contain' }} />
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { saveProfile } = useAuth();
  const { friends, loadFriends } = useFriendStore();
  const { linkGoogle, logout } = useGoogleAuth();
  const { canInstall, triggerInstall } = usePwaInstall();

  const isPremium    = user?.isPremium ?? false;
  const accent       = isPremium ? '#f59e0b' : '#a3e635';
  const accentBg     = isPremium ? 'rgba(245,158,11,0.10)' : 'rgba(163,230,53,0.10)';
  const accentBorder = isPremium ? 'rgba(245,158,11,0.30)' : 'rgba(163,230,53,0.30)';
  const accentGrad   = isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)';
  const accentLight  = isPremium ? '#fef3c7' : '#d3f099';

  const [isEditing, setIsEditing] = useState(false);
  const [alias, setAlias] = useState(user?.anonAlias ?? '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>((user?.interests as string[]) ?? []);
  const [saving, setSaving] = useState(false);
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const interests = user?.interests as string[] | undefined;

  useEffect(() => {
    api.get<CallHistoryEntry[]>('/calls/history')
      .then(r => setCallHistory(r.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
    loadFriends();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalCalls = callHistory.length;
  const totalMins  = Math.floor(callHistory.reduce((s, e) => s + e.durationSecs, 0) / 60);
  const longestMin = Math.floor(Math.max(0, ...callHistory.map(e => e.durationSecs)) / 60);
  const avgMins    = totalCalls > 0 ? Math.floor(totalMins / totalCalls) : 0;

  const callStreak = (() => {
    if (!callHistory.length) return 0;
    const days = new Set(callHistory.map(e => new Date(e.startedAt).toDateString()));
    let s = 0; const cur = new Date();
    while (days.has(cur.toDateString())) { s++; cur.setDate(cur.getDate() - 1); }
    return s;
  })();

  const callsToday = callHistory.filter(e => new Date(e.startedAt).toDateString() === new Date().toDateString()).length;
  const dailyGoal  = 3;

  const ACHIEVEMENTS: { id: string; label: string; icon: LucideIcon; unlocked: boolean }[] = [
    { id: 'first_call',   label: 'First Call',   icon: Phone,   unlocked: totalCalls >= 1 },
    { id: 'calls_5',      label: '5 Calls',       icon: Mic,     unlocked: totalCalls >= 5 },
    { id: 'calls_10',     label: '10 Calls',      icon: Mic,     unlocked: totalCalls >= 10 },
    { id: 'first_friend', label: 'First Friend',  icon: Users,   unlocked: friends.length >= 1 },
    { id: 'friends_5',    label: '5 Friends',     icon: Users,   unlocked: friends.length >= 5 },
    { id: 'mins_30',      label: '30 Min',        icon: History, unlocked: totalMins >= 30 },
    { id: 'mins_60',      label: '1 Hour',        icon: History, unlocked: totalMins >= 60 },
    { id: 'streak_3',     label: '3-Day Streak',  icon: Zap,     unlocked: callStreak >= 3 },
  ];

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  // Split alias into editable name part and fixed number suffix
  const fullAlias = user?.anonAlias ?? '';
  const hashIdx = fullAlias.lastIndexOf('#');
  // If alias has no #number, derive a stable 4-digit number from user ID
  const numSuffix = hashIdx >= 0
    ? fullAlias.slice(hashIdx)
    : '#' + ((parseInt((user?.id ?? '0').replace(/-/g, '').slice(-8), 16) % 9000) + 1000).toString();

  function openEdit() {
    const namePart = hashIdx >= 0 ? fullAlias.slice(0, hashIdx) : fullAlias;
    setAlias(namePart);
    setAliasError(null);
    setSelectedInterests((user?.interests as string[]) ?? []);
    setIsEditing(true);
  }

  function handleAliasChange(val: string) {
    setAlias(val);
    if (val.length === 0) {
      setAliasError('Name cannot be empty');
    } else if (val.length < 2) {
      setAliasError('At least 2 characters required');
    } else if (val.length > 20) {
      setAliasError('Maximum 20 characters');
    } else if (!/^[a-zA-Z0-9]+$/.test(val)) {
      setAliasError('Only letters and numbers allowed (no spaces or symbols)');
    } else {
      setAliasError(null);
    }
  }

  function toggleInterest(slug: string) {
    setSelectedInterests(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < 5 ? [...prev, slug] : prev,
    );
  }

  async function handleSave() {
    if (aliasError || alias.trim().length < 2) return;
    setSaving(true);
    try {
      const newAlias = alias.trim() + numSuffix;
      await saveProfile({ anonAlias: newAlias, interests: selectedInterests });
      setIsEditing(false);
    }
    finally { setSaving(false); }
  }

  async function handleDeleteAccount() {
    try { await api.delete('/auth/account'); } catch { /* continue */ }
    clearAuth(); navigate('/');
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    overflow: 'hidden',
  };

  // ── Shared sub-sections (used in both mobile + desktop) ───────────────────

  const CallStatsSection = statsLoading ? (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ width: '30%', height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 14 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="shimmer" style={{ width: '55%', height: 22, borderRadius: 6 }} />
            <div className="shimmer" style={{ width: '75%', height: 9, borderRadius: 5 }} />
          </div>
        ))}
      </div>
    </div>
  ) : totalCalls > 0 ? (
    <div style={{ ...card, padding: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: isPremium ? '#d97706' : '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>Call Stats</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Total Calls',   value: totalCalls },
          { label: 'Total Minutes', value: `${totalMins}m` },
          { label: 'Longest Call',  value: `${longestMin}m` },
          { label: 'Avg Duration',  value: `${avgMins}m` },
        ].map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px 14px' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: accent, margin: 0, fontFamily: "'Oxanium', sans-serif" }}>{s.value}</p>
            <p style={{ fontSize: 10, color: '#6f9c81', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const StreakGoalSection = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Streak</p>
          <Flame size={13} style={{ color: callStreak > 0 ? accent : '#4a6b57' }} />
        </div>
        <p style={{ fontSize: 30, fontWeight: 800, color: callStreak > 0 ? accent : '#4a6b57', margin: 0, lineHeight: 1, fontFamily: "'Oxanium', sans-serif" }}>{callStreak}</p>
        <p style={{ fontSize: 10, color: '#6f9c81', margin: '4px 0 0' }}>day{callStreak !== 1 ? 's' : ''} in a row</p>
      </div>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Daily Goal</p>
          <Target size={13} style={{ color: accent }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {Array.from({ length: dailyGoal }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: i < callsToday ? accentGrad : 'rgba(255,255,255,0.08)' }} />
          ))}
        </div>
        <p style={{ fontSize: 10, color: accentLight, fontWeight: 600, margin: 0 }}>{Math.min(callsToday, dailyGoal)}/{dailyGoal} today</p>
      </div>
    </div>
  );

  const AchievementsSection = (cols: number) => (
    <div style={{ ...card, padding: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: isPremium ? '#d97706' : '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>Achievements</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10 }}>
        {ACHIEVEMENTS.map(a => {
          const Icon = a.icon;
          return (
            <div key={a.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: a.unlocked ? 1 : 0.3 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: a.unlocked ? accentBg : 'rgba(255,255,255,0.04)', border: `1.5px solid ${a.unlocked ? accentBorder : 'rgba(255,255,255,0.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={17} style={{ color: a.unlocked ? accent : '#4a6b57' }} />
              </div>
              <span style={{ fontSize: 10, color: a.unlocked ? '#8fcea8' : '#4a6b57', textAlign: 'center' as const, lineHeight: 1.3 }}>{a.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const InterestsSection = (
    <div style={{ ...card, padding: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: isPremium ? '#d97706' : '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Interests</p>
      {interests?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {interests.map(slug => {
            const found = INTERESTS.find(i => i.slug === slug);
            return found ? (
              <span key={slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: accentGrad, borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#1a2e05' }}>
                <found.icon size={11} />{found.label}
              </span>
            ) : null;
          })}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: '#6f9c81', margin: 0 }}>No interests added yet</p>
      )}
    </div>
  );

  const FriendsSection = friends.length > 0 ? (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: isPremium ? '#d97706' : '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Friends ({friends.length})</p>
        <button onClick={() => navigate('/friends')} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          View all <ChevronRight size={11} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {friends.slice(0, 5).map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
              onClick={() => useFriendStore.getState().setViewProfileId(f.id)}
            >
              <AvatarBubble name={f.alias} size="sm" premium={f.isPremium} />
              {f.isOnline && <span style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: f.isPremium ? '#fbbf24' : '#4ade80', border: '1.5px solid #05140d' }} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: f.isPremium ? '#fbbf24' : '#e2f5d3', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.alias}</p>
              <p style={{ fontSize: 10, color: f.isOnline ? '#4ade80' : '#4a6b57', margin: 0 }}>{f.isOnline ? 'Online' : 'Offline'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const InstallSection = canInstall ? (
    <div style={{ ...card, padding: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Install App</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <img src="/logo.png" alt="AppleTalk" style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#f4fbe9', margin: 0 }}>AppleTalk</p>
          <p style={{ fontSize: 11, color: '#6f9c81', margin: '2px 0 0' }}>Add to Home Screen · Works offline</p>
        </div>
      </div>
      <button
        onClick={triggerInstall}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'linear-gradient(150deg,#bef264,#84cc16)', border: 'none', borderRadius: 12, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: '#1a2e05' }}
      >
        📲 Install App
      </button>
    </div>
  ) : null;

  const AccountSection = (
    <div style={{ ...card, padding: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>Account</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {user?.isLinked ? (
          <>
            {/* Linked state */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(163,230,53,0.06)', borderRadius: 12, padding: '10px 14px' }}>
              <GoogleIconSm />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#a3e635', margin: 0 }}>Google Account Linked</p>
                <p style={{ fontSize: 11, color: '#6f9c81', margin: '2px 0 0' }}>{user.email ?? ''}</p>
              </div>
            </div>
            <button
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <LogOut size={14} color="#8fcea8" />
              <span style={{ fontSize: 13, color: '#8fcea8', fontWeight: 600 }}>Sign out</span>
            </button>
          </>
        ) : (
          <>
            {/* Unlinked state */}
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
              Login with Google to access Premium features. A new Google account will be created separately from your anonymous session.
            </p>
            <button
              onClick={() => linkGoogle()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#fff', border: 'none', borderRadius: 12, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: '#1a1a1a', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
            >
              <GoogleIconSm />
              Login with Google
            </button>
          </>
        )}
      </div>
    </div>
  );

  const DangerZoneSection = (
    <div style={{ ...card, padding: 20, borderColor: 'rgba(239,68,68,0.15)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(239,68,68,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Danger Zone</p>
      {!showDeleteConfirm ? (
        <button onClick={() => setShowDeleteConfirm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
          <Trash2 size={14} style={{ color: '#f87171' }} />
          <span style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>Delete Account</span>
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#fca5a5', margin: 0, lineHeight: 1.5 }}>This will permanently delete your account and all data. This cannot be undone.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: '#8fcea8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleDeleteAccount} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, Delete</button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Edit form (shared) ────────────────────────────────────────────────────
  const EditForm = (
    <>
      <div style={{ ...card, padding: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Display Name</p>
        {/* Name input + fixed number suffix */}
        <div style={{ display: 'flex', alignItems: 'center', background: isPremium || user?.isLinked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${aliasError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s', opacity: user?.isLinked ? 1 : 0.5 }}>
          <input
            value={alias}
            onChange={e => user?.isLinked && handleAliasChange(e.target.value)}
            maxLength={20}
            placeholder="YourName"
            readOnly={!user?.isLinked}
            style={{ flex: 1, background: 'none', border: 'none', padding: '10px 0 10px 14px', fontSize: 14, color: '#f4fbe9', fontFamily: 'inherit', outline: 'none', minWidth: 0, cursor: user?.isLinked ? 'text' : 'not-allowed' }}
          />
          <span style={{ padding: '10px 14px 10px 4px', fontSize: 14, color: 'rgba(255,255,255,0.35)', fontFamily: "'Oxanium', sans-serif", fontWeight: 600, flexShrink: 0, userSelect: 'none' as const }}>
            {numSuffix}
          </span>
        </div>
        {!user?.isLinked
          ? <p style={{ fontSize: 11, color: 'rgba(245,158,11,0.7)', margin: '6px 0 0' }}>Login with Google to change your name</p>
          : aliasError
            ? <p style={{ fontSize: 11, color: '#f87171', margin: '6px 0 0' }}>{aliasError}</p>
            : <p style={{ fontSize: 11, color: '#4a6b57', margin: '6px 0 0' }}>{alias.length}/20 · Only letters and numbers</p>
        }
      </div>
      <div style={{ ...card, padding: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
          Interests <span style={{ color: 'rgba(111,156,129,0.6)', fontWeight: 400, textTransform: 'none' as const }}>(max 5)</span>
        </p>
        <p style={{ fontSize: 11, color: '#4a6b57', margin: '0 0 12px' }}>{selectedInterests.length}/5 selected</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {INTERESTS.map(i => {
            const active = selectedInterests.includes(i.slug);
            return (
              <button key={i.slug} onClick={() => toggleInterest(i.slug)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: active ? accentGrad : 'rgba(255,255,255,0.05)', border: 'none', color: active ? '#1a2e05' : '#8fcea8' }}>
                <i.icon size={11} />{i.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <button onClick={() => setIsEditing(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#8fcea8', fontSize: 14, fontWeight: 600, padding: '12px 28px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving || !!aliasError || alias.trim().length < 2} style={{ background: accentGrad, border: 'none', color: '#1a2e05', fontSize: 14, fontWeight: 800, padding: '12px 32px', borderRadius: 16, cursor: saving || !!aliasError || alias.trim().length < 2 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving || !!aliasError || alias.trim().length < 2 ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving ? 'Saving...' : <><Check size={15} /> Save changes</>}
        </button>
      </div>
    </>
  );

  return (
    <div className="mob-nav-pb" style={{ flex: 1, overflowY: 'auto', overscrollBehaviorY: 'contain', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        .profile-mobile  { display: flex; }
        .profile-desktop { display: none; }
        @media (min-width: 1024px) {
          .profile-mobile  { display: none !important; }
          .profile-desktop { display: block !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════
          MOBILE LAYOUT  (< lg)  — unchanged
      ════════════════════════════════════════ */}
      <div className="profile-mobile" style={{ maxWidth: 520, margin: '0 auto', width: '100%', padding: '24px 16px', flexDirection: 'column', gap: 14 }}>

        {/* Profile card */}
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '32px 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
            {/* Edit icon — top right, mobile only */}
            {!isEditing && (
              <button
                onClick={openEdit}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={14} color="#8fcea8" />
              </button>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <AvatarBubble name={user?.anonAlias ?? '?'} size="lg" premium={isPremium} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#f4fbe9', margin: 0, fontFamily: "'Oxanium', sans-serif" }}>{user?.anonAlias}</p>
              {user?.isLinked && <VerifiedBadge size={16} />}
              {user?.gender && <span style={{ fontSize: 11, fontWeight: 600, color: user.gender === 'male' ? '#60a5fa' : '#f472b6', background: user.gender === 'male' ? 'rgba(96,165,250,0.1)' : 'rgba(244,114,182,0.1)', border: `1px solid ${user.gender === 'male' ? 'rgba(96,165,250,0.25)' : 'rgba(244,114,182,0.25)'}`, borderRadius: 99, padding: '2px 8px' }}>{user.gender === 'male' ? 'Male' : 'Female'}</span>}
            </div>
            {memberSince && <p style={{ fontSize: 11, color: '#4a6b57', margin: '0 0 6px', fontWeight: 500 }}>Member since {memberSince}</p>}
            {user?.isPremium ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 99, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: 12, fontWeight: 700 }}><Crown size={11} /> Premium</span>
                {user.premiumUntil && <span style={{ fontSize: 11, color: '#6f9c81' }}>until {new Date(user.premiumUntil).toLocaleDateString()}</span>}
              </div>
            ) : (
              <button onClick={() => navigate('/premium')} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 99, background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Crown size={12} /> Upgrade to Premium
              </button>
            )}
          </div>
          <div style={{ display: 'flex' }}>
            {[{ label: 'Friends', value: friends.length }, { label: 'Calls', value: totalCalls }, { label: 'Interests', value: interests?.length ?? 0 }].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '18px 0', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: accent, margin: 0, fontFamily: "'Oxanium', sans-serif" }}>{s.value}</p>
                <p style={{ fontSize: 11, color: '#6f9c81', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {!isEditing && (
          <>
            {InterestsSection}
            {CallStatsSection}
            {StreakGoalSection}
            {AchievementsSection(4)}
            {FriendsSection}
            {InstallSection}
            {AccountSection}
            {DangerZoneSection}
          </>
        )}
        {isEditing && EditForm}
      </div>

      {/* ════════════════════════════════════════
          DESKTOP LAYOUT  (≥ lg)
      ════════════════════════════════════════ */}
      <div className="profile-desktop" style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '32px 32px 40px' }}>

        {/* ── Profile hero banner ── */}
        <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', marginBottom: 28, background: 'rgba(255,255,255,0.03)' }}>
          {/* Gradient backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: isPremium ? 'radial-gradient(ellipse 70% 120% at 50% -20%, rgba(245,158,11,0.18), transparent 60%)' : 'radial-gradient(ellipse 70% 120% at 50% -20%, rgba(163,230,53,0.18), transparent 60%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 28, padding: '32px 36px' }}>
            {/* Avatar */}
            <AvatarBubble name={user?.anonAlias ?? '?'} size="xl" premium={isPremium} />

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#f4fbe9', margin: '0 0 4px', fontFamily: "'Oxanium', sans-serif", letterSpacing: '-0.02em' }}>{user?.anonAlias}</p>
                {user?.isLinked && <VerifiedBadge size={20} />}
                {user?.gender && <span style={{ fontSize: 12, fontWeight: 600, color: user.gender === 'male' ? '#60a5fa' : '#f472b6', background: user.gender === 'male' ? 'rgba(96,165,250,0.1)' : 'rgba(244,114,182,0.1)', border: `1px solid ${user.gender === 'male' ? 'rgba(96,165,250,0.25)' : 'rgba(244,114,182,0.25)'}`, borderRadius: 99, padding: '2px 9px' }}>{user.gender === 'male' ? 'Male' : 'Female'}</span>}
              </div>
              {memberSince && <p style={{ fontSize: 12, color: '#4a6b57', margin: '0 0 10px', fontWeight: 500 }}>Member since {memberSince}</p>}
              {user?.isPremium ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 99, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>
                  <Crown size={12} /> Premium{user.premiumUntil ? ` · until ${new Date(user.premiumUntil).toLocaleDateString()}` : ''}
                </span>
              ) : (
                <button onClick={() => navigate('/premium')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 99, background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Crown size={12} /> Upgrade to Premium
                </button>
              )}
            </div>

            {/* Stats pills */}
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              {[{ label: 'Friends', value: friends.length }, { label: 'Calls', value: totalCalls }, { label: 'Interests', value: interests?.length ?? 0 }].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '14px 22px', minWidth: 80 }}>
                  <p style={{ fontSize: 26, fontWeight: 800, color: accent, margin: 0, fontFamily: "'Oxanium', sans-serif" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: '#6f9c81', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Edit button */}
            {!isEditing && (
              <button onClick={openEdit} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#e2f5d3', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                <Edit3 size={14} /> Edit profile
              </button>
            )}
          </div>
        </div>

        {/* ── Edit mode (full-width) ── */}
        {isEditing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680, margin: '0 auto' }}>
            {EditForm}
          </div>
        )}

        {/* ── Two-column view ── */}
        {!isEditing && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {FriendsSection}
              {InterestsSection}
              {InstallSection}
              {AccountSection}
              {DangerZoneSection}
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {CallStatsSection}
              {StreakGoalSection}
              {AchievementsSection(8)}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
