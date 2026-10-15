import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallStore } from '../store/call.store';
import { useAuthStore } from '../store/auth.store';
import { useSocketEvent, useSocket } from './useSocket';
import { useWebRTC } from './useWebRTC';

function getEffectiveInterests(userInterests: string[]): string[] {
  try {
    const filter = JSON.parse(localStorage.getItem('mangotalk_filter_interests') ?? '[]') as string[];
    return filter.length > 0 ? filter : userInterests;
  } catch { return userInterests; }
}

function getGender(userGender: string | null | undefined): string | null {
  return userGender ?? localStorage.getItem('mangotalk_my_gender') ?? null;
}

function getWantGender(isPremium: boolean): string | null {
  if (!isPremium) return null;
  const fg = localStorage.getItem('mangotalk_filter_gender');
  return fg && fg !== 'both' ? fg : null;
}

export function useMatchmaking() {
  const getPurpose = () => localStorage.getItem('mangotalk_purpose') ?? undefined;
  const socket = useSocket();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { status, setStatus, setMatched, roomId } = useCallStore();
  const { startCall, endCall, muteLocalAudio, requestMic } = useWebRTC();

  // Re-join queue automatically after socket reconnect
  useEffect(() => {
    function onConnect() {
      if (useCallStore.getState().status !== 'queued') return;
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;
      socket.emit('matchmaking:join', {
        interests: getEffectiveInterests((currentUser.interests as string[]) ?? []),
        region: currentUser.region ?? null,
        isPremium: currentUser.isPremium ?? false,
        purpose: getPurpose(),
        gender: getGender(currentUser.gender),
      });
    }
    socket.on('connect', onConnect);
    return () => { socket.off('connect', onConnect); };
  }, [socket]);

  useSocketEvent('matchmaking:matched', async ({ roomId: matchedRoomId, partnerId, partnerAlias, peerType, partnerRegion, partnerGender, partnerIsPremium, partnerIsLinked }) => {
    setMatched(matchedRoomId, partnerId, partnerAlias, peerType, partnerRegion ?? undefined, partnerGender ?? null, partnerIsPremium ?? false, partnerIsLinked ?? false);
    socket.emit('call:ready', { roomId: matchedRoomId });
    await startCall(matchedRoomId, peerType === 'initiator');
  });

  useSocketEvent('matchmaking:queued', ({ position }) => {
    setStatus('queued');
    console.log('Queue position:', position);
  });

  useSocketEvent('call:partner-left', () => {
    const isFriendCall = useCallStore.getState().isFriendCall;
    endCall('disconnect');
    if (isFriendCall) {
      // Friend call ended — go home, do not re-queue for random matching
      navigate('/app');
      return;
    }
    // Random call — auto re-queue to find next person
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    useCallStore.getState().setStatus('queued');
    socket.emit('matchmaking:join', {
      interests: getEffectiveInterests((currentUser.interests as string[]) ?? []),
      region: currentUser.region ?? null,
      isPremium: currentUser.isPremium ?? false,
      purpose: getPurpose(),
      wantGender: getWantGender(currentUser.isPremium ?? false),
    });
  });

  const joinQueue = useCallback(async (interests: string[], region: string | null) => {
    if (!user) return;
    await requestMic();
    setStatus('queued');
    socket.emit('matchmaking:join', {
      interests,
      region,
      isPremium: user.isPremium,
      purpose: getPurpose(),
      gender: getGender(user.gender),
      wantGender: getWantGender(user.isPremium),
    });
  }, [socket, user, setStatus, requestMic]);

  const cancelQueue = useCallback(() => {
    socket.emit('matchmaking:cancel');
    setStatus('idle');
  }, [socket, setStatus]);

  const skipPartner = useCallback(() => {
    const isFriendCall = useCallStore.getState().isFriendCall;
    endCall('skip');
    if (isFriendCall) {
      navigate('/app');
      return;
    }
    // Auto re-queue after skip
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    useCallStore.getState().setStatus('queued');
    socket.emit('matchmaking:join', {
      interests: getEffectiveInterests((currentUser.interests as string[]) ?? []),
      region: currentUser.region ?? null,
      isPremium: currentUser.isPremium ?? false,
      purpose: getPurpose(),
      wantGender: getWantGender(currentUser.isPremium ?? false),
    });
  }, [endCall, socket, navigate]);

  const hangUp = useCallback(() => {
    endCall('hangup');
  }, [endCall]);

  return { status, roomId, joinQueue, cancelQueue, skipPartner, hangUp, muteLocalAudio, requestMic, startCall };
}
