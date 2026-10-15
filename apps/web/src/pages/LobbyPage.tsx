import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useMeetingStore } from '../store/meeting.store';
import { meetingsApi, MeetingInfo } from '../lib/meetings';

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
  page: { minHeight: '100dvh', background: '#05140d', color: '#f4fbe9', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { background: '#0a2013', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 32, width: '100%', maxWidth: 420, textAlign: 'center' },
  micPreview: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, margin: '28px 0' },
  levelTrack: { width: '70%', height: 8, borderRadius: 999, background: '#05140d', overflow: 'hidden', border: '1px solid #2a4a35' },
  levelFill: { height: '100%', background: 'linear-gradient(90deg,#84cc16,#bef264)', transition: 'width 0.08s linear' },
  micToggle: { border: 'none', color: '#fff', fontWeight: 700, borderRadius: 999, padding: '9px 20px', cursor: 'pointer', fontSize: 14 },
  nameInput: { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: '1px solid #2a4a35', background: '#05140d', color: '#fff', marginBottom: 14, fontSize: 15 },
  joinNow: { width: '100%', background: 'linear-gradient(150deg,#bef264,#84cc16)', color: '#1a2e05', fontWeight: 800, border: 'none', borderRadius: 999, padding: 14, cursor: 'pointer', fontSize: 15 },
  joinBtn: { background: 'linear-gradient(150deg,#bef264,#84cc16)', color: '#1a2e05', fontWeight: 700, border: 'none', borderRadius: 999, padding: '10px 22px', cursor: 'pointer' },
  backLink: { background: 'transparent', border: 'none', color: '#6f9c81', marginTop: 12, cursor: 'pointer', fontSize: 14 },
};
