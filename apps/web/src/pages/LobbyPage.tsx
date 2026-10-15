import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useMeetingStore } from '../store/meeting.store';
import { meetingsApi, MeetingInfo } from '../lib/meetings';
import { CLAY } from '../lib/clay';

export default function LobbyPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const setPrejoin = useMeetingStore((s) => s.setPrejoin);

  const [info, setInfo] = useState<MeetingInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const isLoggedIn = !!accessToken;

  useEffect(() => {
    meetingsApi.getInfo(code)
      .then((i) => {
        setInfo(i);
        if (i.status === 'ended') setLoadError('This meeting has ended.');
      })
      .catch(() => setLoadError('Meeting not found.'));
  }, [code]);

  useEffect(() => {
    setName(user?.anonAlias ?? '');
  }, [user]);

  // Mic preview + level meter
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setLevel(Math.min(1, avg / 80));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setMicEnabled(false);
      }
    }
    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  function join() {
    const displayName = (name.trim() || user?.anonAlias || 'Guest').slice(0, 60);
    // release the preview mic so the room can take it
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPrejoin({ displayName, micEnabled });
    navigate(`/room/${code}/live`);
  }

  if (loadError) {
    return (
      <div style={s.page}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <p style={{ fontSize: 18, fontWeight: 700 }}>{loadError}</p>
          <button onClick={() => navigate('/')} style={{ ...s.joinBtn, marginTop: 18 }}>Back to home</button>
        </div>
      </div>
    );
  }

  const needsName = !isLoggedIn;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <p style={{ color: '#6f9c81', fontSize: 13 }}>You're about to join</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{info?.title ?? '…'}</h1>
        {info && (
          <p style={{ color: '#8fcea8', fontSize: 13, marginTop: 6 }}>
            Hosted by {info.hostAlias} · {info.participantCount} in the meeting
          </p>
        )}

        {/* Mic preview */}
        <div style={s.micPreview}>
          <div style={{ fontSize: 44 }}>{micEnabled ? '🎙️' : '🔇'}</div>
          <div style={s.levelTrack}>
            <div style={{ ...s.levelFill, width: `${(micEnabled ? level : 0) * 100}%` }} />
          </div>
          <button onClick={() => setMicEnabled((v) => !v)} style={{ ...s.micToggle, background: micEnabled ? '#16a34a' : '#ef4444' }}>
            {micEnabled ? 'Mic on' : 'Mic off'}
          </button>
        </div>

        {needsName && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={s.nameInput}
          />
        )}

        <button onClick={join} disabled={needsName && !name.trim()} style={{ ...s.joinNow, opacity: needsName && !name.trim() ? 0.5 : 1 }}>
          Join now
        </button>
        <button onClick={() => navigate('/')} style={s.backLink}>Cancel</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: CLAY.bg, color: CLAY.text, fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { background: CLAY.surface, borderRadius: CLAY.r, padding: 36, width: '100%', maxWidth: 420, textAlign: 'center', boxShadow: CLAY.raised },
  micPreview: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, margin: '28px 0' },
  levelTrack: { width: '70%', height: 12, borderRadius: 999, background: CLAY.bgDeep, overflow: 'hidden', boxShadow: CLAY.pressed },
  levelFill: { height: '100%', background: CLAY.accentGrad, transition: 'width 0.08s linear', borderRadius: 999 },
  micToggle: { border: 'none', color: '#fff', fontWeight: 800, borderRadius: 999, padding: '11px 24px', cursor: 'pointer', fontSize: 14, boxShadow: CLAY.raisedSm },
  nameInput: { width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: CLAY.rSm, border: 'none', background: CLAY.bgDeep, color: '#fff', marginBottom: 16, fontSize: 15, boxShadow: CLAY.pressed, outline: 'none' },
  joinNow: { width: '100%', background: CLAY.accentGrad, color: '#1a2e05', fontWeight: 800, border: 'none', borderRadius: CLAY.rPill, padding: 15, cursor: 'pointer', fontSize: 15, boxShadow: CLAY.btnGreen },
  joinBtn: { background: CLAY.accentGrad, color: '#1a2e05', fontWeight: 800, border: 'none', borderRadius: CLAY.rPill, padding: '12px 24px', cursor: 'pointer', boxShadow: CLAY.btnGreen },
  backLink: { background: 'transparent', border: 'none', color: CLAY.faint, marginTop: 14, cursor: 'pointer', fontSize: 14 },
};
