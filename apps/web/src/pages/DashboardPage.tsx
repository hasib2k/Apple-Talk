import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { meetingsApi, MyMeeting } from '../lib/meetings';
import { CLAY } from '../lib/clay';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [joinCode, setJoinCode] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent, setRecent] = useState<MyMeeting[]>([]);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    meetingsApi.listMine().then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function parseCode(input: string): string {
    const t = input.trim();
    const m = t.match(/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
    return m ? m[1].toLowerCase() : t.toLowerCase();
  }

  async function startInstant() {
    setBusy(true);
    try {
      const m = await meetingsApi.create({ title: 'Instant meeting' });
      navigate(`/room/${m.code}`);
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  async function createForLater() {
    setBusy(true);
    try {
      const m = await meetingsApi.create({ title: 'AppleTalk Meeting' });
      setCreatedLink(`${window.location.origin}/room/${m.code}`);
      meetingsApi.listMine().then(setRecent).catch(() => {});
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  function joinByCode() {
    const code = parseCode(joinCode);
    if (code) navigate(`/room/${code}`);
  }

  function signOut() {
    clearAuth();
    localStorage.removeItem('anon_session_active');
    navigate('/login', { replace: true });
  }

  return (
    <div style={s.page}>
      {/* ── Top bar ── */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          <span style={{ fontSize: 20, fontWeight: 800 }}>Apple<span style={{ color: '#a3e635' }}>Talk</span></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={s.joinBox}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
              placeholder="Enter a code or link"
              style={s.joinInput}
            />
            <button onClick={joinByCode} disabled={!joinCode.trim()} style={{ ...s.joinBtn, opacity: joinCode.trim() ? 1 : 0.4 }}>
              Join
            </button>
          </div>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen((v) => !v)} disabled={busy} style={s.newBtn}>
              ＋ New
            </button>
            {menuOpen && (
              <div style={s.menu}>
                <button onClick={createForLater} style={s.menuItem}>🔗 Create a meeting for later</button>
                <button onClick={startInstant} style={s.menuItem}>▶️ Start an instant meeting</button>
              </div>
            )}
          </div>

          <button onClick={signOut} title="Sign out" style={s.avatar}>
            {(user?.anonAlias ?? 'G').charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      {/* ── Center ── */}
      <main style={s.main}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🎙️</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, textAlign: 'center' }}>Audio meetings for everyone</h1>
        <p style={{ color: '#8fcea8', marginTop: 8, textAlign: 'center', maxWidth: 440 }}>
          Create a meeting link and share it — thousands can join and listen, speakers talk.
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button onClick={startInstant} disabled={busy} style={s.ctaPrimary}>＋ New meeting</button>
        </div>

        {/* Recent meetings */}
        {recent.length > 0 && (
          <div style={{ marginTop: 44, width: '100%', maxWidth: 560 }}>
            <p style={{ color: '#6f9c81', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Your meetings
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((m) => (
                <div key={m.code} style={s.recentRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                    <div style={{ color: '#6f9c81', fontSize: 12 }}>
                      {m.code} · {m.status === 'live' ? <span style={{ color: '#a3e635' }}>live</span> : 'ended'} · {m._count.participants} joined
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/room/${m.code}`); }} style={s.smallGhost}>Copy link</button>
                    {m.status === 'live' && <button onClick={() => navigate(`/room/${m.code}`)} style={s.smallSolid}>Join</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Created-link modal ── */}
      {createdLink && (
        <div style={s.overlay} onClick={() => setCreatedLink(null)}>
          <div style={{ ...s.modal }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Your meeting is ready</h2>
            <p style={{ color: '#8fcea8', fontSize: 14, marginBottom: 16 }}>Share this link with people you want in the meeting.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={createdLink} style={{ ...s.joinInput, flex: 1, background: CLAY.bgDeep, padding: 12, borderRadius: 14, boxShadow: CLAY.pressed, width: 'auto' }} />
              <button onClick={() => navigator.clipboard.writeText(createdLink)} style={{ ...s.smallSolid, padding: '0 16px' }}>Copy</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
              <button onClick={() => setCreatedLink(null)} style={s.smallGhost}>Close</button>
              <button onClick={() => { const c = createdLink.split('/room/')[1]; navigate(`/room/${c}`); }} style={s.smallSolid}>Join now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: CLAY.bg, color: CLAY.text, fontFamily: 'system-ui', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px' },
  joinBox: { display: 'flex', alignItems: 'center', background: CLAY.bgDeep, borderRadius: CLAY.rPill, overflow: 'hidden', boxShadow: CLAY.pressed },
  joinInput: { background: 'transparent', border: 'none', outline: 'none', color: '#fff', padding: '11px 18px', width: 200, fontSize: 14 },
  joinBtn: { background: 'transparent', border: 'none', color: CLAY.accent, fontWeight: 800, padding: '11px 18px', cursor: 'pointer', fontSize: 14 },
  newBtn: { background: CLAY.accentGrad, color: '#1a2e05', fontWeight: 800, border: 'none', borderRadius: CLAY.rPill, padding: '11px 22px', cursor: 'pointer', fontSize: 14, boxShadow: CLAY.btnGreen },
  menu: { position: 'absolute', right: 0, top: 52, background: CLAY.surface, borderRadius: 20, padding: 8, width: 258, boxShadow: CLAY.raised, zIndex: 10 },
  menuItem: { display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: CLAY.text, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontSize: 14 },
  avatar: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(145deg,#2a7a52,#0c2e1d)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: 16, boxShadow: CLAY.raisedSm },
  main: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  ctaPrimary: { background: CLAY.accentGrad, color: '#1a2e05', fontWeight: 800, border: 'none', borderRadius: CLAY.rPill, padding: '15px 34px', cursor: 'pointer', fontSize: 15, boxShadow: CLAY.btnGreen },
  recentRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: CLAY.surface, borderRadius: 20, padding: '14px 18px', boxShadow: CLAY.raisedSm },
  smallGhost: { background: CLAY.surfaceAlt, border: 'none', color: CLAY.text, borderRadius: CLAY.rPill, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: CLAY.raisedSm },
  smallSolid: { background: CLAY.accentGrad, color: '#1a2e05', fontWeight: 800, border: 'none', borderRadius: CLAY.rPill, padding: '8px 16px', cursor: 'pointer', fontSize: 13, boxShadow: CLAY.btnGreen },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 },
  modal: { background: CLAY.surface, borderRadius: CLAY.r, padding: 28, width: '100%', maxWidth: 440, boxShadow: CLAY.raised },
};
