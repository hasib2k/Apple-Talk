import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  Participant,
  ConnectionState,
} from 'livekit-client';
import { meetingsApi, Role } from '../lib/meetings';

export interface ParticipantInfo {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  role: Role;
  canPublish: boolean;
}

export interface ChatMessage {
  id: string;
  fromIdentity: string;
  fromName: string;
  text: string;
  ts: number;
  self: boolean;
}

export interface Reaction {
  id: string;
  key: string; // icon key (e.g. 'heart', 'thumbsup') — rendered as a lucide icon
  fromName: string;
}

export type RoomStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

type DataMsg =
  | { t: 'raise'; on: boolean }
  | { t: 'chat'; text: string }
  | { t: 'reaction'; key: string }
  | { t: 'chat-state'; enabled: boolean };

function metaRole(metadata?: string): Role {
  try {
    const m = metadata ? JSON.parse(metadata) : {};
    return (m.role as Role) ?? 'audience';
  } catch {
    return 'audience';
  }
}

/** Displayed role: host from token metadata; speaker/audience derived from live publish rights. */
function displayedRole(p: Participant): Role {
  if (metaRole(p.metadata) === 'host') return 'host';
  return (p.permissions?.canPublish ?? false) ? 'speaker' : 'audience';
}

function snapshot(room: Room): ParticipantInfo[] {
  const local = room.localParticipant;
  const all: Participant[] = [local, ...Array.from(room.remoteParticipants.values())];
  return all.map((p) => ({
    identity: p.identity,
    name: p.name || 'Guest',
    isLocal: p.identity === local.identity,
    isSpeaking: p.isSpeaking,
    isMuted: !p.isMicrophoneEnabled,
    role: displayedRole(p),
    canPublish: p.permissions?.canPublish ?? false,
  }));
}

export function useMeetingRoom() {
  const roomRef = useRef<Room | null>(null);
  const codeRef = useRef<string>('');
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const encoder = useRef(new TextEncoder());
  const decoder = useRef(new TextDecoder());

  const [status, setStatus] = useState<RoomStatus>('idle');
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [role, setRole] = useState<Role>('audience');
  const [micEnabled, setMicEnabled] = useState(false);
  const [localIdentity, setLocalIdentity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [handRaised, setHandRaised] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const refresh = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const snap = snapshot(room);
    setParticipants(snap);
    setMicEnabled(room.localParticipant.isMicrophoneEnabled);
    // Drop raised hands for anyone who is no longer an audience member (promoted/left).
    setRaisedHands((prev) => {
      const audience = new Set(snap.filter((p) => p.role === 'audience').map((p) => p.identity));
      const next = new Set([...prev].filter((id) => audience.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, []);

  const send = useCallback((msg: DataMsg) => {
    const room = roomRef.current;
    if (!room) return;
    room.localParticipant.publishData(encoder.current.encode(JSON.stringify(msg)), { reliable: true });
  }, []);

  const connect = useCallback(async (code: string, displayName: string | undefined, micPref: boolean) => {
    setStatus('connecting');
    setError(null);
    codeRef.current = code;
    try {
      const resp = await meetingsApi.getToken(code, displayName);
      setRole(resp.role);
      setLocalIdentity(resp.identity);
      setChatEnabled(resp.meeting.chatEnabled);

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = 'none';
            document.body.appendChild(el);
            audioElsRef.current.set(participant.identity + track.sid, el);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach().forEach((el) => el.remove());
        })
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.LocalTrackPublished, refresh)
        .on(RoomEvent.LocalTrackUnpublished, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.ParticipantPermissionsChanged, refresh)
        .on(RoomEvent.ParticipantMetadataChanged, refresh)
        .on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
          let msg: DataMsg;
          try { msg = JSON.parse(decoder.current.decode(payload)); } catch { return; }
          const fromIdentity = participant?.identity ?? 'unknown';
          const fromName = participant?.name || 'Guest';
          if (msg.t === 'raise') {
            setRaisedHands((prev) => {
              const next = new Set(prev);
              if (msg.on) next.add(fromIdentity); else next.delete(fromIdentity);
              return next;
            });
          } else if (msg.t === 'chat') {
            setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, fromIdentity, fromName, text: msg.text, ts: Date.now(), self: false }]);
          } else if (msg.t === 'reaction') {
            const id = `${Date.now()}-${Math.random()}`;
            setReactions((prev) => [...prev, { id, key: msg.key, fromName }]);
            setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 4000);
          } else if (msg.t === 'chat-state') {
            setChatEnabled(msg.enabled);
          }
        })
        .on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
          if (s === ConnectionState.Connected) setStatus('connected');
        })
        .on(RoomEvent.Disconnected, () => setStatus('disconnected'));

      await room.connect(resp.url, resp.token);
      const canPublish = room.localParticipant.permissions?.canPublish ?? false;
      if (canPublish && micPref) {
        await room.localParticipant.setMicrophoneEnabled(true);
      }
      await room.startAudio().catch(() => {});
      setStatus('connected');
      refresh();
    } catch (err) {
      console.error('[meeting] connect failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to join the meeting');
      setStatus('error');
    }
  }, [refresh]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (!(room.localParticipant.permissions?.canPublish ?? false)) return;
    await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
    refresh();
  }, [refresh]);

  const raiseHand = useCallback((on: boolean) => {
    setHandRaised(on);
    send({ t: 'raise', on });
  }, [send]);

  const sendChat = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    send({ t: 'chat', text: t });
    const room = roomRef.current;
    setMessages((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      fromIdentity: room?.localParticipant.identity ?? 'me',
      fromName: room?.localParticipant.name || 'You',
      text: t, ts: Date.now(), self: true,
    }]);
  }, [send]);

  const sendReaction = useCallback((key: string) => {
    send({ t: 'reaction', key });
    const id = `${Date.now()}-${Math.random()}`;
    setReactions((prev) => [...prev, { id, key, fromName: 'You' }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 4000);
  }, [send]);

  // Host: toggle chat (persist + broadcast live)
  const setChatEnabledHost = useCallback(async (enabled: boolean) => {
    setChatEnabled(enabled);
    send({ t: 'chat-state', enabled });
    try { await meetingsApi.setChat(codeRef.current, enabled); } catch { /* ignore */ }
  }, [send]);

  // Host REST actions
  const promote = useCallback((identity: string) => meetingsApi.promote(codeRef.current, identity).then(refresh), [refresh]);
  const demote = useCallback((identity: string) => meetingsApi.demote(codeRef.current, identity).then(refresh), [refresh]);
  const muteOther = useCallback((identity: string) => meetingsApi.mute(codeRef.current, identity), []);
  const kick = useCallback((identity: string) => meetingsApi.kick(codeRef.current, identity), []);

  const endMeeting = useCallback(async () => {
    await meetingsApi.end(codeRef.current).catch(() => {});
    await roomRef.current?.disconnect();
  }, []);

  const leave = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    audioElsRef.current.forEach((el) => el.remove());
    audioElsRef.current.clear();
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      audioElsRef.current.forEach((el) => el.remove());
      audioElsRef.current.clear();
    };
  }, []);

  return {
    status, participants, role, micEnabled, localIdentity, error,
    raisedHands, handRaised, messages, chatEnabled, reactions,
    connect, toggleMute, leave,
    raiseHand, sendChat, sendReaction, setChatEnabledHost,
    promote, demote, muteOther, kick, endMeeting,
  };
}
