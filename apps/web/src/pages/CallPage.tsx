import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, ChevronDown, Crown } from 'lucide-react';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useOnlineCount } from '../hooks/useOnlineCount';
import { useCallStore } from '../store/call.store';
import { useAuthStore } from '../store/auth.store';
import { useFriendStore } from '../store/friend.store';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { VoiceOrb } from '../components/call/VoiceOrb';
import { CallControls } from '../components/call/CallControls';
import { formatDuration } from '../lib/utils';

export default function CallPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { status, remoteStream, isMuted, partnerIsMuted, toggleMute, setPartnerIsMuted, callStartedAt, partnerId, partnerAlias, partnerGender, partnerIsPremium, partnerIsLinked, isFriendCall, setMinimized, reset, callChatMessages, addCallChatMessage, clearCallChatUnread } = useCallStore();
  const { joinQueue, cancelQueue, skipPartner, hangUp, muteLocalAudio, requestMic, startCall } = useMatchmaking();
  const onlineCount = useOnlineCount();
  const { hasFriend, sendRequest, cancelRequest, hasRequest, pendingFriendCallAccept, setPendingFriendCallAccept } = useFriendStore();
  const partnerDisplayName = (partnerId && hasFriend(partnerId)) ? (partnerAlias ?? 'Stranger') : 'Stranger';
  const socket = useSocket();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);

  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inputText, setInputText] = useState('');
  const [reactions, setReactions] = useState<{ id: string; emoji: string; fromPartner: boolean }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const isFriend = !!partnerId && hasFriend(partnerId);
  const requestSent = !!partnerId && hasRequest(partnerId);
  const isPremium = user?.isPremium ?? false;
  const accent = isPremium ? '#f59e0b' : '#a3e635';
  const accentAlpha = (o: number) => isPremium ? `rgba(245,158,11,${o})` : `rgba(163,230,53,${o})`;
  const accentLight = isPremium ? '#fef3c7' : '#d3f099';
  const accentGradient = isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)';

  function handleAddFriend() {
    if (!partnerId || isFriend || requestSent) return;
    sendRequest({ id: partnerId, alias: 'Stranger#' + partnerId.slice(-4) });
    socket.emit('friend:request', { targetUserId: partnerId });
  }
  function handleCancelRequest() {
    if (!partnerId) return;
    cancelRequest(partnerId);
  }
  function sendReaction(emoji: string) {
    const id = Date.now().toString() + Math.random();
    setReactions(prev => [...prev, { id, emoji, fromPartner: false }]);
    socket.emit('call:reaction', { emoji });
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 1800);
  }
  function sendMessage() {
    const text = inputText.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    addCallChatMessage({ id: Date.now().toString(), sender: 'me', text, time });
    socket.emit('call:chat', { text, time });
    setInputText('');
  }

  useEffect(() => { setChatOpen(false); setUnreadCount(0); }, [partnerId]);

  // Increment local unread badge when a new 'them' message arrives while chat is closed
  // (global call:chat listener in App.tsx adds the message to store)
  const prevMsgCountRef = useRef(callChatMessages.length);
  useEffect(() => {
    const prev = prevMsgCountRef.current;
    const curr = callChatMessages.length;
    if (curr > prev) {
      const newMsgs = callChatMessages.slice(prev);
      if (!chatOpen && newMsgs.some(m => m.sender === 'them')) {
        setUnreadCount(c => c + newMsgs.filter(m => m.sender === 'them').length);
      }
    }
    prevMsgCountRef.current = curr;
  }, [callChatMessages]); // eslint-disable-line react-hooks/exhaustive-deps
  useSocketEvent('call:reaction', ({ emoji }: { emoji: string }) => {
    const id = Date.now().toString() + Math.random();
    setReactions(prev => [...prev, { id, emoji, fromPartner: true }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 1800);
  });

  const profileInterests = (user?.interests as string[] | undefined) ?? [];
  const filterInterests = (() => { try { return JSON.parse(localStorage.getItem('mangotalk_filter_interests') ?? '[]') as string[]; } catch { return [] as string[]; } })();
  const interests = filterInterests.length > 0 ? filterInterests : profileInterests;
  const region = user?.region ?? null;

  // Mark as not minimized when CallPage is active
  useEffect(() => {
    setMinimized(false);
    clearCallChatUnread();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingFriendCallAccept) {
      const callerId = pendingFriendCallAccept;
      setPendingFriendCallAccept(null);
      requestMic();
      socket.emit('friend:call-accept', { callerId });
      useCallStore.getState().setStatus('queued');
      useCallStore.getState().setIsFriendCall(true);
    } else if (status === 'matched') {
      const { roomId: matchedRoomId, peerType } = useCallStore.getState();
      if (matchedRoomId) startCall(matchedRoomId, peerType === 'initiator');
    } else if (status === 'idle') {
      joinQueue(interests, region);
    }
    return () => {
      if (useCallStore.getState().status !== 'active') cancelQueue();
      // Only stop mic if the user actually left the call (not minimized)
      if (!useCallStore.getState().isMinimized) useCallStore.getState().stopLocalStream();
    };
  }, []);

  useEffect(() => {
    muteLocalAudio(isMuted);
    if (status === 'active') socket.emit('call:mute-update', { muted: isMuted });
  }, [isMuted, status]);

  useSocketEvent('call:partner-muted', ({ muted }) => { setPartnerIsMuted(muted); });
  useEffect(() => { if (audioRef.current) audioRef.current.srcObject = remoteStream ?? null; }, [remoteStream]);

  useEffect(() => {
    if (status !== 'active' || !callStartedAt) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - callStartedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [status, callStartedAt]);

  useEffect(() => {
    if (status !== 'active') return;
    let wakeLock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then(lock => { wakeLock = lock; }).catch(() => {});
    return () => { wakeLock?.release().catch(() => {}); };
  }, [status]);

  useEffect(() => {
    if (chatOpen && messagesContainerRef.current)
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [chatOpen, callChatMessages]);

  useEffect(() => {
    if (!chatOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    function onViewportChange() {
      const panel = chatPanelRef.current;
      if (!panel || !vv) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (keyboardHeight > 100) { panel.style.bottom = `${keyboardHeight}px`; panel.style.height = `${vv.height}px`; }
      else { panel.style.bottom = ''; panel.style.height = '72svh'; }
    }
    vv.addEventListener('resize', onViewportChange);
    onViewportChange();
    return () => {
      vv.removeEventListener('resize', onViewportChange);
      const panel = chatPanelRef.current;
      if (panel) { panel.style.bottom = ''; panel.style.height = '72svh'; }
    };
  }, [chatOpen]);

  const isConnected = status === 'active';
  const findingLabel = isFriendCall ? 'Connecting with friend...' : 'Finding someone...';

  function handleHangUp() {
    if (isConnected) hangUp(); else cancelQueue();
    reset();
    useCallStore.getState().stopLocalStream();
    navigate('/match');
  }

  function handleMinimize() {
    setMinimized(true);
    navigate('/match');
  }

  // Shared chat content (used in both mobile panel and desktop sidebar)
  const chatMessages = (
    <div ref={messagesContainerRef} className="scrollbar-chat" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => inputRef.current?.blur()}>
      {callChatMessages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <MessageCircle size={28} color="#4a9f78" strokeWidth={1.5} style={{ opacity: 0.4 }} />
          <p style={{ fontSize: 13, color: '#8fcea8' }}>No messages yet. Say hi!</p>
        </div>
      ) : (
        callChatMessages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'me' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '75%', padding: '8px 14px', fontSize: 14, borderRadius: msg.sender === 'me' ? '14px 14px 3px 14px' : '14px 14px 14px 3px', background: msg.sender === 'me' ? accentGradient : 'rgba(255,255,255,0.08)', color: msg.sender === 'me' ? '#1a2e05' : '#f4fbe9', border: msg.sender === 'me' ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ margin: 0 }}>{msg.text}</p>
              <p style={{ margin: '3px 0 0', fontSize: 10, opacity: 0.55 }}>{msg.time}</p>
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  const chatInput = (
    <div style={{ padding: '10px 14px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
      <input ref={inputRef} type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 99, padding: '10px 16px', fontSize: 16, color: '#f4fbe9', fontFamily: 'inherit', outline: 'none' }} />
      <button onPointerDown={e => e.preventDefault()} onClick={sendMessage} disabled={!inputText.trim()} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: inputText.trim() ? accentGradient : 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, boxShadow: inputText.trim() ? `0 4px 14px ${accentAlpha(0.35)}` : 'none' }}>
        <Send size={15} color={inputText.trim() ? '#1a2e05' : '#8fcea8'} />
      </button>
    </div>
  );

  const orbAndName = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
      <VoiceOrb isActive={isConnected} isMuted={isConnected ? partnerIsMuted : false} size="lg" isPremium={partnerIsPremium} stream={remoteStream} />
      <div style={{ textAlign: 'center', minHeight: 40 }}>
        <div style={{ position: 'relative', height: 26 }}>
          <p style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 18, fontWeight: 700, color: partnerDisplayName === 'Stranger' ? (isPremium && partnerGender === 'female' ? '#f9a8d4' : accent) : '#f4fbe9', opacity: isConnected ? 1 : 0, transition: 'opacity 0.5s', display: 'flex', alignItems: 'center', gap: 5 }}>
            {partnerIsPremium && <Crown size={15} style={{ color: '#fbbf24', flexShrink: 0 }} />}
            {partnerIsLinked && <VerifiedBadge size={15} />}
            {partnerDisplayName}
          </p>
          <p style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)', opacity: !isConnected ? 1 : 0, transition: 'opacity 0.5s' }}>
            {findingLabel}
          </p>
        </div>
        {!isConnected && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
            {[0, 0.25, 0.5].map(d => (
              <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.7, animation: `barPulse 0.9s ease-in-out infinite alternate ${d}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const reactionsRow = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, opacity: isConnected ? 1 : 0.2, pointerEvents: isConnected ? 'auto' : 'none', transition: 'opacity 0.5s' }}>
      {['😂', '😢', '👏', '😮', '❤️'].map(emoji => (
        <button key={emoji} onClick={() => sendReaction(emoji)} style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', fontSize: 19, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-dvh flex flex-col overflow-hidden relative" style={{ background: '#05140d', fontFamily: 'Kanit, sans-serif' }}>
      <style>{`
        .call-mobile-body { display: flex; flex-direction: column; }
        .call-desktop-body { display: none; }
        .call-chat-btn { display: flex; }
        .call-mobile-chat { display: flex; }
        .call-mobile-backdrop { display: block; }
        @media (min-width: 1024px) {
          .call-mobile-body    { display: none !important; }
          .call-desktop-body   { display: flex !important; }
          .call-chat-btn       { display: none !important; }
          .call-mobile-chat    { display: none !important; }
          .call-mobile-backdrop{ display: none !important; }
        }
      `}</style>

      {/* Safe area */}
      <div className="fixed bottom-0 left-0 right-0 z-0" style={{ height: 'env(safe-area-inset-bottom)', background: '#05140d' }} />
      <audio ref={audioRef} autoPlay playsInline />

      {/* ── Header ── */}
      <header className="relative z-20 shrink-0 flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <button onClick={handleHangUp} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.3" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </div>
          <img src="/logo.png" alt="AppleTalk" style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f4fbe9', letterSpacing: '-0.02em', fontFamily: "'Oxanium', sans-serif" }}>Apple<span style={{ color: accent }}>Talk</span></span>
        </button>
        {/* Minimize — only when call is active */}
        {isConnected && (
          <button onClick={handleMinimize} title="Minimize" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronDown size={17} color={accent} strokeWidth={2.2} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Online pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: accentAlpha(0.10), borderRadius: 99, padding: '5px 11px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}`, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: accentLight, fontWeight: 700, whiteSpace: 'nowrap' }}>{onlineCount.toLocaleString()} online</span>
          </div>
          {/* Timer pill - desktop only shows in header */}
          {isConnected && (
            <div className="hidden lg:flex" style={{ alignItems: 'center', background: accentAlpha(0.08), borderRadius: 99, padding: '5px 14px' }}>
              <span style={{ fontFamily: "'Oxanium', sans-serif", fontSize: 13, color: accentLight, fontWeight: 700 }}>{formatDuration(elapsed)}</span>
            </div>
          )}
          {/* Chat button — mobile only */}
          <button
            className="call-chat-btn"
            onClick={() => { setChatOpen(true); setUnreadCount(0); }}
            disabled={!isConnected}
            style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', alignItems: 'center', justifyContent: 'center', cursor: isConnected ? 'pointer' : 'default', opacity: isConnected ? 1 : 0.3, transition: 'opacity 0.4s' }}
          >
            <MessageCircle size={17} color={accent} strokeWidth={2} />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 15, height: 15, borderRadius: 99, background: '#ef4444', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── MOBILE body ── */}
      <div className="call-mobile-body relative z-10 flex-1 items-center justify-between px-5 pt-4 min-h-0" style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}>
        {orbAndName()}
        {isConnected && (
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', background: accentAlpha(0.10), borderRadius: 99, padding: '6px 16px' }}>
            <span style={{ fontFamily: "'Oxanium', sans-serif", fontSize: 13, color: accentLight, fontWeight: 700 }}>{formatDuration(elapsed)}</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flex: '0 0 auto', width: '100%' }}>
          {reactionsRow}
          <CallControls isMuted={isMuted} onMuteToggle={toggleMute} onHangUp={handleHangUp} onSkip={() => skipPartner()} onAddFriend={handleAddFriend} onCancelRequest={handleCancelRequest} isFriend={isFriend} requestSent={requestSent} isConnected={isConnected} partnerIsPremium={partnerIsPremium} userIsPremium={isPremium} />
        </div>
      </div>

      {/* ── DESKTOP body: two columns ── */}
      <div className="call-desktop-body" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left column: orb + controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '40px 48px 48px' }}>
          {orbAndName()}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
            {reactionsRow}
            <CallControls isMuted={isMuted} onMuteToggle={toggleMute} onHangUp={handleHangUp} onSkip={() => skipPartner()} onAddFriend={handleAddFriend} onCancelRequest={handleCancelRequest} isFriend={isFriend} requestSent={requestSent} isConnected={isConnected} partnerIsPremium={partnerIsPremium} userIsPremium={isPremium} />
          </div>
        </div>

        {/* Right column: chat always visible */}
        <div style={{ width: 380, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${accentAlpha(0.12)}`, background: 'rgba(255,255,255,0.02)' }}>
          {/* Chat header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 20px', borderBottom: `1px solid ${accentAlpha(0.10)}` }}>
            <MessageCircle size={15} color={accent} strokeWidth={2} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f4fbe9' }}>
              {isConnected ? `Chat with ${partnerDisplayName}` : 'Chat'}
            </span>
            {!isConnected && (
              <span style={{ fontSize: 11, color: '#4d7a60', marginLeft: 4 }}>(available after connecting)</span>
            )}
          </div>
          {/* Messages */}
          {chatMessages}
          {/* Input */}
          <div style={{ opacity: isConnected ? 1 : 0.4, pointerEvents: isConnected ? 'auto' : 'none', transition: 'opacity 0.4s' }}>
            {chatInput}
          </div>
        </div>
      </div>

      {/* Floating reactions */}
      {reactions.map(r => (
        <div key={r.id} className="fixed pointer-events-none text-4xl z-50 select-none" style={{ animation: 'floatUp 1.8s ease-out forwards', bottom: '35%', left: r.fromPartner ? '18%' : '58%' }}>
          {r.emoji}
        </div>
      ))}

      {/* Chat backdrop — mobile only */}
      <div
        className={`call-mobile-backdrop fixed inset-0 z-30 transition-opacity duration-300 ${chatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={() => setChatOpen(false)}
      />

      {/* Chat slide-up panel — mobile only */}
      <div
        ref={chatPanelRef}
        className={`call-mobile-chat fixed bottom-0 left-0 right-0 z-40 flex-col overflow-hidden transition-transform duration-300 ${chatOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '72svh', background: 'rgba(5,20,13,0.97)', borderTop: `1px solid ${accentAlpha(0.15)}`, borderRadius: '22px 22px 0 0', backdropFilter: 'blur(20px)' }}
      >
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={15} color={accent} strokeWidth={2} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f4fbe9' }}>Chat with {partnerDisplayName}</span>
          </div>
          <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ChevronDown size={20} color="#8fcea8" />
          </button>
        </div>
        {chatMessages}
        {chatInput}
      </div>
    </div>
  );
}
