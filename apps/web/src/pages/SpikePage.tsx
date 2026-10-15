import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, RemoteTrack, RemoteParticipant, ConnectionState } from 'livekit-client';

/**
 * TEMPORARY spike page — proves LiveKit audio works end-to-end.
 * Open http://localhost:5173/spike in two browser tabs, join the same room, and talk.
 * Removed in Phase 1.
 */
export default function SpikePage() {
  const [room, setRoom] = useState('spike-room');
  const [name, setName] = useState(() => `user-${Math.random().toString(36).slice(2, 6)}`);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const audioContainer = useRef<HTMLDivElement>(null);

  async function join() {
    try {
      setStatus('Minting token…');
      const resp = await fetch('/api/v1/spike/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, identity: name }),
      });
      const { token, url } = await resp.json();

      setStatus(`Connecting to ${url}…`);
      const lkRoom = new Room();
      roomRef.current = lkRoom;

      lkRoom
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === 'audio' && audioContainer.current) {
            const el = track.attach();
            audioContainer.current.appendChild(el);
          }
        })
        .on(RoomEvent.ParticipantConnected, () => refreshParticipants(lkRoom))
        .on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(lkRoom))
        .on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
          console.log('[spike] connection state:', s);
          setStatus(`State: ${s}`);
        })
        .on(RoomEvent.Disconnected, (reason) => {
          console.log('[spike] disconnected:', reason);
          setStatus(`Disconnected: ${reason ?? 'unknown'}`);
          setConnected(false);
        })
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setSpeaking(new Set(speakers.map((s) => s.identity)));
        });

      // 20s guard so we don't hang forever silently
      await lkRoom.connect(url, token, { autoSubscribe: true });
      setStatus('Enabling mic…');
      await lkRoom.localParticipant.setMicrophoneEnabled(true);
      setConnected(true);
      setStatus('Connected ✓');
      refreshParticipants(lkRoom);
    } catch (err) {
      console.error('[spike] join failed:', err);
      setStatus(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function refreshParticipants(lkRoom: Room) {
    const remotes = Array.from(lkRoom.remoteParticipants.values()).map((p: RemoteParticipant) => p.identity);
    setParticipants([lkRoom.localParticipant.identity + ' (you)', ...remotes]);
  }

  async function toggleMute() {
    const lkRoom = roomRef.current;
    if (!lkRoom) return;
    const next = !muted;
    await lkRoom.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  function leave() {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setConnected(false);
    setParticipants([]);
    setSpeaking(new Set());
    setStatus('Left');
  }

  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  return (
    <div style={{ minHeight: '100dvh', background: '#05140d', color: '#f4fbe9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, fontFamily: 'system-ui', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>🎙️ LiveKit Audio Spike</h1>
      <p style={{ color: '#8fcea8', fontSize: 14 }}>Open this page in two tabs, join the same room, and talk.</p>

      {!connected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
          <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room"
            style={{ padding: 12, borderRadius: 10, border: '1px solid #2a4a35', background: '#0a2013', color: '#fff' }} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
            style={{ padding: 12, borderRadius: 10, border: '1px solid #2a4a35', background: '#0a2013', color: '#fff' }} />
          <button onClick={join}
            style={{ padding: 14, borderRadius: 10, border: 'none', background: 'linear-gradient(150deg,#bef264,#84cc16)', color: '#1a2e05', fontWeight: 700, cursor: 'pointer' }}>
            Join room
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 360, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {participants.map((p) => {
              const id = p.replace(' (you)', '');
              const isSpeaking = speaking.has(id);
              return (
                <div key={p} style={{ padding: '12px 16px', borderRadius: 12, background: '#0a2013', border: `2px solid ${isSpeaking ? '#a3e635' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 10, transition: 'border 0.1s' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: isSpeaking ? '#a3e635' : '#2a4a35' }} />
                  <span style={{ fontWeight: 600 }}>{p}</span>
                  {isSpeaking && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#a3e635' }}>speaking…</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={toggleMute}
              style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: muted ? '#ef4444' : '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              {muted ? '🔇 Unmute' : '🎙️ Mute'}
            </button>
            <button onClick={leave}
              style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>
              Leave
            </button>
          </div>
        </div>
      )}

      <p style={{ color: '#6f9c81', fontSize: 12 }}>{status}</p>
      <div ref={audioContainer} style={{ display: 'none' }} />
    </div>
  );
}
