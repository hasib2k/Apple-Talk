import { useCallback, useEffect, useRef } from 'react';
import SimplePeer from 'simple-peer';
import { useCallStore } from '../store/call.store';
import { useSocketEvent, useSocket } from './useSocket';

const ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: '5b899b4a66a7e781e3f8767d',
    credential: 'CNB5rfaQNV5R8NF/',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: '5b899b4a66a7e781e3f8767d',
    credential: 'CNB5rfaQNV5R8NF/',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: '5b899b4a66a7e781e3f8767d',
    credential: 'CNB5rfaQNV5R8NF/',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: '5b899b4a66a7e781e3f8767d',
    credential: 'CNB5rfaQNV5R8NF/',
  },
];

export function useWebRTC() {
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const originalAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setStreams, setCallStarted, reset } = useCallStore();
  const socket = useSocket();

  // Destroy peer on unmount (e.g. when CallPage remounts for a new call)
  useEffect(() => {
    return () => {
      clearConnectionTimer();
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, []);

  function clearConnectionTimer() {
    if (connectionTimerRef.current) {
      clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
  }

  // Request mic early (before matching) so there's no delay when call starts
  const requestMic = useCallback(async () => {
    const existing = useCallStore.getState().localStream;
    if (existing) return; // already have mic access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      originalAudioTrackRef.current = stream.getAudioTracks()[0] ?? null;
      audioSenderRef.current = null;
      setStreams(stream, null);
    } catch (err) {
      console.error('Microphone permission denied:', err);
    }
  }, [setStreams]);

  const startCall = useCallback(async (currentRoomId: string, isInitiator: boolean) => {
    // Reuse existing mic stream if already obtained, otherwise request it
    let localStream = useCallStore.getState().localStream;
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      originalAudioTrackRef.current = localStream.getAudioTracks()[0] ?? null;
      audioSenderRef.current = null;
      setStreams(localStream, null);
    } else {
      // Stream reused from previous call — restore track ref if it was cleared
      if (!originalAudioTrackRef.current) {
        originalAudioTrackRef.current = localStream.getAudioTracks()[0] ?? null;
      }
      // Clear remote stream from previous call
      setStreams(localStream, null);
    }

    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: localStream,
      trickle: true,
      config: { iceServers: ICE_SERVERS },
    });

    peerRef.current = peer;

    // If connection isn't established within 30s, end the call so user isn't stuck loading
    clearConnectionTimer();
    connectionTimerRef.current = setTimeout(() => {
      if (useCallStore.getState().status !== 'active') {
        console.warn('WebRTC connection timeout — ending call');
        endCall('disconnect');
      }
    }, 30_000);

    peer.on('signal', (sdp) => {
      if ('type' in sdp && sdp.type === 'offer') {
        socket.emit('webrtc:offer', { roomId: currentRoomId, sdp: sdp as RTCSessionDescriptionInit });
      } else if ('type' in sdp && sdp.type === 'answer') {
        socket.emit('webrtc:answer', { roomId: currentRoomId, sdp: sdp as RTCSessionDescriptionInit });
      } else {
        socket.emit('webrtc:ice-candidate', { roomId: currentRoomId, candidate: sdp as RTCIceCandidateInit });
      }
    });

    peer.on('stream', (remoteStream) => {
      clearConnectionTimer();
      setStreams(localStream, remoteStream);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pc = (peer as any)._pc as RTCPeerConnection;
        audioSenderRef.current = pc.getSenders().find(s => s.track?.kind === 'audio') ?? null;
      } catch { /* ignore */ }
      setCallStarted();
    });

    peer.on('connect', () => {
      clearConnectionTimer();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pc = (peer as any)._pc as RTCPeerConnection;
        audioSenderRef.current = pc.getSenders().find(s => s.track?.kind === 'audio') ?? null;
      } catch { /* ignore */ }
      setCallStarted();
    });

    peer.on('error', (err) => {
      console.error('WebRTC peer error:', err);
      clearConnectionTimer();
      endCall('disconnect');
    });

    peer.on('close', () => {
      endCall('disconnect');
    });
  }, [socket, setStreams, setCallStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  useSocketEvent('webrtc:offer', ({ sdp }) => {
    peerRef.current?.signal(sdp);
  });

  useSocketEvent('webrtc:answer', ({ sdp }) => {
    peerRef.current?.signal(sdp);
  });

  useSocketEvent('webrtc:ice-candidate', ({ candidate }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peerRef.current?.signal(candidate as any);
  });

  const muteLocalAudio = useCallback(async (muted: boolean) => {
    const sender = audioSenderRef.current;
    if (sender) {
      try {
        if (muted) {
          await sender.replaceTrack(null);
        } else {
          const track = originalAudioTrackRef.current;
          if (track) await sender.replaceTrack(track);
        }
        return;
      } catch (err) {
        console.warn('replaceTrack failed, falling back to track.enabled:', err);
      }
    }
    const { localStream } = useCallStore.getState();
    localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }, []);

  const endCall = useCallback((reason: string = 'hangup') => {
    clearConnectionTimer();
    const currentRoomId = useCallStore.getState().roomId;
    if (currentRoomId) {
      socket.emit('call:end', { roomId: currentRoomId, reason: reason as 'hangup' | 'skip' | 'disconnect' | 'ban' });
    }
    peerRef.current?.destroy();
    peerRef.current = null;
    audioSenderRef.current = null;
    // Don't stop the mic track here — it stays alive so the next call can reuse it.
    // stopLocalStream() is called when the user actually leaves the call page.
    reset();
  }, [socket, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  return { requestMic, startCall, endCall, muteLocalAudio };
}
