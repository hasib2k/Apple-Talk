import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useMeetingStore } from '../store/meeting.store';
import { useMeetingRoom, ParticipantInfo } from '../hooks/useMeetingRoom';

const AUDIENCE_RENDER_CAP = 60; // never render thousands of tiles
const REACTION_EMOJIS = ['👏', '❤️', '😂', '😮', '👍', '🎉'];

function initials(name: string) {
  return name.replace(/#.*$/, '').trim().charAt(0).toUpperCase() || 'G';
}

function Tile({
  p, isHostView, handRaised, onPromote, onDemote, onMute, onKick,
}: {
  p: ParticipantInfo;
  isHostView: boolean;
  handRaised: boolean;
  onPromote: (id: string) => void;
  onDemote: (id: string) => void;
  onMute: (id: string) => void;
  onKick: (id: string) => void;
}) {
  const speaking = p.isSpeaking && !p.isMuted;
  const showHostControls = isHostView && !p.isLocal && p.role !== 'host';
  return (
    <div style={{ ...t.tile, borderColor: speaking ? '#a3e635' : 'rgba(255,255,255,0.07)' }}>
      <div style={{ ...t.avatar, boxShadow: speaking ? '0 0 0 4px rgba(163,230,53,0.35)' : 'none' }}>
        {initials(p.name)}
        {p.role === 'host' && <span style={t.corner}>👑</span>}
        {handRaised && <span style={{ ...t.corner, left: -6, right: 'auto' }}>✋</span>}
      </div>
      <div style={t.nameRow}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>
          {p.name}{p.isLocal ? ' (you)' : ''}
        </span>
        {p.role !== 'audience' && (p.isMuted
          ? <span style={{ color: '#ef4444' }}>🔇</span>
          : <span style={{ color: speaking ? '#a3e635' : '#6f9c81' }}>🎙️</span>)}
      </div>

      {showHostControls && (
        <div style={t.hostCtrls}>
          {p.role === 'audience'
            ? <button onClick={() => onPromote(p.identity)} style={{ ...t.hc, color: '#a3e635' }}>{handRaised ? 'Allow ✋' : 'Promote'}</button>
            : <>
                <button onClick={() => onMute(p.identity)} style={t.hc}>Mute</button>
                <button onClick={() => onDemote(p.identity)} style={t.hc}>Listener</button>
              </>}
          <button onClick={() => onKick(p.identity)} style={{ ...t.hc, color: '#f87171' }}>Remove</button>
        </div>
      )}
    </div>
  );
}

export default function RoomPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  const { displayName, micEnabled: micPref } = useMeetingStore();
  const room = useMeetingRoom();
  const {
    status, participants, role, micEnabled, error,
    raisedHands, handRaised, messages, chatEnabled, reactions,
    connect, toggleMute, leave,
    raiseHand, sendChat, sendReaction, setChatEnabledHost,
    promote, demote, muteOther, kick, endMeeting,
  } = room;

  const [chatOpen, setChatOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const startedRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isHost = role === 'host';
  const canSpeak = role !== 'audience';

  useEffect(() => {
    if (startedRef.current) return;
    if (!accessToken && !displayName) { navigate(`/room/${code}`, { replace: true }); return; }
    startedRef.current = true;
    connect(code, displayName || user?.anonAlias, micPref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, chatOpen]);

  async function handleLeave() { await leave(); navigate('/'); }
  async function handleEnd() { await endMeeting(); navigate('/'); }

  const speakers = participants.filter((p) => p.role !== 'audience');
  const audience = participants.filter((p) => p.role === 'audience');
  const raisedCount = audience.filter((p) => raisedHands.has(p.identity)).length;
  const shownAudience = audience.slice(0, AUDIENCE_RENDER_CAP);
  const canChat = chatEnabled || isHost;

  if (status === 'connecting' || status === 'idle') {
    return (<div style={r.center}><img src="/logo.png" alt="" style={{ width: 72, height: 72 }} className="animate-pulse" /><p style={{ color: '#8fcea8', marginTop: 14 }}>Joining meeting…</p></div>);
  }
  if (status === 'error') {
    return (<div style={r.center}><div style={{ fontSize: 40 }}>⚠️</div><p style={{ fontWeight: 700, marginTop: 10 }}>Could not join</p><p style={{ color: '#8fcea8', fontSize: 14, marginTop: 4 }}>{error}</p><button onClick={() => navigate('/')} style={r.ghost}>Back to home</button></div>);
  }
  if (status === 'disconnected') {
    return (<div style={r.center}><div style={{ fontSize: 40 }}>👋</div><p style={{ fontWeight: 700, marginTop: 10 }}>You left the meeting</p><button onClick={() => navigate('/')} style={r.ghost}>Back to home</button></div>);
  }

  return (
    <div style={r.page}>
      {/* Top bar */}
      <header style={r.header}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>AppleTalk Meeting</div>
          <div style={{ color: '#6f9c81', fontSize: 12 }}>{code} · {participants.length} in call</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isHost && (
            <button onClick={() => setChatEnabledHost(!chatEnabled)} style={{ ...r.copyBtn, color: chatEnabled ? '#a3e635' : '#8fcea8' }}>
              Chat {chatEnabled ? 'on' : 'off'}
            </button>
          )}
          <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${code}`)} style={r.copyBtn}>Copy link</button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Body */}
        <main style={r.body}>
          <section>
            <p style={r.sectionLabel}>Speakers · {speakers.length}</p>
            <div style={r.grid}>
              {speakers.map((p) => (
                <Tile key={p.identity} p={p} isHostView={isHost} handRaised={false}
                  onPromote={promote} onDemote={demote} onMute={muteOther} onKick={kick} />
              ))}
            </div>
          </section>

          {audience.length > 0 && (
            <section style={{ marginTop: 28 }}>
              <p style={r.sectionLabel}>
                Audience · {audience.length}{raisedCount > 0 && <span style={{ color: '#a3e635' }}> · ✋ {raisedCount} raised</span>}
              </p>
              <div style={r.grid}>
                {shownAudience.map((p) => (
                  <Tile key={p.identity} p={p} isHostView={isHost} handRaised={raisedHands.has(p.identity)}
                    onPromote={promote} onDemote={demote} onMute={muteOther} onKick={kick} />
                ))}
              </div>
              {audience.length > AUDIENCE_RENDER_CAP && (
                <p style={{ color: '#6f9c81', fontSize: 13, marginTop: 12 }}>
                  + {audience.length - AUDIENCE_RENDER_CAP} more listening
                </p>
              )}
            </section>
          )}
        </main>

        {/* Chat panel */}
        {chatOpen && (
          <aside style={r.chatPanel}>
            <div style={r.chatHeader}>
              <span style={{ fontWeight: 700 }}>Chat</span>
              <button onClick={() => setChatOpen(false)} style={r.xBtn}>✕</button>
            </div>
            <div style={r.chatBody}>
              {!chatEnabled && !isHost && <p style={{ color: '#6f9c81', fontSize: 13, textAlign: 'center', marginTop: 20 }}>Chat is turned off by the host.</p>}
              {messages.map((m) => (
                <div key={m.id} style={{ marginBottom: 10, textAlign: m.self ? 'right' : 'left' }}>
                  {!m.self && <div style={{ fontSize: 11, color: '#6f9c81' }}>{m.fromName}</div>}
                  <div style={{ ...r.bubble, background: m.self ? '#1f5c3d' : '#0a2013', marginLeft: m.self ? 'auto' : 0 }}>{m.text}</div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            {canChat && (
              <form style={r.chatForm} onSubmit={(e) => { e.preventDefault(); sendChat(draft); setDraft(''); }}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message" style={r.chatInput} />
                <button type="submit" style={r.sendBtn}>Send</button>
              </form>
            )}
          </aside>
        )}
      </div>

      {/* Floating reactions */}
      <div style={r.reactionLayer}>
        {reactions.map((rx) => (
          <div key={rx.id} style={r.floatReaction}>{rx.emoji}</div>
        ))}
      </div>

      {/* Control bar */}
      <footer style={r.controls}>
        {canSpeak ? (
          <button onClick={toggleMute} style={{ ...r.ctrlBtn, background: micEnabled ? '#16a34a' : '#ef4444' }}>
            {micEnabled ? '🎙️ Mute' : '🔇 Unmute'}
          </button>
        ) : (
          <button onClick={() => raiseHand(!handRaised)} style={{ ...r.ctrlBtn, background: handRaised ? '#f59e0b' : '#0a2013', border: handRaised ? 'none' : '1px solid #2a4a35' }}>
            {handRaised ? '✋ Lower hand' : '✋ Raise hand'}
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button onClick={() => setReactOpen((v) => !v)} style={{ ...r.ctrlBtn, background: '#0a2013', border: '1px solid #2a4a35' }}>😀 React</button>
          {reactOpen && (
            <div style={r.reactPopover}>
              {REACTION_EMOJIS.map((e) => (
                <button key={e} onClick={() => { sendReaction(e); setReactOpen(false); }} style={r.reactBtn}>{e}</button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setChatOpen((v) => !v)} style={{ ...r.ctrlBtn, background: '#0a2013', border: '1px solid #2a4a35' }}>
          💬 Chat{messages.length > 0 ? ` (${messages.length})` : ''}
        </button>

        {isHost && <button onClick={handleEnd} style={{ ...r.ctrlBtn, background: '#7f1d1d' }}>End for all</button>}
        <button onClick={handleLeave} style={{ ...r.ctrlBtn, background: '#ef4444' }}>Leave</button>
      </footer>
    </div>
  );
}

const r: Record<string, React.CSSProperties> = {
  page: { height: '100dvh', background: '#05140d', color: '#f4fbe9', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column' },
  center: { minHeight: '100dvh', background: '#05140d', color: '#f4fbe9', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  copyBtn: { background: 'transparent', border: '1px solid #2a4a35', color: '#c5e88a', borderRadius: 999, padding: '7px 14px', cursor: 'pointer', fontSize: 13 },
  body: { flex: 1, overflowY: 'auto', padding: 24 },
  sectionLabel: { color: '#6f9c81', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 14 },
  controls: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' },
  ctrlBtn: { border: 'none', color: '#fff', fontWeight: 700, borderRadius: 999, padding: '12px 22px', cursor: 'pointer', fontSize: 14 },
  ghost: { marginTop: 16, background: 'transparent', border: '1px solid #2a4a35', color: '#c5e88a', borderRadius: 999, padding: '10px 20px', cursor: 'pointer' },
  chatPanel: { width: 320, borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', background: '#071a10' },
  chatHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  xBtn: { background: 'transparent', border: 'none', color: '#8fcea8', cursor: 'pointer', fontSize: 16 },
  chatBody: { flex: 1, overflowY: 'auto', padding: 16 },
  bubble: { display: 'inline-block', padding: '8px 12px', borderRadius: 12, fontSize: 14, maxWidth: 220, wordBreak: 'break-word' },
  chatForm: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' },
  chatInput: { flex: 1, background: '#05140d', border: '1px solid #2a4a35', borderRadius: 10, color: '#fff', padding: 10, outline: 'none' },
  sendBtn: { background: 'linear-gradient(150deg,#bef264,#84cc16)', color: '#1a2e05', fontWeight: 700, border: 'none', borderRadius: 10, padding: '0 16px', cursor: 'pointer' },
  reactionLayer: { position: 'fixed', bottom: 90, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, pointerEvents: 'none', zIndex: 40 },
  floatReaction: { fontSize: 34, animation: 'none' },
  reactPopover: { position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)', background: '#0d2318', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 8, display: 'flex', gap: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' },
  reactBtn: { background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', padding: 6, borderRadius: 8 },
};

const t: Record<string, React.CSSProperties> = {
  tile: { background: '#0a2013', border: '2px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'border-color 0.12s' },
  avatar: { position: 'relative', width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(150deg,#1f5c3d,#0c2e1d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, transition: 'box-shadow 0.12s' },
  corner: { position: 'absolute', top: -8, right: -6, fontSize: 16 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', fontSize: 13, fontWeight: 600 },
  hostCtrls: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: 2 },
  hc: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#c5e88a', borderRadius: 999, padding: '3px 9px', cursor: 'pointer', fontSize: 11 },
};
