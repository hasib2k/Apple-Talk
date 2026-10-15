import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { meetingsApi, MyMeeting } from '../lib/meetings';

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
              <input readOnly value={createdLink} style={{ ...s.joinInput, flex: 1, background: '#05140d', padding: 12, borderRadius: 10, border: '1px solid #2a4a35' }} />
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
  page: { minHeight: '100dvh', background: '#05140d', color: '#f4fbe9', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  joinBox: { display: 'flex', alignItems: 'center', background: '#0a2013', border: '1px solid #2a4a35', borderRadius: 999, overflow: 'hidden' },
  joinInput: { background: 'transparent', border: 'none', outline: 'none', color: '#fff', padding: '9px 14px', width: 200, fontSize: 14 },
  joinBtn: { background: 'transparent', border: 'none', color: '#a3e635', fontWeight: 700, padding: '9px 16px', cursor: 'pointer', fontSize: 14 },
  newBtn: { background: 'linear-gradient(150deg,#bef264,#84cc16)', color: '#1a2e05', fontWeight: 700, border: 'none', borderRadius: 999, padding: '9px 18px', cursor: 'pointer', fontSize: 14 },
  menu: { position: 'absolute', right: 0, top: 46, background: '#0d2318', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 6, width: 250, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 10 },
  menuItem: { display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#f4fbe9', padding: '11px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(150deg,#1f5c3d,#0c2e1d)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  ctaPrimary: { background: 'linear-gradient(150deg,#bef264,#84cc16)', color: '#1a2e05', fontWeight: 800, border: 'none', borderRadius: 999, padding: '13px 28px', cursor: 'pointer', fontSize: 15 },
  recentRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#0a2013', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 16px' },
  smallGhost: { background: 'transparent', border: '1px solid #2a4a35', color: '#c5e88a', borderRadius: 999, padding: '7px 14px', cursor: 'pointer', fontSize: 13 },
  smallSolid: { background: 'linear-gradient(150deg,#bef264,#84cc16)', color: '#1a2e05', fontWeight: 700, border: 'none', borderRadius: 999, padding: '7px 14px', cursor: 'pointer', fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 },
  modal: { background: '#0d2318', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 },
};
