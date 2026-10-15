import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';
import { useFriendStore } from '../store/friend.store';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import {
  Users, UserCircle, Bell, X, ChevronLeft, Check,
  Music, Gamepad2, Sparkles, Film, BookOpen, Plane, UtensilsCrossed,
  Trophy, Cpu, Palette, Code2, Dumbbell,
  SlidersHorizontal, MessageCircle, UserMinus, MoreVertical, Phone, Send, ArrowLeft, UserPlus,
  History, UserX, Clock3, Flag, Rss, Crown,
  type LucideIcon,
} from 'lucide-react';
import { cn, formatDuration } from '../lib/utils';
import { api } from '../lib/api';

interface ChatMsg {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
}

interface ChatThread {
  [friendId: string]: ChatMsg[];
}

interface CallHistoryEntry {
  id: string;
  partnerId: string;
  partnerAlias: string;
  partnerRegion: string | null;
  partnerGender: string | null;
  startedAt: string;
  durationSecs: number;
}

type Drawer = 'friends' | 'profile' | 'filter' | 'history' | null;

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

function Avatar({ size = 'md', premium = false }: { name: string; size?: 'sm' | 'md' | 'lg'; premium?: boolean }) {
  const sizeClass = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  const iconSize = size === 'lg' ? 36 : size === 'sm' ? 20 : 26;
  return (
    <div className={`${sizeClass} rounded-full bg-leaf-500 flex items-center justify-center overflow-hidden select-none`}
      style={premium ? { boxShadow: '0 0 0 2px #f59e0b' } : undefined}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="7" r="4" />
        <path d="M2 22c0-5.5 4.5-9 10-9s10 3.5 10 9" />
      </svg>
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

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'other', label: 'Other' },
];

interface AppHeaderProps {
  onLogoClick?: () => void;
}

