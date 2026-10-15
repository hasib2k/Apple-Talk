import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Users, Check, X, Phone, Send, ArrowLeft,
  MessageCircle, UserMinus, MoreVertical, Clock3, UserX, Crown,
} from 'lucide-react';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useAuthStore } from '../store/auth.store';
import { RowSkeleton } from '../components/Shimmer';
import { useFriendStore } from '../store/friend.store';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { cn } from '../lib/utils';
import { registerExitGuardBlocker } from '../hooks/useExitGuard';
import { api } from '../lib/api';

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

function chatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type Tab = 'chat' | 'friends' | 'received' | 'sent';

export default function FriendsPage() {
  const { user } = useAuthStore();
  const isPremium = user?.isPremium ?? false;
  const location = useLocation();
  const {
    friends, sentRequests, incomingRequests,
    cancelRequest, removeFriend, loadFriends, loadIncomingRequests,
    removeIncomingRequest, addFriendFromAccept,
    setOutgoingFriendCall,
    chatThreads, chatUnread, appendMyChatMessage, markChatRead, loadChatHistory,
    lastMessages, setViewProfileId,
  } = useFriendStore();
  const socket = useSocket();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('chat');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [chatFriendId, setChatFriendId] = useState<string | null>(null);
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null);
  const [chatSeen, setChatSeen] = useState<Record<string, boolean>>({});
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  useEffect(() => {
    Promise.all([
      loadFriends().then(() => {
        const ids = useFriendStore.getState().friends.map(f => f.id);
        if (ids.length > 0) socket.emit('users:status-check', { userIds: ids });
      }),
      loadIncomingRequests(),
    ]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markReadInDb = useCallback((friendId: string) => {
    api.patch(`/friends/${friendId}/messages/read`).catch(() => {});
  }, []);

  useSocketEvent('friend:chat-seen', ({ byUserId }) => {
    setChatSeen(prev => ({ ...prev, [byUserId]: true }));
  });

  // Mark messages as read in DB when chat is open and new socket messages arrive
  useEffect(() => {
    if (chatFriendId && (chatUnread[chatFriendId] ?? 0) > 0) {
      markChatRead(chatFriendId);
      markReadInDb(chatFriendId);
    }
  }, [chatThreads, chatFriendId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    const msgs = chatFriendId ? (chatThreads[chatFriendId] ?? []) : [];
    if (chatContainerRef.current && msgs.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatFriendId, chatThreads]);

  // Keep chat panel above virtual keyboard — mobile only
  useEffect(() => {
    if (!chatFriendId || isDesktop) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function onViewportChange() {
      const panel = chatPanelRef.current;
      if (!panel || !vv) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      panel.style.bottom = `${keyboardHeight}px`;
    }
    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    onViewportChange();
    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
      if (chatPanelRef.current) chatPanelRef.current.style.bottom = '0';
    };
  }, [chatFriendId, isDesktop]);

  const chatFriend = chatFriendId ? (friends.find(f => f.id === chatFriendId) ?? null) : null;
  const chatMessages = chatFriendId ? (chatThreads[chatFriendId] ?? []) : [];

  // Mobile back-button intercept for chat overlay
  useEffect(() => {
    if (!chatFriendId || isDesktop) return;
    window.history.pushState({ overlay: 'chat' }, '');
    const unregister = registerExitGuardBlocker(() => {
      setChatFriendId(null);
      setChatInput('');
    });
    return unregister;
  }, [chatFriendId, isDesktop]);

  // Open chat when navigated here with openChatId state (e.g. from FriendProfileModal)
  useEffect(() => {
    const chatId = (location.state as { openChatId?: string } | null)?.openChatId;
    if (chatId) {
      setTab('chat');
      setChatFriendId(chatId);
      loadChatHistory(chatId);
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  function openChat(friendId: string) {
    setChatFriendId(friendId);
    setChatInput('');
    markReadInDb(friendId);
    setChatLoadingId(friendId);
    loadChatHistory(friendId).finally(() => setChatLoadingId(null));
  }

  function closeChat() {
    setChatFriendId(null);
    setChatInput('');
  }

  function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || !chatFriendId) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = { id: Date.now().toString(), sender: 'me' as const, text, time };
    appendMyChatMessage(chatFriendId, msg);
    socket.emit('friend:chat', { toUserId: chatFriendId, text, time });
    setChatInput('');
    setChatSeen(prev => ({ ...prev, [chatFriendId]: false }));
  }

  // ── Chat conversation overlay (mobile full-screen) ──────────────────────────
  if (chatFriendId && !isDesktop) {
    return (
      <div ref={chatPanelRef} className="fixed inset-0 z-50 flex flex-col bg-leaf-900">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3.5 bg-leaf-800 border-b border-leaf-700" style={{ paddingTop: 'max(14px, calc(env(safe-area-inset-top, 0px) + 10px))' }}>
          <button onClick={closeChat} className="p-1.5 rounded-xl hover:bg-leaf-700 text-leaf-300 hover:text-leaf-50 transition-colors">
            <ArrowLeft size={18} />
          </button>
          {chatFriend && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="relative shrink-0">
                <Avatar name={chatFriend.alias} size="sm" premium={chatFriend.isPremium} />
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-leaf-800 ${chatFriend.isOnline ? (chatFriend.isPremium ? 'bg-yellow-400' : 'bg-green-400') : 'bg-gray-500'}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${chatFriend.isPremium ? 'text-amber-400' : user?.isPremium && chatFriend.gender === 'female' ? 'text-pink-400' : 'text-leaf-50'}`}>
                  {chatFriend.alias}
                </p>
                <p className="text-xs text-leaf-300">{chatFriend.isOnline ? 'Online' : 'Offline'}</p>
              </div>
            </div>
          )}
          {/* Call button in conversation header */}
          {chatFriend && (
            <button
              onClick={() => {
                closeChat();
                setOutgoingFriendCall({ toId: chatFriend.id, toAlias: chatFriend.alias });
                socket.emit('friend:call', { targetUserId: chatFriend.id });
              }}
              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${isPremium ? 'bg-amber-500' : 'bg-mango-500'}`}
            >
              <Phone size={15} color="#1a2e05" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {chatLoadingId === chatFriendId ? (
            [70, 55, 80, 45, 65].map((w, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="shimmer rounded-2xl" style={{ width: `${w}%`, height: 40 }} />
              </div>
            ))
          ) : chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-leaf-300">
              <MessageCircle size={32} className="opacity-40" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs text-leaf-300/70">Say hi to {chatFriend?.alias}!</p>
            </div>
          ) : (
            (() => {
              const isSeen = chatFriendId ? (chatSeen[chatFriendId] ?? false) : false;
              const lastMyIdx = chatMessages.reduce((last, m, i) => m.sender === 'me' ? i : last, -1);
              return chatMessages.map((msg, i) => (
                <div key={msg.id}>
                  <div className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.sender === 'me' ? 'bg-mango-500 text-leaf-800 rounded-br-sm' : 'bg-leaf-700 text-leaf-100 rounded-bl-sm'}`}>
                      <p>{msg.text}</p>
                      <p className="text-[10px] mt-0.5 opacity-50">{msg.time}</p>
                    </div>
                  </div>
                  {isSeen && i === lastMyIdx && (
                    <p className="text-[10px] text-right pr-1 mt-0.5" style={{ color: '#8fcea8', opacity: 0.7 }}>Seen</p>
                  )}
                </div>
              ));
            })()
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 pt-3 pb-3 border-t border-leaf-700 flex items-center gap-2 bg-leaf-900" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
            placeholder={`Message ${chatFriend?.alias ?? ''}...`}
            style={{ fontSize: 16 }}
            className="flex-1 bg-leaf-800 text-leaf-50 placeholder:text-leaf-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-mango-500/50 border border-leaf-700"
          />
          <button
            onPointerDown={e => e.preventDefault()}
            onClick={sendChatMessage}
            disabled={!chatInput.trim()}
            className="w-9 h-9 rounded-full bg-mango-500 hover:bg-mango-600 disabled:opacity-40 flex items-center justify-center transition-all"
          >
            <Send size={15} className="text-leaf-800" />
          </button>
        </div>
      </div>
    );
  }

  // ── Desktop chat panel (right column) ──────────────────────────────────────
  const desktopChatPanel = chatFriendId && isDesktop ? (
    <div className="flex-1 flex flex-col bg-leaf-900 min-h-0">
      <div className="shrink-0 flex items-center gap-3 px-4 py-3.5 bg-leaf-800 border-b border-leaf-700">
        <button onClick={closeChat} className="p-1.5 rounded-xl hover:bg-leaf-700 text-leaf-300 hover:text-leaf-50 transition-colors">
          <ArrowLeft size={18} />
        </button>
        {chatFriend && (
          <>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="relative shrink-0">
                <Avatar name={chatFriend.alias} size="sm" premium={chatFriend.isPremium} />
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-leaf-800 ${chatFriend.isOnline ? (chatFriend.isPremium ? 'bg-yellow-400' : 'bg-green-400') : 'bg-gray-500'}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${chatFriend.isPremium ? 'text-amber-400' : user?.isPremium && chatFriend.gender === 'female' ? 'text-pink-400' : 'text-leaf-50'}`}>
                  {chatFriend.alias}
                </p>
                <p className="text-xs text-leaf-300">{chatFriend.isOnline ? 'Online' : 'Offline'}</p>
              </div>
            </div>
            <button
              onClick={() => {
                closeChat();
                setOutgoingFriendCall({ toId: chatFriend.id, toAlias: chatFriend.alias });
                socket.emit('friend:call', { targetUserId: chatFriend.id });
              }}
              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isPremium ? 'bg-amber-500' : 'bg-mango-500'}`}
            >
              <Phone size={15} color="#1a2e05" />
            </button>
          </>
        )}
      </div>
      <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {chatLoadingId === chatFriendId ? (
          [70, 55, 80, 45, 65].map((w, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className="shimmer rounded-2xl" style={{ width: `${w}%`, height: 40 }} />
            </div>
          ))
        ) : chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-leaf-300">
            <MessageCircle size={32} className="opacity-40" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs text-leaf-300/70">Say hi to {chatFriend?.alias}!</p>
          </div>
        ) : (
          chatMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.sender === 'me' ? 'bg-mango-500 text-leaf-800 rounded-br-sm' : 'bg-leaf-700 text-leaf-100 rounded-bl-sm'}`}>
                <p>{msg.text}</p>
                <p className="text-[10px] mt-0.5 opacity-50">{msg.time}</p>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="shrink-0 px-4 pt-3 pb-4 border-t border-leaf-700 flex items-center gap-2 bg-leaf-900">
        <input
          type="text"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
          placeholder={`Message ${chatFriend?.alias ?? ''}...`}
          style={{ fontSize: 16 }}
          className="flex-1 bg-leaf-800 text-leaf-50 placeholder:text-leaf-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-mango-500/50 border border-leaf-700"
        />
        <button
          onPointerDown={e => e.preventDefault()}
          onClick={sendChatMessage}
          disabled={!chatInput.trim()}
          className="w-9 h-9 rounded-full bg-mango-500 hover:bg-mango-600 disabled:opacity-40 flex items-center justify-center transition-all"
        >
          <Send size={15} className="text-leaf-800" />
        </button>
      </div>
    </div>
  ) : isDesktop ? (
    <div className="flex-1 flex flex-col items-center justify-center bg-leaf-900/30 gap-3">
      <MessageCircle size={36} style={{ color: '#2d5040', opacity: 0.6 }} />
      <p style={{ fontSize: 13, color: '#3d6b52' }}>Select a conversation to start chatting</p>
    </div>
  ) : null;

  // ── Friends sorted for chat list (by last message time, newest first) ───────
  const chatSortedFriends = [...friends].sort((a, b) => {
    const ta = lastMessages[a.id]?.createdAt ?? a.addedAt;
    const tb = lastMessages[b.id]?.createdAt ?? b.addedAt;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  const totalChatUnread = Object.values(chatUnread).reduce((s, n) => s + n, 0);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left panel */}
      <div className={`flex flex-col min-h-0 ${isDesktop ? 'w-80 shrink-0 border-r border-leaf-700' : 'flex-1'}`}>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-leaf-700 bg-leaf-900">
          {/* Chat tab */}
          <button
            onClick={() => setTab('chat')}
            className={cn(
              'flex-1 py-3 text-sm font-semibold border-b-2 transition-colors relative',
              tab === 'chat' ? 'border-mango-500 text-mango-500' : 'border-transparent text-leaf-300 hover:text-leaf-50',
            )}
          >
            Chat
            {totalChatUnread > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-mango-500 text-white text-[10px] font-bold">
                {totalChatUnread > 9 ? '9+' : totalChatUnread}
              </span>
            )}
          </button>

          {/* Friends tab */}
          <button
            onClick={() => setTab('friends')}
            className={cn(
              'flex-1 py-3 text-sm font-semibold border-b-2 transition-colors',
              tab === 'friends' ? 'border-mango-500 text-mango-500' : 'border-transparent text-leaf-300 hover:text-leaf-50',
            )}
          >
            Friends {friends.length > 0 && `(${friends.length})`}
          </button>

          {/* Received tab */}
          <button
            onClick={() => setTab('received')}
            className={cn(
              'flex-1 py-3 text-sm font-semibold border-b-2 transition-colors relative',
              tab === 'received' ? 'border-mango-500 text-mango-500' : 'border-transparent text-leaf-300 hover:text-leaf-50',
            )}
          >
            Req
            {incomingRequests.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {incomingRequests.length}
              </span>
            )}
          </button>

          {/* Sent tab */}
          <button
            onClick={() => setTab('sent')}
            className={cn(
              'flex-1 py-3 text-sm font-semibold border-b-2 transition-colors',
              tab === 'sent' ? 'border-mango-500 text-mango-500' : 'border-transparent text-leaf-300 hover:text-leaf-50',
            )}
          >
            Sent
          </button>
        </div>

        {openMenuId && <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />}

        {/* ── CHAT TAB ── */}
        {tab === 'chat' && (
          <div className="flex-1 overflow-y-auto mob-nav-pb">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 16px' }}>
                {[1, 2, 3, 4, 5].map(i => <RowSkeleton key={i} />)}
              </div>
            ) : friends.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-leaf-300 gap-2 py-20">
                <MessageCircle size={40} className="opacity-30" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs text-leaf-300/70">Add friends to start chatting</p>
              </div>
            ) : (
              <ul>
                {chatSortedFriends.map(friend => {
                  const lm = lastMessages[friend.id];
                  const unread = chatUnread[friend.id] ?? 0;
                  const isActive = chatFriendId === friend.id;
                  return (
                    <li
                      key={friend.id}
                      onClick={() => openChat(friend.id)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-leaf-800/50 ${
                        isActive ? 'bg-leaf-800' : 'hover:bg-leaf-800/60'
                      }`}
                    >
                      {/* Avatar + online dot */}
                      <button
                        className="relative shrink-0 focus:outline-none"
                        onClick={e => { e.stopPropagation(); setViewProfileId(friend.id); }}
                      >
                        <Avatar name={friend.alias} size="md" premium={friend.isPremium} />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-leaf-900 ${friend.isOnline ? (friend.isPremium ? 'bg-yellow-400' : 'bg-green-400') : 'bg-gray-600'}`} />
                      </button>

                      {/* Name + preview */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={`text-sm font-semibold truncate ${
                              friend.isPremium ? 'text-amber-400' : user?.isPremium && friend.gender === 'female' ? 'text-pink-400' : 'text-leaf-50'
                            }`}>
                              {friend.alias}
                            </p>
                            {friend.isPremium && <Crown size={11} color="#f59e0b" className="shrink-0" />}
                            {friend.isLinked && <VerifiedBadge size={11} />}
                          </div>
                          {lm && (
                            <span className="text-[10px] text-leaf-400 shrink-0 ml-2">
                              {chatTimestamp(lm.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs truncate ${unread > 0 ? 'text-leaf-100 font-medium' : 'text-leaf-400'}`}>
                            {lm
                              ? `${lm.fromMe ? 'You: ' : ''}${lm.text}`
                              : friend.isOnline ? 'Online now' : 'Tap to start chatting'}
                          </p>
                          {unread > 0 && (
                            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-mango-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                              {unread > 9 ? '9+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── FRIENDS TAB ── */}
        {tab === 'friends' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 mob-nav-pb">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(i => <RowSkeleton key={i} />)}
              </div>
            ) : friends.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-leaf-300 gap-2 py-20">
                <Users size={40} className="opacity-30" />
                <p className="text-sm text-leaf-300">No friends yet</p>
                <p className="text-xs text-leaf-300/70">Add friends during a call</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {friends.map(friend => (
                  <li key={friend.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-leaf-800 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <button className="relative shrink-0 focus:outline-none" onClick={() => setViewProfileId(friend.id)}>
                        <Avatar name={friend.alias} size="sm" premium={friend.isPremium} />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-leaf-900 ${friend.isOnline ? (friend.isPremium ? 'bg-yellow-400' : 'bg-green-400') : 'bg-gray-500'}`} />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-medium leading-tight truncate ${friend.isPremium ? 'text-amber-400' : user?.isPremium && friend.gender === 'female' ? 'text-pink-400' : 'text-leaf-50'}`}>
                            {friend.alias}
                          </p>
                          {friend.isPremium && <Crown size={12} color="#f59e0b" className="shrink-0" />}
                          {friend.isLinked && <VerifiedBadge size={12} />}
                        </div>
                        <p className="text-xs text-leaf-300">
                          {friend.isOnline ? 'Online now' : friend.lastSeen ? timeAgo(friend.lastSeen) : 'Offline'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => openChat(friend.id)}
                        className="relative p-1.5 rounded-full text-leaf-300 hover:text-leaf-50 hover:bg-leaf-700 transition-colors"
                        title="Chat"
                      >
                        <MessageCircle size={20} />
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
                        }}
                        className={`p-1.5 rounded-full transition-all active:scale-95 ${isPremium ? 'bg-skin-500 hover:bg-skin-600 text-white' : 'bg-mango-500 text-leaf-800 hover:bg-mango-600'}`}
                        title="Call"
                      >
                        <Phone size={15} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === friend.id ? null : friend.id)}
                          className="p-1.5 rounded-full text-leaf-300 hover:text-leaf-50 hover:bg-leaf-700 transition-colors"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenuId === friend.id && (
                          <div className="absolute right-0 top-8 bg-leaf-800 rounded-xl shadow-lg border border-leaf-700 py-1 z-30 w-36" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                removeFriend(friend.id).then(() => socket.emit('friend:remove', { friendId: friend.id }));
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-leaf-700 transition-colors"
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

        {/* ── RECEIVED TAB ── */}
        {tab === 'received' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 mob-nav-pb">
            {incomingRequests.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-leaf-300 gap-2 py-20">
                <Users size={40} className="opacity-30" />
                <p className="text-sm text-leaf-300">No incoming requests</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {incomingRequests.map(req => (
                  <li key={req.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-leaf-800 border border-leaf-700">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={req.alias} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-leaf-50 leading-tight truncate">{req.alias}</p>
                        <p className="text-xs text-leaf-300">{timeAgo(req.sentAt)}</p>
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
                        className="p-1.5 rounded-lg hover:bg-leaf-700 text-red-400 hover:text-red-300 transition-colors"
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

        {/* ── SENT TAB ── */}
        {tab === 'sent' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 mob-nav-pb">
            {sentRequests.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-leaf-300 gap-2 py-20">
                <Clock3 size={40} className="opacity-30" />
                <p className="text-sm text-leaf-300">No pending requests</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {sentRequests.map(req => (
                  <li key={req.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-leaf-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar name={req.alias} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-leaf-50 leading-tight">{req.alias}</p>
                        <p className="text-xs text-leaf-300">{timeAgo(req.sentAt)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => cancelRequest(req.id)}
                      className="p-1.5 rounded-full hover:bg-leaf-700 text-red-400 hover:text-red-300 transition-colors"
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
      </div>{/* end left panel */}

      {desktopChatPanel}
    </div>
  );
}
