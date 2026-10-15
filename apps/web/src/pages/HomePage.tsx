import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { useFriendStore } from '../store/friend.store';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { Sh } from '../components/Shimmer';
import {
  Mic, Users, X, Check, Heart,
  Music, Gamepad2, Sparkles, Film, BookOpen, Plane, UtensilsCrossed,
  Trophy, Cpu, Palette, Code2, Dumbbell, Zap,
  Play, UserPlus, Phone,
  Smile, History, Shuffle, Shield, FileText, Lock, AlertCircle, ChevronDown, Flag, Crown,
  MessageSquare, MapPin, Flame, Target, Share2,
  EyeOff, Globe, Bot, Ban, Eye,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { GenderModal } from '../components/GenderModal';
import { InterestModal } from '../components/InterestModal';
import { useOnlineCount } from '../hooks/useOnlineCount';

interface ChatMsg {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
}

interface ChatThread {
  [friendId: string]: ChatMsg[];
}

const INTERESTS: { slug: string; label: string; icon: LucideIcon }[] = [
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

const CONVERSATION_STARTERS = [
  "What's one skill you wish you had learned earlier?",
  "If you could live anywhere for a year, where would it be?",
  "What's the most interesting thing you've learned recently?",
  "What hobby would you try if time wasn't an issue?",
  "What small thing consistently makes your day better?",
  "If you could have dinner with anyone, who would it be?",
  "What's your go-to activity after a rough day?",
  "What are you most looking forward to this year?",
];

function Avatar({ size = 'md', premium = false }: { name: string; size?: 'sm' | 'md' | 'lg'; premium?: boolean }) {
  const sizeClass = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  const imgSize = size === 'lg' ? 38 : size === 'sm' ? 22 : 26;
  return (
    <div className={`${sizeClass} rounded-full bg-leaf-500 flex items-center justify-center overflow-hidden select-none`}
      style={premium ? { boxShadow: '0 0 0 2px #f59e0b' } : undefined}>
      <img src="/logo.png" alt="user" style={{ width: imgSize, height: imgSize, objectFit: 'contain' }} />
    </div>
  );
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface CallHistoryEntry {
  id: string;
  partnerId: string;
  partnerAlias: string;
  partnerRegion: string | null;
  partnerGender: string | null;
  partnerIsPremium: boolean;
  startedAt: string;
  durationSecs: number;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const { user } = useAuthStore();
  const { saveProfile } = useAuth();
  const { friends, sentRequests, incomingRequests, cancelRequest, removeFriend, loadFriends, loadIncomingRequests, removeIncomingRequest, addFriendFromAccept, hasFriend, hasRequest, sendRequest, setOutgoingFriendCall } = useFriendStore();
  const socket = useSocket();
  const navigate = useNavigate();
  const onlineCount = useOnlineCount();
  const isPremium = user?.isPremium ?? false;

  useEffect(() => {
    loadFriends().then(() => {
      const ids = useFriendStore.getState().friends.map(f => f.id);
      if (ids.length > 0) socket.emit('users:status-check', { userIds: ids });
    });
    loadIncomingRequests();
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // History state
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOnlineIds, setHistoryOnlineIds] = useState<Set<string>>(new Set());
  const [offlineToast, setOfflineToast] = useState<string | null>(null);

  const [alreadyFriendToast, setAlreadyFriendToast] = useState<string | null>(null);

  // Report modal state
  const [reportTarget, setReportTarget] = useState<{ id: string; alias: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDoneToast, setReportDoneToast] = useState(false);

  const REPORT_REASONS = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'hate_speech', label: 'Hate speech' },
    { value: 'other', label: 'Other' },
  ];

  async function submitReport() {
    if (!reportTarget || !reportReason) return;
    setReportSubmitting(true);
    try {
      await api.post('/reports', {
        reportedUserId: reportTarget.id,
        reason: reportReason,
        description: reportDescription || undefined,
      });
      setReportTarget(null);
      setReportReason('');
      setReportDescription('');
      setReportDoneToast(true);
      setTimeout(() => setReportDoneToast(false), 3000);
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setReportSubmitting(false);
    }
  }

  const callHistoryRef = useRef<CallHistoryEntry[]>([]);
  const historyCheckPendingRef = useRef(false);

  function emitHistoryStatusCheck(entries: CallHistoryEntry[]) {
    if (entries.length === 0) return;
    historyCheckPendingRef.current = true;
    socket.emit('users:status-check', { userIds: entries.map(e => e.partnerId) });
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/calls/history');
      const entries = data as CallHistoryEntry[];
      setCallHistory(entries);
      callHistoryRef.current = entries;
      emitHistoryStatusCheck(entries);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    function onConnect() { emitHistoryStatusCheck(callHistoryRef.current); }
    socket.on('connect', onConnect);
    return () => { socket.off('connect', onConnect); };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(() => {
      emitHistoryStatusCheck(callHistoryRef.current);
    }, 30_000);
    return () => clearInterval(interval);
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  useSocketEvent('users:online-status', ({ onlineIds }) => {
    const historyPartnerIds = new Set(callHistoryRef.current.map(e => e.partnerId));
    if (historyCheckPendingRef.current) {
      historyCheckPendingRef.current = false;
      setHistoryOnlineIds(new Set(onlineIds.filter(id => historyPartnerIds.has(id))));
    } else {
      const onlineHistoryIds = onlineIds.filter(id => historyPartnerIds.has(id));
      if (onlineHistoryIds.length > 0) {
        setHistoryOnlineIds(prev => new Set([...prev, ...onlineHistoryIds]));
      }
    }
  });

  useSocketEvent('friend:online', ({ userId }) => {
    setHistoryOnlineIds(prev => new Set([...prev, userId]));
  });

  useSocketEvent('friend:offline', ({ userId }) => {
    setHistoryOnlineIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
  });

  function callHistoryUser(partnerId: string, partnerAlias: string) {
    if (!historyOnlineIds.has(partnerId)) {
      setOfflineToast(partnerAlias);
      setTimeout(() => setOfflineToast(null), 3000);
      return;
    }
    setOutgoingFriendCall({ toId: partnerId, toAlias: partnerAlias });
    socket.emit('friend:call', { targetUserId: partnerId });
  }

  // Receive friend chat messages (kept here to maintain global unread count)
  const [chatUnread, setChatUnread] = useState<Record<string, number>>({});
  const totalUnread = Object.values(chatUnread).reduce((sum, n) => sum + n, 0);

  useSocketEvent('friend:chat', ({ fromUserId }) => {
    setChatUnread(prev => ({ ...prev, [fromUserId]: (prev[fromUserId] ?? 0) + 1 }));
  });

  // Gender modal
  const MY_GENDER_KEY = 'mangotalk_my_gender';
  const GENDER_COOKIE = 'at_gender';
  const GENDER_DB = 'appletalk_db';
  const GENDER_STORE = 'identity';

  function getGenderCookie(): string | null {
    try {
      const m = document.cookie.match(new RegExp(`(?:^|; )${GENDER_COOKIE}=([^;]+)`));
      return m ? m[1] : null;
    } catch { return null; }
  }

  function setGenderCookie(gender: string): void {
    try {
      const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
      document.cookie = `${GENDER_COOKIE}=${gender};expires=${expires};path=/;SameSite=Lax`;
    } catch { /* ignore */ }
  }

  async function getGenderFromIDB(): Promise<string | null> {
    try {
      return await new Promise<string | null>((resolve) => {
        const req = indexedDB.open(GENDER_DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(GENDER_STORE);
        req.onsuccess = () => {
          const tx = req.result.transaction(GENDER_STORE, 'readonly');
          const g = tx.objectStore(GENDER_STORE).get(MY_GENDER_KEY);
          g.onsuccess = () => resolve((g.result as string) ?? null);
          g.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  }

  function saveGenderEverywhere(gender: string): void {
    try { localStorage.setItem(MY_GENDER_KEY, gender); } catch { /* ignore */ }
    setGenderCookie(gender);
    try {
      const req = indexedDB.open(GENDER_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(GENDER_STORE);
      req.onsuccess = () => {
        const tx = req.result.transaction(GENDER_STORE, 'readwrite');
        tx.objectStore(GENDER_STORE).put(gender, MY_GENDER_KEY);
      };
    } catch { /* ignore */ }
  }

  const [showGenderModal, setShowGenderModal] = useState<boolean>(
    () => !localStorage.getItem(MY_GENDER_KEY) && !getGenderCookie()
  );

  useEffect(() => {
    if (!showGenderModal) return;
    getGenderFromIDB().then(g => {
      if (g) {
        localStorage.setItem(MY_GENDER_KEY, g);
        setGenderCookie(g);
        setShowGenderModal(false);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    if (user.gender) {
      saveGenderEverywhere(user.gender);
      setShowGenderModal(false);
    } else {
      setShowGenderModal(true);
      try { localStorage.removeItem('at_interest_modal_seen'); } catch { /* ignore */ }
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleGenderSelect(gender: 'male' | 'female') {
    saveGenderEverywhere(gender);
    setShowGenderModal(false);
    saveProfile({ gender }).catch(console.error);
    setShowInterestModal(true);
  }

  const INTEREST_MODAL_SEEN_KEY = 'at_interest_modal_seen';
  const INTEREST_MODAL_COOKIE = 'at_int_seen';

  function getInterestModalSeenCookie(): boolean {
    try { return document.cookie.includes(`${INTEREST_MODAL_COOKIE}=1`); } catch { return false; }
  }

  function markInterestModalSeen(): void {
    try { localStorage.setItem(INTEREST_MODAL_SEEN_KEY, '1'); } catch { /* ignore */ }
    try {
      const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
      document.cookie = `${INTEREST_MODAL_COOKIE}=1;expires=${expires};path=/;SameSite=Lax`;
    } catch { /* ignore */ }
    try {
      const req = indexedDB.open(GENDER_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(GENDER_STORE);
      req.onsuccess = () => {
        const tx = req.result.transaction(GENDER_STORE, 'readwrite');
        tx.objectStore(GENDER_STORE).put('1', INTEREST_MODAL_SEEN_KEY);
      };
    } catch { /* ignore */ }
  }

  const [showInterestModal, setShowInterestModal] = useState<boolean>(false);

  useEffect(() => {
    const alreadySeen = !!localStorage.getItem(INTEREST_MODAL_SEEN_KEY) || getInterestModalSeenCookie();
    if (alreadySeen) return;
    if (!showGenderModal) {
      (async () => {
        try {
          const seenFromIDB = await new Promise<string | null>((resolve) => {
            const req = indexedDB.open(GENDER_DB, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(GENDER_STORE);
            req.onsuccess = () => {
              const tx = req.result.transaction(GENDER_STORE, 'readonly');
              const g = tx.objectStore(GENDER_STORE).get(INTEREST_MODAL_SEEN_KEY);
              g.onsuccess = () => resolve((g.result as string) ?? null);
              g.onerror = () => resolve(null);
            };
            req.onerror = () => resolve(null);
          });
          if (!seenFromIDB) setShowInterestModal(true);
          else markInterestModalSeen();
        } catch { /* ignore */ }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInterestDone(selected: string[]) {
    markInterestModalSeen();
    setShowInterestModal(false);
    if (selected.length > 0) saveProfile({ interests: selected }).catch(console.error);
  }

  function handleInterestSkip() {
    markInterestModalSeen();
    setShowInterestModal(false);
  }

  useEffect(() => {
    if (!user?.id || !user?.gender) return;
    markInterestModalSeen();
    setShowInterestModal(false);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Purpose state
  const PURPOSES = [
    { value: 'english-practice', icon: <Mic size={13} />, label: 'English Practice' },
    { value: 'blind-date', icon: <Heart size={13} />, label: 'Blind Date' },
    { value: 'make-friends', icon: <Users size={13} />, label: 'Make Friends' },
  ];
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(
    () => localStorage.getItem('mangotalk_purpose') ?? null
  );
  function selectPurpose(value: string) {
    const next = selectedPurpose === value ? null : value;
    setSelectedPurpose(next);
    if (next) localStorage.setItem('mangotalk_purpose', next);
    else localStorage.removeItem('mangotalk_purpose');
  }

  const [filterGender, setFilterGender] = useState<'both' | 'female' | 'male'>(
    () => (localStorage.getItem('mangotalk_filter_gender') as 'both' | 'female' | 'male') ?? 'both'
  );

  useEffect(() => {
    localStorage.setItem('mangotalk_filter_gender', filterGender);
  }, [filterGender]);

  const [purposeDropdownOpen, setPurposeDropdownOpen] = useState(false);
  useEffect(() => {
    if (!purposeDropdownOpen) return;
    const close = () => setPurposeDropdownOpen(false);
    const t = setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', close); };
  }, [purposeDropdownOpen]);

  const TIPS = [
    'Add interests to get matched with people who share your vibe',
    'Use the gender filter to find your preferred match type',
    'Send a friend request during a call to stay in touch',
    'Skip anytime — there\'s always someone new to talk to',
    'Voice only means no judgment — just real conversations',
    'Try English Practice mode to improve your speaking skills',
  ];
  const [tipIndex, setTipIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activityFeed, setActivityFeed] = useState<{ id: string; text: string }[]>([
    { id: 'a1', text: 'Someone from Dhaka just connected' },
    { id: 'a2', text: 'New match made in Chittagong' },
    { id: 'a3', text: 'Anonymous user from Sylhet joined' },
    { id: 'a4', text: 'New conversation started in Rajshahi' },
    { id: 'a5', text: 'Someone in Khulna found a match' },
  ]);
  useEffect(() => {
    const t = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 4500);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const CITIES = [
    'Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal',
    'Mymensingh', 'Rangpur', 'Comilla', 'Narayanganj', 'Gazipur',
    'Cox\'s Bazar', 'Bogura', 'Jessore', 'Dinajpur', 'Brahmanbaria',
    'Tangail', 'Noakhali', 'Feni', 'Kushtia',
  ];
  const CITY_GROUPS: string[][] = [];
  for (let i = 0; i < CITIES.length; i += 4) CITY_GROUPS.push(CITIES.slice(i, i + 4));

  const [cityGroupIndex, setCityGroupIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCityGroupIndex(i => (i + 1) % CITY_GROUPS.length), 3000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const FEED_TEMPLATES = [
      (c: string) => `Someone from ${c} just connected`,
      (c: string) => `New match made in ${c}`,
      (c: string) => `Anonymous user from ${c} joined`,
      (c: string) => `New conversation started in ${c}`,
      (c: string) => `Someone in ${c} found a match`,
      (c: string) => `${c} user is now talking`,
      (c: string) => `Match found for someone in ${c}`,
      (c: string) => `${c} & a stranger just connected`,
    ];
    const t = setInterval(() => {
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const tpl = FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)];
      setActivityFeed(prev => [{ id: Date.now().toString(), text: tpl(city) }, ...prev.slice(0, 7)]);
    }, 3000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onlineFriends = friends.filter(f => f.isOnline);

  // ── Golden theme helpers ──────────────────────────────────────────────────
  const accent = isPremium ? '#f59e0b' : '#a3e635';
  const accentBg = isPremium ? 'rgba(245,158,11,0.10)' : 'rgba(163,230,53,0.10)';
  const accentBorder = isPremium ? 'rgba(245,158,11,0.30)' : 'rgba(163,230,53,0.30)';
  const accentLight = isPremium ? '#fef3c7' : '#d3f099';
  const accentGradient = isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)';

  // ── New widgets ───────────────────────────────────────────────────────────
  const callStreak = (() => {
    if (callHistory.length === 0) return 0;
    const days = new Set(callHistory.map(e => new Date(e.startedAt).toDateString()));
    let streak = 0;
    const cur = new Date();
    while (days.has(cur.toDateString())) { streak++; cur.setDate(cur.getDate() - 1); }
    return streak;
  })();

  const totalCallMins = Math.floor(callHistory.reduce((s, e) => s + e.durationSecs, 0) / 60);
  const todayStr = new Date().toDateString();
  const callsToday = callHistory.filter(e => new Date(e.startedAt).toDateString() === todayStr).length;
  const dailyGoal = 3;
  const starterIndex = tipIndex % CONVERSATION_STARTERS.length;

  const ACHIEVEMENTS = [
    { id: 'first_call',   label: 'First Call',    icon: Phone,   unlocked: callHistory.length >= 1 },
    { id: 'calls_5',      label: '5 Calls',        icon: Mic,     unlocked: callHistory.length >= 5 },
    { id: 'calls_10',     label: '10 Calls',       icon: Mic,     unlocked: callHistory.length >= 10 },
    { id: 'first_friend', label: 'First Friend',   icon: Users,   unlocked: friends.length >= 1 },
    { id: 'friends_5',    label: '5 Friends',      icon: Users,   unlocked: friends.length >= 5 },
    { id: 'mins_30',      label: '30 Min',         icon: History, unlocked: totalCallMins >= 30 },
    { id: 'mins_60',      label: '1 Hour',         icon: History, unlocked: totalCallMins >= 60 },
    { id: 'streak_3',     label: '3-Day Streak',   icon: Zap,     unlocked: callStreak >= 3 },
  ];

  function copyInviteLink() {
    navigator.clipboard.writeText('https://www.appletalk.live').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
      {showGenderModal && <GenderModal onSelect={handleGenderSelect} />}
      {!showGenderModal && showInterestModal && (
        <InterestModal onDone={handleInterestDone} onSkip={handleInterestSkip} />
      )}


      {/* ── Main hero content ── */}
      {/* Sliding keywords + online count */}
      <div className="shrink-0 flex items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Sliding strip */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '10px 0' }}>
          <div style={{ display: 'flex', width: 'max-content', animation: 'slideKeywords 22s linear infinite', alignItems: 'center' }}>
            {['Anonymous', 'Voice Only', 'No Camera', 'No Signup', 'Bangladesh', 'Interest Match', 'Make Friends', 'English Practice', 'Blind Date', 'Free Forever',
              'Anonymous', 'Voice Only', 'No Camera', 'No Signup', 'Bangladesh', 'Interest Match', 'Make Friends', 'English Practice', 'Blind Date', 'Free Forever'].map((kw, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500, color: '#6f9c81' }}>
                {kw}
                <span style={{ margin: '0 14px', color: 'rgba(111,156,129,0.4)', fontSize: 10 }}>·</span>
              </span>
            ))}
          </div>
          <style>{`
            @keyframes slideKeywords {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
        {/* Online pill — pinned to right end of the strip */}
        <div style={{ flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: isPremium ? '#f59e0b' : '#a3e635', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: isPremium ? '#fef3c7' : '#d3f099', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {onlineCount.toLocaleString()} online
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto home-scroll mob-nav-pb">
        {/* ── Mobile layout ── */}
        <div className="lg:hidden flex flex-col items-center justify-center min-h-full px-6 py-8 gap-0 text-center">

          {/* Hero heading — desktop only */}
          <div className="hidden lg:block" style={{ marginTop: 20 }}>
            <h1 style={{ fontSize: 'clamp(42px, 8vw, 70px)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.035em', lineHeight: 0.98, margin: 0, fontFamily: "'Oxanium', sans-serif" }}>
              Ready to talk?
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500, flexShrink: 0 }}>Purpose...</span>
              {PURPOSES.map(p => (
                <button
                  key={p.value}
                  onClick={() => selectPurpose(p.value)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all duration-150 ${
                    selectedPurpose === p.value
                      ? 'border-white/30 text-white bg-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.3)]'
                      : 'border-white/20 text-white/70 bg-white/8 [@media(hover:hover)]:hover:bg-white/15 [@media(hover:hover)]:hover:border-white/30 [@media(hover:hover)]:hover:text-white'
                  }`}
                >
                  {p.icon}
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Orb button */}
          <div style={{ marginTop: 36, position: 'relative', width: 192, height: 192, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <style>{`
              @keyframes orbRing {
                0% { transform: scale(1); opacity: 0.6; }
                100% { transform: scale(1.55); opacity: 0; }
              }
            `}</style>
            <div style={{ position: 'absolute', width: 192, height: 192, borderRadius: '50%', border: isPremium ? '2px solid rgba(245,158,11,0.5)' : '2px solid rgba(163,230,53,0.5)', animation: 'orbRing 2.4s ease-out infinite', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 192, height: 192, borderRadius: '50%', border: isPremium ? '2px solid rgba(245,158,11,0.35)' : '2px solid rgba(163,230,53,0.35)', animation: 'orbRing 2.4s ease-out infinite 1.2s', pointerEvents: 'none' }} />
            <button
              onClick={() => navigate('/call')}
              style={{
                position: 'relative', width: 192, height: 192, borderRadius: '50%',
                background: isPremium ? 'linear-gradient(158deg,#fef9c3 0%,#fde68a 30%,#f59e0b 66%,#b45309 100%)' : 'linear-gradient(158deg, #ecfccb 0%, #bef264 30%, #84cc16 66%, #4d7c0f 100%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                boxShadow: 'none',
                border: 'none', cursor: 'pointer', transition: 'transform 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
              onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
              onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
              <img src="/logo.png" alt="AppleTalk" style={{ width: 80, height: 80, objectFit: 'contain' }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1a2e05', fontFamily: "'Oxanium', sans-serif" }}>Tap to Talk</span>
            </button>
          </div>



          {/* Gender toggle */}
          <div style={{ marginTop: 64, display: 'flex', gap: 4, background: 'rgba(255,255,255,0.055)', borderRadius: 99, padding: 5, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
            {(['both', 'female', 'male'] as const).map(g => (
              <button
                key={g}
                onClick={() => {
                  if (g !== 'both' && !user?.isPremium) { navigate('/premium'); return; }
                  setFilterGender(g);
                }}
                style={{
                  padding: '10px 20px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: filterGender === g ? 800 : 600,
                  whiteSpace: 'nowrap',
                  background: filterGender === g ? (isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)') : 'transparent',
                  color: filterGender === g ? '#1a2e05' : (isPremium ? '#fef3c7' : '#d3f099'),
                  boxShadow: 'none',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {g === 'both' ? 'Both' : g.charAt(0).toUpperCase() + g.slice(1)}
                {g !== 'both' && (
                  <Crown size={13} style={{ color: filterGender === g ? '#b45309' : '#fbbf24' }} />
                )}
              </button>
            ))}
          </div>

          {/* Online friends strip */}
          {onlineFriends.length > 0 && (
            <div className="w-full max-w-lg" style={{ marginTop: 28 }}>
              <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-3 px-1">
                Online friends ({onlineFriends.length})
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {onlineFriends.map(friend => (
                  <div key={friend.id} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                    <button
                      className="relative focus:outline-none"
                      onClick={() => useFriendStore.getState().setViewProfileId(friend.id)}
                    >
                      <Avatar name={friend.alias} size="md" premium={friend.isPremium} />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${friend.isPremium ? 'bg-yellow-400' : 'bg-green-400'}`} />
                    </button>
                    <span className="text-[10px] text-leaf-200 font-medium text-center truncate w-full leading-tight">
                      {friend.alias.split('#')[0]}
                    </span>
                    <button
                      onClick={() => {
                        setOutgoingFriendCall({ toId: friend.id, toAlias: friend.alias });
                        socket.emit('friend:call', { targetUserId: friend.id });
                      }}
                      style={{ fontSize: 10, fontWeight: 700, background: isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)', border: 'none', color: '#1a2e05', borderRadius: 99, padding: '3px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Call
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent calls */}
          {(historyLoading || callHistory.length > 0) && (
            <div className="w-full max-w-lg text-left" style={{ marginTop: 28 }}>
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide m-0">Recent Calls</p>
                {!historyLoading && <button onClick={() => navigate('/history')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#6f9c81', fontSize: 12, fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>
                  See all History
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>}
              </div>
              {historyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '10px 14px' }}>
                      <Sh w={36} h={36} r="50%" />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Sh w="45%" h={11} r={6} />
                        <Sh w="30%" h={9} r={6} />
                      </div>
                      <Sh w={48} h={26} r={99} />
                    </div>
                  ))}
                </div>
              ) : (
              <div className="flex flex-col gap-2">
                {callHistory.slice(0, 3).map(entry => {
                  const isFriend = hasFriend(entry.partnerId);
                  const isPending = hasRequest(entry.partnerId);
                  const isOnline = historyOnlineIds.has(entry.partnerId);
                  const displayName = isFriend ? entry.partnerAlias : 'Stranger';
                  return (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '10px 14px' }}>
                    <div
                      style={{ position: 'relative', flexShrink: 0, cursor: isFriend ? 'pointer' : 'default' }}
                      onClick={isFriend ? () => useFriendStore.getState().setViewProfileId(entry.partnerId) : undefined}
                    >
                      <Avatar name={displayName} size="sm" premium={entry.partnerIsPremium} />
                      <span style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: isOnline ? (entry.partnerIsPremium ? '#fbbf24' : '#4ade80') : 'rgba(255,255,255,0.15)', border: '1.5px solid #05140d' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: entry.partnerIsPremium ? '#fbbf24' : '#e2f5d3', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                        {entry.partnerIsPremium && <Crown size={12} color="#f59e0b" />}
                      </div>
                      <p style={{ fontSize: 11, color: '#6f9c81', margin: 0 }}>
                        {Math.floor(entry.durationSecs / 60)}m {entry.durationSecs % 60}s · {timeAgo(entry.startedAt)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {!isFriend && !isPending && (
                        <button
                          onClick={() => sendRequest({ id: entry.partnerId, alias: entry.partnerAlias })}
                          style={{ width: 28, height: 28, borderRadius: '50%', background: isPremium ? 'rgba(245,158,11,0.1)' : 'rgba(163,230,53,0.1)', border: `1px solid ${isPremium ? 'rgba(245,158,11,0.25)' : 'rgba(163,230,53,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          title="Add Friend"
                        >
                          <UserPlus size={13} color={isPremium ? '#f59e0b' : '#a3e635'} />
                        </button>
                      )}
                      {isPending && (
                        <span style={{ fontSize: 10, color: '#6f9c81', whiteSpace: 'nowrap' }}>Pending</span>
                      )}
                      {isOnline ? (
                        <button
                          onClick={() => callHistoryUser(entry.partnerId, displayName)}
                          style={{ fontSize: 11, fontWeight: 700, background: isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)', border: 'none', color: '#1a2e05', borderRadius: 99, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Call
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: '#4a6b57', whiteSpace: 'nowrap' }}>Offline</span>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* Your interests */}
          {((user?.interests as string[] | undefined) ?? []).length > 0 && (
            <div className="w-full max-w-lg text-left" style={{ marginTop: 28 }}>
              <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-3 px-1">Your Interests</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {((user?.interests as string[] | undefined) ?? []).map((slug: string) => {
                  const interest = INTERESTS.find(i => i.slug === slug);
                  if (!interest) return null;
                  const Icon = interest.icon;
                  return (
                    <span key={slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)', border: 'none', borderRadius: 99, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#1a2e05' }}>
                      <Icon size={12} />
                      {interest.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick stats */}
          {callHistory.length > 0 && (() => {
            const totalMins = Math.floor(callHistory.reduce((s, e) => s + e.durationSecs, 0) / 60);
            return (
              <div className="w-full max-w-lg" style={{ marginTop: 28 }}>
                <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-3 px-1 text-left">Your Stats</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Total Calls', value: callHistory.length },
                    { label: 'Minutes Talked', value: totalMins },
                    { label: 'Friends Made', value: friends.length },
                  ].map((stat, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 10px', textAlign: 'center' }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: isPremium ? '#f59e0b' : '#a3e635', margin: 0, lineHeight: 1 }}>{stat.value}</p>
                      <p style={{ fontSize: 10, color: '#6f9c81', marginTop: 4, fontWeight: 500 }}>{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Tip of the moment */}
          <div className="w-full max-w-lg text-left" style={{ marginTop: 28 }}>
            <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-3 px-1">Tip</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: isPremium ? 'rgba(245,158,11,0.07)' : 'rgba(163,230,53,0.07)', border: isPremium ? '1px solid rgba(245,158,11,0.18)' : '1px solid rgba(163,230,53,0.18)', borderRadius: 16, padding: '12px 14px' }}>
              <span style={{ fontSize: 16, lineHeight: 1.4 }}>💡</span>
              <p style={{ fontSize: 13, color: isPremium ? '#fde68a' : '#b6e57a', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{TIPS[tipIndex]}</p>
            </div>
          </div>

          {/* Active cities */}
          <div className="w-full max-w-lg text-left" style={{ marginTop: 28, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide px-1" style={{ margin: 0 }}>Active Cities</p>
              <div style={{ display: 'flex', gap: 4 }}>
                {CITY_GROUPS.map((_, i) => (
                  <span key={i} style={{ width: i === cityGroupIndex ? 16 : 6, height: 4, borderRadius: 99, background: i === cityGroupIndex ? '#4a9f78' : 'rgba(255,255,255,0.12)', transition: 'all 0.3s' }} />
                ))}
              </div>
            </div>
            <style>{`@keyframes cityFade { 0%{opacity:0;transform:translateY(6px)} 100%{opacity:1;transform:translateY(0)} }`}</style>
            <div key={cityGroupIndex} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, animation: 'cityFade 0.5s ease forwards' }}>
              {CITY_GROUPS[cityGroupIndex].map(city => (
                <span key={city} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 99, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#8fcea8' }}>
                  <MapPin size={11} style={{ color: '#6f9c81', flexShrink: 0 }} />
                  {city}
                </span>
              ))}
            </div>
          </div>

          {/* ── Streak + Daily Goal ── */}
          <div className="w-full max-w-lg" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Streak</span>
                <Flame size={13} style={{ color: callStreak > 0 ? accent : '#4a6b57' }} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: callStreak > 0 ? accent : '#4a6b57', margin: 0, lineHeight: 1, fontFamily: "'Oxanium', sans-serif" }}>{callStreak}</p>
              <p style={{ fontSize: 10, color: '#6f9c81', margin: '4px 0 0' }}>day{callStreak !== 1 ? 's' : ''} in a row</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Daily Goal</span>
                <Target size={13} style={{ color: accent }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {Array.from({ length: dailyGoal }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: i < callsToday ? accentGradient : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
              <p style={{ fontSize: 10, color: accentLight, fontWeight: 600, margin: 0 }}>{Math.min(callsToday, dailyGoal)}/{dailyGoal} calls today</p>
            </div>
          </div>

          {/* ── Achievements ── */}
          <div className="w-full max-w-lg text-left" style={{ marginTop: 16 }}>
            <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-3 px-1">Achievements</p>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-around' }}>
                {ACHIEVEMENTS.map(a => {
                  const Icon = a.icon;
                  return (
                    <div key={a.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, opacity: a.unlocked ? 1 : 0.3 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: a.unlocked ? accentBg : 'rgba(255,255,255,0.05)', border: `1.5px solid ${a.unlocked ? accentBorder : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={15} style={{ color: a.unlocked ? accent : '#4a6b57' }} />
                      </div>
                      <span style={{ fontSize: 9, color: a.unlocked ? '#8fcea8' : '#4a6b57', textAlign: 'center' as const, maxWidth: 44, lineHeight: 1.3 }}>{a.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Conversation Starter ── */}
          <div className="w-full max-w-lg text-left" style={{ marginTop: 16 }}>
            <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-3 px-1">Conversation Starter</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '12px 14px' }}>
              <MessageSquare size={15} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 13, color: '#c8e6b0', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>"{CONVERSATION_STARTERS[starterIndex]}"</p>
                <p style={{ fontSize: 10, color: '#4a6b57', margin: '6px 0 0' }}>Ask your next stranger this question</p>
              </div>
            </div>
          </div>

          {/* ── Invite Friends ── */}
          <div className="w-full max-w-lg text-left" style={{ marginTop: 16, marginBottom: 16 }}>
            <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-3 px-1">Invite Friends</p>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '12px 14px' }}>
              <p style={{ fontSize: 12, color: '#8fcea8', margin: '0 0 12px' }}>Bring your friends to AppleTalk</p>
              <button
                onClick={copyInviteLink}
                style={{ width: '100%', padding: '10px 0', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: accentGradient, color: '#1a2e05', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Share2 size={13} />
                {copied ? 'Link Copied!' : 'Copy Invite Link'}
              </button>
            </div>
          </div>

        </div>

        {/* ── Desktop layout ── */}
        <div className="hidden lg:flex gap-6 max-w-7xl mx-auto w-full px-8 py-3" style={{ alignItems: 'start' }}>

          {/* Left sidebar */}
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Profile card */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Avatar name={user?.anonAlias ?? 'You'} size="md" premium={isPremium} />
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#e2f5d3', margin: 0 }}>{user?.anonAlias ?? 'Anonymous'}</p>
                  <p style={{ fontSize: 12, color: '#6f9c81', margin: 0 }}>{user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Unknown'}</p>
                </div>
              </div>
              {callHistory.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[
                    { label: 'Calls', value: callHistory.length },
                    { label: 'Minutes', value: Math.floor(callHistory.reduce((s, e) => s + e.durationSecs, 0) / 60) },
                    { label: 'Friends', value: friends.length },
                  ].map((stat, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: isPremium ? '#f59e0b' : '#a3e635', margin: 0 }}>{stat.value}</p>
                      <p style={{ fontSize: 9, color: '#6f9c81', margin: '2px 0 0', fontWeight: 500 }}>{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interests */}
            {((user?.interests as string[] | undefined) ?? []).length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Your Interests</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {((user?.interests as string[] | undefined) ?? []).map((slug: string) => {
                    const interest = INTERESTS.find(i => i.slug === slug);
                    if (!interest) return null;
                    const Icon = interest.icon;
                    return (
                      <span key={slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)', border: 'none', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#1a2e05' }}>
                        <Icon size={11} />{interest.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Cities */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Active Cities</p>
                <div style={{ display: 'flex', gap: 3 }}>
                  {CITY_GROUPS.map((_, i) => (
                    <span key={i} style={{ width: i === cityGroupIndex ? 14 : 5, height: 3, borderRadius: 99, background: i === cityGroupIndex ? '#4a9f78' : 'rgba(255,255,255,0.12)', transition: 'all 0.3s' }} />
                  ))}
                </div>
              </div>
              <div key={cityGroupIndex} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, animation: 'cityFade 0.5s ease forwards' }}>
                {CITY_GROUPS[cityGroupIndex].map(city => (
                  <span key={city} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 500, color: '#6f9c81' }}>
                    <MapPin size={10} style={{ color: '#4a6b57', flexShrink: 0 }} />
                    {city}
                  </span>
                ))}
              </div>
            </div>

            {/* Call Streak */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Call Streak</p>
                <Flame size={13} style={{ color: callStreak > 0 ? accent : '#4a6b57' }} />
              </div>
              <p style={{ fontSize: 32, fontWeight: 800, color: callStreak > 0 ? accent : '#4a6b57', margin: '0 0 4px', lineHeight: 1, fontFamily: "'Oxanium', sans-serif" }}>{callStreak}</p>
              <p style={{ fontSize: 11, color: '#6f9c81', margin: 0 }}>day{callStreak !== 1 ? 's' : ''} in a row</p>
            </div>

            {/* Achievements */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Achievements</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-around' }}>
                {ACHIEVEMENTS.map(a => {
                  const Icon = a.icon;
                  return (
                    <div key={a.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: a.unlocked ? 1 : 0.3 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: a.unlocked ? accentBg : 'rgba(255,255,255,0.05)', border: `1.5px solid ${a.unlocked ? accentBorder : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={13} style={{ color: a.unlocked ? accent : '#4a6b57' }} />
                      </div>
                      <span style={{ fontSize: 9, color: a.unlocked ? '#8fcea8' : '#4a6b57', textAlign: 'center' as const, maxWidth: 40, lineHeight: 1.3 }}>{a.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Center column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            {/* Text section — top */}
            <div style={{ textAlign: 'center', paddingTop: 10, paddingBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#6f9c81', fontWeight: 500, marginBottom: 6 }}>{getGreeting()}, {user?.anonAlias?.split('#')[0] ?? 'Stranger'} 👋</p>
              <h1 style={{ fontSize: 'clamp(36px,4vw,52px)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1, margin: '0 0 20px', fontFamily: "'Oxanium', sans-serif" }}>
                Ready to <span style={{ color: isPremium ? '#f59e0b' : '#a3e635' }}>talk?</span>
              </h1>
            </div>

            {/* Orb + controls — centered in remaining space */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 16, gap: 0 }}>

            {/* Orb */}
            <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 52 }}>
              <style>{`@keyframes orbRingDesktop { 0% { transform:scale(1); opacity:0.5; } 100% { transform:scale(1.6); opacity:0; } }`}</style>
              <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', border: isPremium ? '2px solid rgba(245,158,11,0.45)' : '2px solid rgba(163,230,53,0.45)', animation: 'orbRingDesktop 2.4s ease-out infinite', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', border: isPremium ? '2px solid rgba(245,158,11,0.3)' : '2px solid rgba(163,230,53,0.3)', animation: 'orbRingDesktop 2.4s ease-out infinite 1.2s', pointerEvents: 'none' }} />
              <button
                onClick={() => navigate('/call')}
                style={{ width: 220, height: 220, borderRadius: '50%', background: isPremium ? 'linear-gradient(158deg,#fef9c3 0%,#fde68a 30%,#f59e0b 66%,#b45309 100%)' : 'linear-gradient(158deg,#ecfccb 0%,#bef264 30%,#84cc16 66%,#4d7c0f 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, boxShadow: 'none', border: 'none', cursor: 'pointer', transition: 'transform 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
              >
                <img src="/logo.png" alt="AppleTalk" style={{ width: 96, height: 96, objectFit: 'contain' }} />
                <span style={{ fontSize: 18, fontWeight: 800, color: '#1a2e05', fontFamily: "'Oxanium', sans-serif" }}>Tap to Talk</span>
              </button>
            </div>


            </div>{/* end orb+controls flex */}

            {/* ── Live Activity Feed ── */}
            <div style={{ width: '100%', maxWidth: 480, marginTop: 24, paddingBottom: 24 }}>
              <style>{`
                @keyframes livePulse { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.6);opacity:0} }
                @keyframes feedIn { 0%{opacity:0;transform:translateY(-10px)} 100%{opacity:1;transform:translateY(0)} }
              `}</style>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80', animation: 'livePulse 1.6s ease-out infinite' }} />
                    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Live Activity</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#2d5c3f', fontWeight: 500 }}>real-time</span>
                </div>
                {/* Feed list */}
                <div style={{ position: 'relative', overflow: 'hidden', maxHeight: 216 }}>
                  {activityFeed.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px',
                        opacity: Math.max(0.15, 1 - idx * 0.14),
                        animation: idx === 0 ? 'feedIn 0.35s ease forwards' : 'none',
                        borderBottom: idx < activityFeed.length - 1 ? '1px solid rgba(255,255,255,0.035)' : 'none',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: idx === 0 ? '#4ade80' : 'rgba(74,222,128,0.35)' }} />
                      <span style={{ flex: 1, fontSize: 12, color: idx === 0 ? '#c8e6b0' : '#6f9c81', fontWeight: idx === 0 ? 600 : 400, lineHeight: 1.4 }}>{item.text}</span>
                      {idx === 0 && <span style={{ fontSize: 10, color: '#4ade80', flexShrink: 0, fontWeight: 600 }}>just now</span>}
                    </div>
                  ))}
                  {/* Gradient fade at bottom */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(to bottom, transparent, rgba(5,20,13,0.95))', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

          </div>{/* end center column */}

          {/* Right sidebar */}
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Online friends */}
            {onlineFriends.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Online Friends ({onlineFriends.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {onlineFriends.slice(0, 4).map(friend => (
                    <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        onClick={() => useFriendStore.getState().setViewProfileId(friend.id)}
                      >
                        <Avatar name={friend.alias} size="sm" premium={friend.isPremium} />
                        <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: friend.isPremium ? '#fbbf24' : '#4ade80' }} />
                      </button>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#c8e6b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.alias.split('#')[0]}</span>
                      <button onClick={() => { setOutgoingFriendCall({ toId: friend.id, toAlias: friend.alias }); socket.emit('friend:call', { targetUserId: friend.id }); }} style={{ fontSize: 11, fontWeight: 700, background: isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)', border: 'none', color: '#1a2e05', borderRadius: 99, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Call</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent calls */}
            {(historyLoading || callHistory.length > 0) && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Recent Calls</p>
                  {!historyLoading && <button onClick={() => navigate('/history')} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#6f9c81', fontSize: 11, fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>
                    See all History
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>}
                </div>
                {historyLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Sh w={36} h={36} r="50%" />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <Sh w="50%" h={10} r={6} />
                          <Sh w="32%" h={8} r={6} />
                        </div>
                        <Sh w={40} h={22} r={99} />
                      </div>
                    ))}
                  </div>
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {callHistory.slice(0, 4).map(entry => {
                    const isFriend = hasFriend(entry.partnerId);
                    const isPending = hasRequest(entry.partnerId);
                    const isOnline = historyOnlineIds.has(entry.partnerId);
                    const displayName = isFriend ? entry.partnerAlias : 'Stranger';
                    return (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{ position: 'relative', flexShrink: 0, cursor: isFriend ? 'pointer' : 'default' }}
                        onClick={isFriend ? () => useFriendStore.getState().setViewProfileId(entry.partnerId) : undefined}
                      >
                        <Avatar name={displayName} size="sm" premium={entry.partnerIsPremium} />
                        <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: isOnline ? (entry.partnerIsPremium ? '#fbbf24' : '#4ade80') : 'rgba(255,255,255,0.15)', border: '1.5px solid #05140d' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: entry.partnerIsPremium ? '#fbbf24' : '#e2f5d3', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                          {entry.partnerIsPremium && <Crown size={11} color="#f59e0b" />}
                        </div>
                        <p style={{ fontSize: 10, color: '#4a6b57', margin: 0 }}>{Math.floor(entry.durationSecs / 60)}m · {timeAgo(entry.startedAt)}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        {!isFriend && !isPending && (
                          <button
                            onClick={() => sendRequest({ id: entry.partnerId, alias: entry.partnerAlias })}
                            style={{ width: 26, height: 26, borderRadius: '50%', background: isPremium ? 'rgba(245,158,11,0.1)' : 'rgba(163,230,53,0.1)', border: `1px solid ${isPremium ? 'rgba(245,158,11,0.25)' : 'rgba(163,230,53,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            title="Add Friend"
                          >
                            <UserPlus size={12} color={isPremium ? '#f59e0b' : '#a3e635'} />
                          </button>
                        )}
                        {isPending && <span style={{ fontSize: 9, color: '#6f9c81' }}>Pending</span>}
                        {isOnline ? (
                          <button onClick={() => callHistoryUser(entry.partnerId, displayName)} style={{ fontSize: 11, fontWeight: 700, background: isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)', border: 'none', color: '#1a2e05', borderRadius: 99, padding: '4px 10px', cursor: 'pointer' }}>Call</button>
                        ) : (
                          <span style={{ fontSize: 10, color: '#4a6b57' }}>Offline</span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* Tip */}
            <div style={{ background: isPremium ? 'rgba(245,158,11,0.07)' : 'rgba(163,230,53,0.07)', border: isPremium ? '1px solid rgba(245,158,11,0.18)' : '1px solid rgba(163,230,53,0.18)', borderRadius: 20, padding: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Tip</p>
              <p style={{ fontSize: 13, color: isPremium ? '#fde68a' : '#b6e57a', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>💡 {TIPS[tipIndex]}</p>
            </div>

            {/* Gender filter */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Match With</p>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.055)', borderRadius: 99, padding: 4 }}>
                {(['both', 'female', 'male'] as const).map(g => (
                  <button key={g} onClick={() => { if (g !== 'both' && !user?.isPremium) { navigate('/premium'); return; } setFilterGender(g); }} style={{ flex: 1, padding: '8px 0', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: filterGender === g ? 800 : 600, background: filterGender === g ? (isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)') : 'transparent', color: filterGender === g ? '#1a2e05' : (isPremium ? '#fef3c7' : '#d3f099'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    {g === 'both' ? 'Both' : g.charAt(0).toUpperCase() + g.slice(1)}
                    {g !== 'both' && <Crown size={12} style={{ color: filterGender === g ? '#b45309' : '#fbbf24' }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Goal */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Daily Goal</p>
                <Target size={13} style={{ color: accent }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {Array.from({ length: dailyGoal }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: i < callsToday ? accentGradient : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
              <p style={{ fontSize: 11, color: accentLight, fontWeight: 600, margin: 0 }}>{Math.min(callsToday, dailyGoal)}/{dailyGoal} calls today</p>
            </div>

            {/* Conversation Starter */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Conversation Starter</p>
                <MessageSquare size={13} style={{ color: accent }} />
              </div>
              <p style={{ fontSize: 12, color: '#c8e6b0', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>"{CONVERSATION_STARTERS[starterIndex]}"</p>
              <p style={{ fontSize: 10, color: '#4a6b57', margin: '6px 0 0' }}>Ask your next stranger this</p>
            </div>

            {/* Invite Friends */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#4a6b57', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Invite Friends</p>
                <Share2 size={13} style={{ color: accent }} />
              </div>
              <p style={{ fontSize: 12, color: '#8fcea8', margin: '0 0 12px' }}>Bring friends to AppleTalk</p>
              <button
                onClick={copyInviteLink}
                style={{ width: '100%', padding: '9px 0', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: accentGradient, color: '#1a2e05', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Share2 size={12} />
                {copied ? 'Link Copied!' : 'Copy Invite Link'}
              </button>
            </div>

          </div>
        </div>

      {/* ── Info / Landing-style section ── */}
      <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8, background: 'rgba(0,0,0,0.18)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '56px 24px 64px' }}>

          {/* How it works */}
          <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#4a9f78', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>How it works</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, color: '#e2f5d3', margin: '0 0 44px', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Talk to a stranger in<br />under 3 seconds
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20, marginBottom: 64 }}>
            {[
              { step: '01', Icon: Target, title: 'Set Your Interests', desc: 'Pick topics you love — music, gaming, travel, or anything else. We match you with someone who shares them.' },
              { step: '02', Icon: Mic, title: 'Tap to Talk', desc: 'Hit the button. Our system instantly pairs you with a real person. No loading screens, no waiting rooms.' },
              { step: '03', Icon: Users, title: 'Connect & Make Friends', desc: 'Had a great conversation? Add them as a friend and keep talking anytime — even after the call ends.' },
            ].map(({ step, Icon, title, desc }) => (
              <div key={step} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '24px 22px', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 18, right: 18, fontSize: 11, fontWeight: 800, color: 'rgba(163,230,53,0.25)', letterSpacing: '0.05em' }}>{step}</span>
                <div style={{ marginBottom: 14 }}><Icon size={28} color="#a3e635" strokeWidth={1.8} /></div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#c8e6b0', margin: '0 0 8px' }}>{title}</p>
                <p style={{ fontSize: 13, color: '#6f9c81', margin: 0, lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Why AppleTalk */}
          <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#4a9f78', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Why AppleTalk</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, color: '#e2f5d3', margin: '0 0 44px', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Built different.<br />Designed for real conversations.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 64 }}>
            {[
              { icon: EyeOff, title: 'Fully Anonymous', desc: 'No phone number. No email. No real name. Just a random alias — completely private from day one.' },
              { icon: Zap, title: 'Instant Matching', desc: 'Our real-time engine connects you in milliseconds. No ads, no paywalls before you can talk.' },
              { icon: Globe, title: 'Bangladesh & Beyond', desc: 'Most users are from Bangladesh — but we connect people from 50+ countries every day.' },
              { icon: Target, title: 'Interest-Based Pairing', desc: 'Talk to someone who actually shares your hobby. Not just a random person — a compatible one.' },
              { icon: Users, title: 'Make Real Friends', desc: 'AppleTalk is the only platform where strangers become actual friends. Add them and keep chatting forever.' },
              { icon: Shield, title: 'Safe by Design', desc: 'Audio-only by default. Report or skip anyone instantly. Our moderation team reviews every report within 24 hours.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '18px 16px' }}>
                <div style={{ marginBottom: 10 }}><Icon size={20} color="#4a9f78" /></div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#b6e57a', margin: '0 0 6px' }}>{title}</p>
                <p style={{ fontSize: 12, color: '#5c8a6e', margin: 0, lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Privacy statement */}
          <div style={{ background: 'rgba(163,230,53,0.05)', border: '1px solid rgba(163,230,53,0.12)', borderRadius: 20, padding: '32px 28px', textAlign: 'center', marginBottom: 64 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Lock size={28} color="#a3e635" /></div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#c8e6b0', margin: '0 0 12px', letterSpacing: '-0.01em' }}>Your privacy is not optional — it's the foundation</h3>
            <p style={{ fontSize: 14, color: '#6f9c81', margin: '0 auto', maxWidth: 560, lineHeight: 1.7 }}>
              AppleTalk was built on a simple principle: you should be able to have a real conversation without giving away who you are.
              We store no personal data, no call recordings, and no location beyond your country.
              Your anonymous alias changes every session if you want. What happens in the call, stays in the call.
            </p>
          </div>

          {/* Community promise */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
            {[
              { icon: Ban, title: 'Zero Tolerance', desc: 'Harassment, hate speech, and inappropriate content are permanently banned — no warnings, no excuses.' },
              { icon: Eye, title: 'Human Moderation', desc: 'Every report is reviewed by a real person, not just an algorithm. We take safety personally.' },
              { icon: Bot, title: 'No Bots, Ever', desc: 'Every person you talk to is a verified human. We use device fingerprinting to block bot accounts automatically.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '16px 18px' }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}><Icon size={18} color="#4a9f78" /></span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#b6e57a', margin: '0 0 5px' }}>{title}</p>
                  <p style={{ fontSize: 12, color: '#5c8a6e', margin: 0, lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
      </div>{/* end home-scroll */}

      {/* Toasts */}
      {alreadyFriendToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-700 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-sm text-leaf-50">
            You and <span className="text-mango-500">{alreadyFriendToast}</span> are already friends
          </span>
        </div>
      )}

      {offlineToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-700 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
          <span className="text-sm text-leaf-50">User is offline — can't call right now</span>
        </div>
      )}

      {reportDoneToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-700 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <span className="text-sm text-leaf-50">Report submitted. We'll review it.</span>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setReportTarget(null)} />
          <div className="relative w-full sm:max-w-sm bg-leaf-800 rounded-t-2xl sm:rounded-2xl border border-leaf-700 p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag size={16} className="text-red-400" />
                <span className="font-semibold text-leaf-50 text-sm">Report user</span>
              </div>
              <button onClick={() => setReportTarget(null)} className="text-leaf-300 hover:text-leaf-50 transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-leaf-300 text-xs">
              Reporting <span className="text-leaf-50 font-medium">{reportTarget.alias}</span>. Reports are anonymous and reviewed by our team.
            </p>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide">Reason</p>
              <div className="flex flex-wrap gap-2">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setReportReason(r.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                      reportReason === r.value
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-leaf-700 text-leaf-300 hover:border-leaf-600',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-1.5">
                Details <span className="text-leaf-300/50 font-normal normal-case">(optional)</span>
              </p>
              <textarea
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe what happened..."
                className="w-full bg-leaf-700 text-leaf-50 placeholder:text-leaf-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
              />
            </div>
            <button
              onClick={submitReport}
              disabled={!reportReason || reportSubmitting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              {reportSubmitting ? 'Submitting...' : <><Flag size={14} /> Submit Report</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