export function AppHeader({ onLogoClick }: AppHeaderProps) {
  const { user } = useAuthStore();
  const { saveProfile } = useAuth();
  const { friends, sentRequests, incomingRequests, cancelRequest, removeFriend, loadFriends, loadIncomingRequests, addFriendFromAccept, removeIncomingRequest, hasFriend, hasRequest, sendRequest, setOutgoingFriendCall } = useFriendStore();
  const socket = useSocket();
  const navigate = useNavigate();

  const [drawer, setDrawer] = useState<Drawer>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [friendTab, setFriendTab] = useState<'friends' | 'received' | 'sent'>('friends');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // History state
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOnlineIds, setHistoryOnlineIds] = useState<Set<string>>(new Set());
  const [offlineToast, setOfflineToast] = useState<string | null>(null);

  const [allowIncomingCalls, setAllowIncomingCalls] = useState<boolean>(() => {
    try { return localStorage.getItem('mangotalk_allow_incoming') !== 'false'; } catch { return true; }
  });

  function toggleAllowIncomingCalls() {
    const next = !allowIncomingCalls;
    setAllowIncomingCalls(next);
    localStorage.setItem('mangotalk_allow_incoming', String(next));
  }

  const [alreadyFriendToast, setAlreadyFriendToast] = useState<string | null>(null);

  // Report modal state
  const [reportTarget, setReportTarget] = useState<{ id: string; alias: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDoneToast, setReportDoneToast] = useState(false);

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
    if (historyLoading) return;
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

  // Chat state
  const [chatFriendId, setChatFriendId] = useState<string | null>(null);
  const [chatThreads, setChatThreads] = useState<ChatThread>({});
  const [chatLoadedIds, setChatLoadedIds] = useState<Set<string>>(new Set());
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null);
  const [chatUnread, setChatUnread] = useState<Record<string, number>>({});
  const [chatSeen, setChatSeen] = useState<Record<string, boolean>>({});
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const friendsDrawerRef = useRef<HTMLDivElement>(null);

  const totalUnread = Object.values(chatUnread).reduce((sum, n) => sum + n, 0);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; body: string; read: boolean; createdAt: string }[]>([]);
  const unreadNotifCount = notifications.filter(n => !n.read).length;

  // Filter state
  const FILTER_INTERESTS_KEY = 'mangotalk_filter_interests';
  const [filterGender, setFilterGender] = useState<'both' | 'female' | 'male'>(
    () => (localStorage.getItem('mangotalk_filter_gender') as 'both' | 'female' | 'male') ?? 'both'
  );
  const [filterInterests, setFilterInterests] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mangotalk_filter_interests') ?? '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(FILTER_INTERESTS_KEY, JSON.stringify(filterInterests));
  }, [filterInterests]);

  useEffect(() => {
    localStorage.setItem('mangotalk_filter_gender', filterGender);
  }, [filterGender]);

  function toggleFilterInterest(slug: string) {
    setFilterInterests(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  }
  const activeFilterCount = (filterGender !== 'both' ? 1 : 0) + (filterInterests.length > 0 ? 1 : 0);

  // Profile edit state
  const [alias, setAlias] = useState(user?.anonAlias ?? '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>((user?.interests as string[]) ?? []);
  const [saving, setSaving] = useState(false);

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const interests = user?.interests as string[] | undefined;
  const friendsOnlineCount = friends.filter(f => f.isOnline).length;

  // Load on mount
  useEffect(() => {
    // Load friends + status if not loaded yet
    if (friends.length === 0) {
      loadFriends().then(() => {
        const ids = useFriendStore.getState().friends.map(f => f.id);
        if (ids.length > 0) socket.emit('users:status-check', { userIds: ids });
      });
      loadIncomingRequests();
    }
    loadHistory();
    api.get<{ id: string; type: string; title: string; body: string; read: boolean; createdAt: string }[]>('/notifications')
      .then(res => setNotifications(res.data))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check history on socket reconnect
  useEffect(() => {
    function onConnect() {
      emitHistoryStatusCheck(callHistoryRef.current);
    }
    socket.on('connect', onConnect);
    return () => { socket.off('connect', onConnect); };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodically re-check history partner online status
  useEffect(() => {
    const interval = setInterval(() => {
      emitHistoryStatusCheck(callHistoryRef.current);
    }, 30_000);
    return () => clearInterval(interval);
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intercept browser back button when a drawer is open
  useEffect(() => {
    if (!drawer) return;
    window.history.pushState({ __drawerOpen: true }, '');
    function onPopState() {
      setDrawer(null);
      setIsEditing(false);
      setChatFriendId(null);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [drawer]);

  // Keep friend chat drawer above the virtual keyboard on mobile
  useEffect(() => {
    if (!chatFriendId) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function onViewportChange() {
      const el = friendsDrawerRef.current;
      if (!el || !vv) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
      el.style.height = keyboardHeight > 0 ? `${vv.height}px` : '';
    }
    vv.addEventListener('resize', onViewportChange);
    onViewportChange();
    return () => {
      vv.removeEventListener('resize', onViewportChange);
      if (friendsDrawerRef.current) friendsDrawerRef.current.style.height = '';
    };
  }, [chatFriendId]);

  // Scroll chat to bottom
  useEffect(() => {
    const msgs = chatFriendId ? (chatThreads[chatFriendId] ?? []) : [];
    if (chatContainerRef.current && msgs.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatFriendId, chatThreads]);

  // Socket: history partner online status
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

  // Receive friend chat messages
  useSocketEvent('friend:chat', (payload: { id?: string; fromUserId: string; text: string; time: string }) => {
    const { id, fromUserId, text, time } = payload;
    const msg: ChatMsg = {
      id: id ?? Date.now().toString(),
      sender: 'them',
      text,
      time,
    };
    setChatThreads(prev => ({
      ...prev,
      [fromUserId]: [...(prev[fromUserId] ?? []), msg],
    }));
    setChatUnread(prev => {
      const current = chatFriendId === fromUserId ? 0 : (prev[fromUserId] ?? 0) + 1;
      return { ...prev, [fromUserId]: current };
    });

    // If this chat is currently open, mark as read immediately so sender gets 'Seen'
    if (chatFriendId === fromUserId) {
      api.patch(`/friends/${fromUserId}/messages/read`).catch(() => {});
    }

    // Browser notification when tab is not visible
    if (document.visibilityState !== 'visible' && Notification.permission === 'granted') {
      const senderAlias = useFriendStore.getState().friends.find(f => f.id === fromUserId)?.alias ?? 'Friend';
      new Notification(senderAlias, {
        body: text,
        icon: '/logo.png',
        tag: `chat-${fromUserId}`,
      });
    }
  });

  useSocketEvent('friend:chat-seen', ({ byUserId }: { byUserId: string }) => {
    setChatSeen(prev => ({ ...prev, [byUserId]: true }));
  });

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

  function closeDrawer() {
    setDrawer(null);
    setIsEditing(false);
    setChatFriendId(null);
  }

  function openEdit() {
    setAlias(user?.anonAlias ?? '');
    setSelectedInterests((user?.interests as string[]) ?? []);
    setIsEditing(true);
  }

  function toggleInterest(slug: string) {
    setSelectedInterests(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < 5 ? [...prev, slug] : prev
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveProfile({ anonAlias: alias, interests: selectedInterests });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function callHistoryUser(partnerId: string, partnerAlias: string) {
    if (!historyOnlineIds.has(partnerId)) {
      setOfflineToast(partnerAlias);
      setTimeout(() => setOfflineToast(null), 3000);
      return;
    }
    setOutgoingFriendCall({ toId: partnerId, toAlias: partnerAlias });
    socket.emit('friend:call', { targetUserId: partnerId });
    closeDrawer();
  }

  const chatFriend = chatFriendId ? (friends.find(f => f.id === chatFriendId) ?? null) : null;
  const chatMessages = chatFriendId ? (chatThreads[chatFriendId] ?? []) : [];

  function openChat(friendId: string) {
    setChatFriendId(friendId);
    setChatInput('');
    setChatUnread(prev => ({ ...prev, [friendId]: 0 }));
    setDrawer('friends');

    // Fetch history only once per friend per session
    if (!chatLoadedIds.has(friendId)) {
      setChatLoadingId(friendId);
      api.get<{ id: string; fromUserId: string; text: string; createdAt: string }[]>(
        `/friends/${friendId}/messages`
      ).then(res => {
        const history: ChatMsg[] = res.data.map(m => ({
          id: m.id,
          sender: m.fromUserId === user?.id ? 'me' : 'them',
          text: m.text,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setChatThreads(prev => ({
          ...prev,
          // Prepend history, keep any new messages that arrived during load
          [friendId]: [
            ...history,
            ...(prev[friendId] ?? []).filter(m => !history.some(h => h.id === m.id)),
          ],
        }));
        setChatLoadedIds(prev => new Set([...prev, friendId]));
      }).catch(() => {
        setChatLoadedIds(prev => new Set([...prev, friendId]));
      }).finally(() => {
        setChatLoadingId(null);
        api.patch(`/friends/${friendId}/messages/read`).catch(() => {});
      });
    }
  }

  function closeChat() {
    setChatFriendId(null);
    setChatInput('');
  }

  function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || !chatFriendId) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg: ChatMsg = {
      id: Date.now().toString(),
      sender: 'me',
      text,
      time,
    };
    setChatThreads(prev => ({
      ...prev,
      [chatFriendId]: [...(prev[chatFriendId] ?? []), msg],
    }));
    socket.emit('friend:chat', { toUserId: chatFriendId, text, time });
    setChatInput('');
    // Reset seen when we send a new message
    setChatSeen(prev => ({ ...prev, [chatFriendId]: false }));
  }

  return (
    <>
      {/* Header bar */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3.5 bg-leaf-600">
        <button onClick={() => { closeDrawer(); onLogoClick?.(); }} className="flex items-center gap-2 cursor-pointer">
          <img src="/logo.png" alt="AppleTalk" className="w-7 h-7 shrink-0 self-center" />
          <span className="font-serif font-bold text-lg text-white self-center">Apple<span className="text-mango-400">Talk</span><Rss size={16} className="inline-block ml-0.5 mb-2 text-mango-400" /></span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { closeDrawer(); setDrawer(drawer === 'filter' ? null : 'filter'); }}
            className="relative p-2 rounded-xl hover:bg-leaf-500 text-white/70 hover:text-white transition-colors"
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-mango-400 border border-leaf-600" />
            )}
          </button>
          <button
            onClick={() => { closeDrawer(); setDrawer(drawer === 'history' ? null : 'history'); loadHistory(); }}
            className="p-2 rounded-xl hover:bg-leaf-500 text-white/70 hover:text-white transition-colors"
          >
            <History size={20} />
          </button>
          {/* Friends icon */}
          <button
            onClick={() => { closeDrawer(); setDrawer(drawer === 'friends' ? null : 'friends'); }}
            className="relative p-2 rounded-xl hover:bg-leaf-500 text-white/70 hover:text-white transition-colors"
          >
            <Users size={20} />
            {totalUnread > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-mango-500 border border-leaf-600 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            ) : (friendsOnlineCount > 0 || incomingRequests.length > 0) && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 border border-leaf-600" />
            )}
          </button>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => { setProfileDropdownOpen(v => !v); setNotifOpen(false); }}
              className="relative p-2 rounded-xl hover:bg-leaf-500 text-white/70 hover:text-white transition-colors"
            >
              <UserCircle size={20} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 border border-leaf-600 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            {(profileDropdownOpen || notifOpen) && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => { setProfileDropdownOpen(false); setNotifOpen(false); }} />
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-11 z-40 w-48 bg-leaf-800 border border-leaf-600 rounded-2xl shadow-xl overflow-hidden py-1">
                    <button
                      onClick={() => { setProfileDropdownOpen(false); closeDrawer(); setDrawer('profile'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/80 hover:bg-leaf-700 hover:text-white transition-colors"
                    >
                      <UserCircle size={16} />
                      My Profile
                    </button>
                    <button
                      onClick={() => { setProfileDropdownOpen(false); openNotifications(); }}
                      className="relative w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/80 hover:bg-leaf-700 hover:text-white transition-colors"
                    >
                      <Bell size={16} />
                      Notifications
                      {unreadNotifCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                          {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                        </span>
                      )}
                    </button>
                  </div>
                )}
                {notifOpen && (
                  <div className="absolute right-0 top-11 z-40 w-72 bg-leaf-800 border border-leaf-600 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-leaf-600 flex items-center justify-between">
                      <p className="text-white font-semibold text-sm">Notifications</p>
                      {notifications.length > 0 && (
                        <button
                          onClick={() => { api.patch('/notifications/read').catch(() => {}); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }}
                          className="text-xs text-white/40 hover:text-white/70 transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifLoading ? (
                        [1, 2, 3].map(i => (
                          <div key={i} className="px-4 py-3 border-b border-leaf-700 last:border-0 flex items-start gap-2.5">
                            <div className="shimmer w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ minWidth: 8 }} />
                            <div className="flex-1 flex flex-col gap-2">
                              <div className="shimmer h-3 rounded" style={{ width: '55%' }} />
                              <div className="shimmer h-2.5 rounded" style={{ width: '80%' }} />
                              <div className="shimmer h-2 rounded" style={{ width: '30%' }} />
                            </div>
                          </div>
                        ))
                      ) : notifications.length === 0 ? (
                        <p className="text-white/40 text-sm text-center py-8">No notifications yet</p>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`px-4 py-3 border-b border-leaf-700 last:border-0 ${!n.read ? 'bg-white/5' : ''}`}>
                            <div className="flex items-start gap-2.5">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'subscription_approved' ? 'bg-green-400' : 'bg-red-400'}`} />
                              <div>
                                <p className="text-white text-sm font-medium">{n.title}</p>
                                <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{n.body}</p>
                                <p className="text-white/30 text-[10px] mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Backdrop — fixed so it works on any page */}
      {drawer && <div className="fixed inset-0 bg-black/40 z-10" onClick={closeDrawer} />}

      {/* Filter Drawer */}
      <div className={`fixed top-0 left-0 h-dvh w-full sm:w-96 bg-leaf-800 shadow-2xl z-20 flex flex-col transition-transform duration-300 ${drawer === 'filter' ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 bg-leaf-700">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-white/70" />
            <h2 className="font-semibold text-white">Filters</h2>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mango-500 text-white text-[10px] font-bold">{activeFilterCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilterGender('both'); setFilterInterests([]); }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Reset
              </button>
            )}
            <button onClick={closeDrawer} className="p-1.5 rounded-xl hover:bg-leaf-600 text-white/60 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <div>
            <p className="text-xs font-semibold text-leaf-400 mb-3 uppercase tracking-wide">Gender</p>
            <div className="flex gap-2">
              {(['both', 'female', 'male'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => {
                    if (g !== 'both' && !user?.isPremium) {
                      navigate('/premium');
                      return;
                    }
                    setFilterGender(g);
                  }}
                  className={cn(
                    'flex-1 py-2 rounded-xl border-2 text-sm font-medium capitalize transition-all',
                    filterGender === g
                      ? 'border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-md bg-white/15'
                      : 'border-leaf-600 text-leaf-300 hover:border-leaf-400',
                  )}
                >
                  <span className="flex items-center justify-center gap-1">
                    {g === 'both' ? 'Both' : g === 'female' ? 'Female' : 'Male'}
                    {g !== 'both' && <Crown size={14} className="text-yellow-400" />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-leaf-400 mb-3 uppercase tracking-wide">Interests</p>
            <div className="flex flex-wrap gap-1.5">
              {INTERESTS.map(i => (
                <button
                  key={i.slug}
                  onClick={() => toggleFilterInterest(i.slug)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs border-2 transition-all',
                    filterInterests.includes(i.slug)
                      ? 'border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-md bg-white/15'
                      : 'border-leaf-600 text-leaf-300 hover:border-leaf-400',
                  )}
                >
                  <i.icon size={11} />
                  <span>{i.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-leaf-700 flex justify-center">
          <button
            onClick={closeDrawer}
            className="border border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-md bg-white/15 hover:bg-white/25 font-semibold px-6 py-3 rounded-2xl text-sm transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Friends Drawer */}
      <div ref={friendsDrawerRef} className={`fixed top-0 left-0 h-dvh w-full sm:w-96 bg-leaf-800 shadow-2xl z-20 flex flex-col overflow-hidden transition-transform duration-300 ${drawer === 'friends' ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Chat View */}
        {chatFriendId ? (
          <>
            <div className="shrink-0 flex items-center gap-3 px-4 py-3.5 bg-leaf-700">
              <button onClick={closeChat} className="p-1.5 rounded-xl hover:bg-leaf-600 text-white/60 hover:text-white transition-colors">
                <ArrowLeft size={18} />
              </button>
              {chatFriend && (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <Avatar name={chatFriend.alias} size="sm" premium={chatFriend.isPremium} />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-leaf-700 ${chatFriend.isOnline ? (chatFriend.isPremium ? 'bg-yellow-400' : 'bg-green-400') : 'bg-gray-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${chatFriend.isPremium ? 'text-amber-400' : user?.isPremium && chatFriend.gender === 'female' ? 'text-pink-400' : 'text-white'}`}>{chatFriend.alias}</p>
                    <p className="text-xs text-white/50">{chatFriend.isOnline ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
              )}
              <button onClick={closeDrawer} className="p-1.5 rounded-xl hover:bg-leaf-600 text-white/60 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
              {chatLoadingId === chatFriendId ? (
                // Shimmer while fetching history
                <>
                  {[70, 55, 80, 45, 65].map((w, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <div className="shimmer rounded-2xl" style={{ width: `${w}%`, height: 40 }} />
                    </div>
                  ))}
                </>
              ) : chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-leaf-500">
                  <MessageCircle size={32} className="opacity-40" />
                  <p className="text-sm text-leaf-400">No messages yet</p>
                  <p className="text-xs text-leaf-500">Say hi to {chatFriend?.alias}!</p>
                </div>
              ) : (
                (() => {
                  const isSeen = chatFriendId ? (chatSeen[chatFriendId] ?? false) : false;
                  const lastMyMsgIdx = chatMessages.reduce((last, m, i) => m.sender === 'me' ? i : last, -1);
                  return chatMessages.map((msg, i) => (
                    <div key={msg.id}>
                      <div className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                          msg.sender === 'me'
                            ? 'bg-mango-500 text-white rounded-br-sm'
                            : 'bg-leaf-700 text-leaf-100 rounded-bl-sm'
                        }`}>
                          <p>{msg.text}</p>
                          <p className="text-[10px] mt-0.5 opacity-50">{msg.time}</p>
                        </div>
                      </div>
                      {isSeen && i === lastMyMsgIdx && (
                        <p className="text-[10px] text-right pr-1 mt-0.5" style={{ color: '#8fcea8', opacity: 0.7 }}>Seen</p>
                      )}
                    </div>
                  ));
                })()
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-leaf-700 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                placeholder={`Message ${chatFriend?.alias ?? ''}...`}
                autoFocus
                className="flex-1 bg-leaf-700 text-white placeholder:text-leaf-500 rounded-full px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-mango-500/50 border border-leaf-600"
              />
              <button
                onPointerDown={e => e.preventDefault()}
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                className="w-9 h-9 rounded-full bg-mango-500 hover:bg-mango-600 disabled:opacity-40 flex items-center justify-center transition-all"
              >
                <Send size={15} className="text-white" />
              </button>
            </div>
          </>
        ) : (
          /* Friends List View */
          <>
            <div className="shrink-0 bg-leaf-700 px-5 pt-4 pb-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white">Friends</h2>
                <button onClick={closeDrawer} className="p-1.5 rounded-xl hover:bg-leaf-600 text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="flex">
                <button
                  onClick={() => setFriendTab('friends')}
                  className={cn('flex-1 py-2 text-xs font-semibold border-b-2 transition-colors', friendTab === 'friends' ? `${user?.isPremium ? 'border-yellow-400' : 'border-mango-400'} text-white` : 'border-transparent text-white/40 hover:text-white/70')}
                >
                  Friends {friends.length > 0 && `(${friends.length})`}
                </button>
                <button
                  onClick={() => setFriendTab('received')}
                  className={cn('flex-1 py-2 text-xs font-semibold border-b-2 transition-colors relative', friendTab === 'received' ? `${user?.isPremium ? 'border-yellow-400' : 'border-mango-400'} text-white` : 'border-transparent text-white/40 hover:text-white/70')}
                >
                  Received
                  {incomingRequests.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[10px] font-bold">{incomingRequests.length}</span>
                  )}
                </button>
                <button
                  onClick={() => setFriendTab('sent')}
                  className={cn('flex-1 py-2 text-xs font-semibold border-b-2 transition-colors relative', friendTab === 'sent' ? `${user?.isPremium ? 'border-yellow-400' : 'border-mango-400'} text-white` : 'border-transparent text-white/40 hover:text-white/70')}
                >
                  Sent
                  {sentRequests.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-mango-500 text-white text-[10px] font-bold">{sentRequests.length}</span>
                  )}
                </button>
              </div>
            </div>

            {openMenuId && <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />}

            {friendTab === 'friends' && (
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {friends.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-leaf-500 gap-2">
                    <Users size={32} className="opacity-40" />
                    <p className="text-sm text-leaf-400">No friends yet</p>
                    <p className="text-xs text-leaf-500">Add friends during a call</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {friends.map(friend => (
                      <li key={friend.id} className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-leaf-700 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            className="relative shrink-0 focus:outline-none"
                            onClick={() => { useFriendStore.getState().setViewProfileId(friend.id); closeDrawer(); }}
                          >
                            <Avatar name={friend.alias} size="sm" premium={friend.isPremium} />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-leaf-800 ${friend.isOnline ? (friend.isPremium ? 'bg-yellow-400' : 'bg-green-400') : 'bg-gray-500'}`} />
                          </button>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium leading-tight truncate ${friend.isPremium ? 'text-amber-400' : user?.isPremium && friend.gender === 'female' ? 'text-pink-400' : 'text-leaf-100'}`}>{friend.alias}</p>
                            <p className="text-xs text-leaf-400">
                              {friend.isOnline ? 'Online now' : friend.lastSeen ? timeAgo(friend.lastSeen) : 'Offline'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            onClick={() => openChat(friend.id)}
                            className="relative p-1.5 rounded-full text-leaf-400 hover:text-white hover:bg-leaf-600 transition-colors"
                            title="Chat"
                          >
                            <MessageCircle size={22} />
                            {(chatUnread[friend.id] ?? 0) > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 rounded-full bg-mango-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                                {(chatUnread[friend.id] ?? 0) > 9 ? '9+' : chatUnread[friend.id]}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setOutgoingFriendCall({ toId: friend.id, toAlias: friend.alias });
                              socket.emit('friend:call', { targetUserId: friend.id });
                              closeDrawer();
                            }}
                            className="p-1.5 rounded-full bg-mango-500 text-white hover:bg-mango-600 transition-all active:scale-95"
                            title="Call"
                          >
                            <Phone size={15} />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === friend.id ? null : friend.id)}
                              className="p-1.5 rounded-full text-leaf-500 hover:text-white hover:bg-leaf-600 transition-colors"
                            >
                              <MoreVertical size={15} />
                            </button>
                            {openMenuId === friend.id && (
                              <div className="absolute right-0 top-8 bg-leaf-700 rounded-xl shadow-lg border border-leaf-600 py-1 z-30 w-36" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => { removeFriend(friend.id).then(() => socket.emit('friend:remove', { friendId: friend.id })); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-leaf-600 transition-colors"
                                >
                                  <UserMinus size={14} />
                                  Unfriend
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {friendTab === 'received' && (
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {incomingRequests.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-leaf-500 gap-2">
                    <Users size={32} className="opacity-40" />
                    <p className="text-sm text-leaf-400">No incoming requests</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {incomingRequests.map(req => (
                      <li key={req.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-leaf-700/50 border border-leaf-700">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={req.alias} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-leaf-100 leading-tight truncate">{req.alias}</p>
                            <p className="text-xs text-leaf-400">{timeAgo(req.sentAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button
                            onClick={() => {
                              addFriendFromAccept({ id: req.id, alias: req.alias });
                              removeIncomingRequest(req.id);
                              socket.emit('friend:respond', { requesterId: req.id, accept: true });
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
                          >
                            <Check size={12} />
                            Accept
                          </button>
                          <button
                            onClick={() => {
                              removeIncomingRequest(req.id);
                              socket.emit('friend:respond', { requesterId: req.id, accept: false });
                            }}
                            className="p-1.5 rounded-lg hover:bg-leaf-600 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {friendTab === 'sent' && (
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {sentRequests.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-leaf-500 gap-2">
                    <Clock3 size={32} className="opacity-40" />
                    <p className="text-sm text-leaf-400">No pending requests</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {sentRequests.map(req => (
                      <li key={req.id} className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-leaf-700 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar name={req.alias} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-leaf-100 leading-tight">{req.alias}</p>
                            <p className="text-xs text-leaf-400">{timeAgo(req.sentAt)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => cancelRequest(req.id)}
                          className="p-1.5 rounded-full hover:bg-leaf-600 text-red-400 hover:text-red-300 transition-colors"
                          title="Cancel request"
                        >
                          <UserX size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* History Drawer */}
      <div className={`fixed top-0 left-0 h-dvh w-full sm:w-96 bg-leaf-800 shadow-2xl z-20 flex flex-col transition-transform duration-300 ${drawer === 'history' ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="shrink-0 bg-leaf-700 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-white/70" />
              <h2 className="font-semibold text-white">Call History</h2>
            </div>
            <button onClick={closeDrawer} className="p-1.5 rounded-xl hover:bg-leaf-600 text-white/60 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <button
            onClick={toggleAllowIncomingCalls}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-leaf-800 border border-leaf-600 hover:border-leaf-500 transition-colors"
          >
            <span className="text-sm text-white/80 font-medium">Allow Incoming Call Requests</span>
            <div
              className="shrink-0 transition-colors duration-200"
              style={{ width: '40px', height: '22px', borderRadius: '11px', background: allowIncomingCalls ? (user?.isPremium ? '#f59e0b' : '#22c55e') : '#3a5a47', position: 'relative' }}
            >
              <div
                className="absolute bg-white"
                style={{ width: '18px', height: '18px', borderRadius: '9px', top: '2px', left: allowIncomingCalls ? '20px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
              />
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-chat">
          {historyLoading ? (
            <div className="h-full flex items-center justify-center text-leaf-400 text-sm">Loading...</div>
          ) : callHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-leaf-500 gap-2">
              <History size={32} className="opacity-40" />
              <p className="text-sm text-leaf-400">No call history yet</p>
              <p className="text-xs text-leaf-500">Completed calls will appear here</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {callHistory.map(entry => {
                const isOnline = historyOnlineIds.has(entry.partnerId);
                const entryIsFriend = hasFriend(entry.partnerId);
                const entryDisplayName = entryIsFriend ? entry.partnerAlias : 'Stranger';
                return (
                  <li key={entry.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-leaf-700 transition-colors">
                    <div className="relative shrink-0">
                      <Avatar name={entryDisplayName} size="sm" />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-leaf-800 ${isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${user?.isPremium && entry.partnerGender === 'female' ? 'text-pink-400' : 'text-leaf-100'}`}>{entryDisplayName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-leaf-500">{formatDuration(entry.durationSecs)}</span>
                        <span className="text-xs text-leaf-500">{timeAgo(entry.startedAt)}</span>
                      </div>
                    </div>
                    {(() => {
                      const requestSent = hasRequest(entry.partnerId);
                      return (
                        <button
                          disabled={requestSent}
                          onClick={() => {
                            if (entryIsFriend) {
                              setAlreadyFriendToast(entry.partnerAlias);
                              setTimeout(() => setAlreadyFriendToast(null), 3000);
                              return;
                            }
                            if (requestSent) return;
                            sendRequest({ id: entry.partnerId, alias: entry.partnerAlias });
                            socket.emit('friend:request', { targetUserId: entry.partnerId });
                          }}
                          className={`shrink-0 p-1.5 rounded-full transition-all active:scale-95 ${
                            entryIsFriend
                              ? 'bg-leaf-700 text-green-400 hover:bg-leaf-600'
                              : requestSent
                              ? 'bg-leaf-700 text-leaf-500 cursor-default'
                              : user?.isPremium
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400'
                              : 'bg-leaf-700 hover:bg-leaf-600 text-white'
                          }`}
                          title={entryIsFriend ? 'Already friends' : requestSent ? 'Request sent' : `Add ${entry.partnerAlias}`}
                        >
                          <UserPlus size={15} />
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => callHistoryUser(entry.partnerId, entryDisplayName)}
                      className={`shrink-0 p-1.5 rounded-full transition-all active:scale-95 ${isOnline ? 'bg-mango-500 hover:bg-mango-600 text-white' : 'bg-leaf-700 text-leaf-500 cursor-not-allowed'}`}
                      title={isOnline ? `Call ${entryDisplayName}` : 'Offline'}
                    >
                      <Phone size={15} />
                    </button>
                    <button
                      onClick={() => { setReportTarget({ id: entry.partnerId, alias: entry.partnerAlias }); setReportReason(''); setReportDescription(''); }}
                      className="shrink-0 p-1.5 rounded-full bg-leaf-700 hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-all active:scale-95"
                      title="Report user"
                    >
                      <Flag size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Profile Drawer */}
      <div className={`fixed top-0 left-0 h-dvh w-full sm:w-96 bg-leaf-800 shadow-2xl z-20 flex flex-col transition-transform duration-300 ${drawer === 'profile' ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 bg-leaf-700"
          style={user?.isPremium ? { borderBottom: '1px solid rgba(245,158,11,0.3)' } : undefined}>
          {isEditing ? (
            <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 text-white/60 hover:text-white transition-colors">
              <ChevronLeft size={18} />
              <span className="text-sm font-medium">Back</span>
            </button>
          ) : (
            <h2 className={`font-semibold ${user?.isPremium ? 'text-amber-400' : 'text-white'}`}>My Profile</h2>
          )}
          <button onClick={closeDrawer} className="p-1.5 rounded-xl hover:bg-leaf-600 text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {!isEditing && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="text-center py-3">
              <div className="mx-auto mb-3 w-fit">
                <Avatar name={user?.anonAlias ?? '?'} size="lg" premium={user?.isPremium ?? false} />
              </div>
              <p className="font-semibold text-white">{user?.anonAlias}</p>
              {user?.isPremium ? (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-semibold">
                    <Crown size={11} /> Premium
                  </span>
                  {user.premiumUntil && (
                    <span className="text-xs text-leaf-400">
                      until {new Date(user.premiumUntil).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => navigate('/premium')}
                  className="mt-2 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-white text-xs font-semibold transition-all mx-auto shadow-lg shadow-yellow-500/20"
                >
                  <Crown size={11} /> Upgrade to Premium
                </button>
              )}
            </div>
            <div className="space-y-2">
              <div className="py-3 px-4 bg-leaf-700 rounded-xl">
                <span className="text-sm text-leaf-400">Interests</span>
                {interests?.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {interests.map(slug => {
                      const found = INTERESTS.find(i => i.slug === slug);
                      return found ? (
                        <span key={slug} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={user?.isPremium
                            ? { background: 'linear-gradient(150deg,#fde68a,#f59e0b)', color: '#1a2e05', border: 'none' }
                            : { border: '1px solid rgba(255,255,255,0.3)', color: 'white', backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.15)' }
                          }>
                          <found.icon size={11} />
                          <span>{found.label}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-leaf-500 mt-1">None yet</p>
                )}
              </div>
              <div className="flex items-center justify-between py-3 px-4 bg-leaf-700 rounded-xl">
                <span className="text-sm text-leaf-400">Friends</span>
                <span className="text-sm font-semibold text-white">{friends.length}</span>
              </div>
            </div>
            <div className="flex justify-center">
              <button onClick={openEdit} className="border border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-md bg-white/15 hover:bg-white/25 font-semibold px-6 py-3 rounded-2xl transition-all duration-150 text-sm">
                Edit profile
              </button>
            </div>
          </div>
        )}

        {isEditing && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-leaf-400 mb-1.5">
                INTERESTS <span className="text-leaf-500 font-normal">(max 5)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS.map(i => (
                  <button
                    key={i.slug}
                    onClick={() => toggleInterest(i.slug)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs border-2 transition-all',
                      selectedInterests.includes(i.slug)
                        ? 'border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-md bg-white/15'
                        : 'border-leaf-600 text-leaf-300 hover:border-leaf-400',
                    )}
                  >
                    <i.icon size={11} />
                    <span>{i.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleSave}
                disabled={saving || alias.trim().length < 2}
                className="border border-white/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-md bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed font-semibold px-6 py-3 rounded-2xl transition-all duration-150 text-sm flex items-center justify-center gap-2"
              >
                {saving ? 'Saving...' : <><Check size={15} /> Save changes</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Already friends toast */}
      {alreadyFriendToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-600 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-sm text-white">You and <span className="text-mango-400">{alreadyFriendToast}</span> are already friends</span>
        </div>
      )}

      {/* Offline toast */}
      {offlineToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-600 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
          <span className="text-sm text-white">User is offline — can't call right now</span>
        </div>
      )}

      {/* Report done toast */}
      {reportDoneToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-600 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <span className="text-sm text-white">Report submitted. We'll review it.</span>
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
                <span className="font-semibold text-white text-sm">Report user</span>
              </div>
              <button onClick={() => setReportTarget(null)} className="text-leaf-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-leaf-300 text-xs">Reporting <span className="text-white font-medium">{reportTarget.alias}</span>. Reports are anonymous and reviewed by our team.</p>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-leaf-400 uppercase tracking-wide">Reason</p>
              <div className="flex flex-wrap gap-2">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setReportReason(r.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                      reportReason === r.value
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-leaf-600 text-leaf-300 hover:border-leaf-400',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-leaf-400 uppercase tracking-wide mb-1.5">Details <span className="text-leaf-600 font-normal normal-case">(optional)</span></p>
              <textarea
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe what happened..."
                className="w-full bg-leaf-700 text-white placeholder:text-leaf-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
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
    </>
  );
}
