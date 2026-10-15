import { create } from 'zustand';

export type CallStatus =
  | 'idle'
  | 'queued'
  | 'matched'
  | 'connecting'
  | 'active'
  | 'ended'
  | 'friend-calling';

export interface CallChatMsg {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
}

interface CallState {
  status: CallStatus;
  roomId: string | null;
  partnerId: string | null;
  partnerAlias: string | null;
  partnerRegion: string | null;
  partnerGender: string | null;
  partnerIsPremium: boolean;
  partnerIsLinked: boolean;
  peerType: 'initiator' | 'receiver' | null;
  callStartedAt: number | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  isMuted: boolean;
  partnerIsMuted: boolean;
  callTargetAlias: string | null;
  isFriendCall: boolean;
  isMinimized: boolean;
  callChatMessages: CallChatMsg[];
  callChatUnread: number; // unread count while minimized (for floating bar badge)

  setStatus: (status: CallStatus) => void;
  setMinimized: (val: boolean) => void;
  addCallChatMessage: (msg: CallChatMsg) => void;
  clearCallChatUnread: () => void;
  setMatched: (roomId: string, partnerId: string, partnerAlias: string, peerType: 'initiator' | 'receiver', partnerRegion?: string, partnerGender?: string | null, partnerIsPremium?: boolean, partnerIsLinked?: boolean) => void;
  setStreams: (local: MediaStream | null, remote: MediaStream | null) => void;
  setCallStarted: () => void;
  toggleMute: () => void;
  setPartnerIsMuted: (muted: boolean) => void;
  setFriendCalling: (targetAlias: string) => void;
  setIsFriendCall: (val: boolean) => void;
  stopLocalStream: () => void;
  reset: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  status: 'idle',
  roomId: null,
  partnerId: null,
  partnerAlias: null,
  partnerRegion: null,
  partnerGender: null,
  partnerIsPremium: false,
  partnerIsLinked: false,
  peerType: null,
  callStartedAt: null,
  remoteStream: null,
  localStream: null,
  isMuted: false,
  partnerIsMuted: false,
  callTargetAlias: null,
  isFriendCall: false,
  isMinimized: false,
  callChatMessages: [],
  callChatUnread: 0,

  setStatus: (status) => set({ status }),
  setMinimized: (val) => set({ isMinimized: val }),
  addCallChatMessage: (msg) => set(state => ({ callChatMessages: [...state.callChatMessages, msg] })),
  clearCallChatUnread: () => set({ callChatUnread: 0 }),

  setMatched: (roomId, partnerId, partnerAlias, peerType, partnerRegion, partnerGender, partnerIsPremium, partnerIsLinked) =>
    set({ status: 'matched', roomId, partnerId, partnerAlias, peerType, partnerRegion: partnerRegion ?? null, partnerGender: partnerGender ?? null, partnerIsPremium: partnerIsPremium ?? false, partnerIsLinked: partnerIsLinked ?? false, partnerIsMuted: false }),

  setStreams: (local, remote) =>
    set({ localStream: local, remoteStream: remote }),

  setCallStarted: () =>
    set({ status: 'active', callStartedAt: Date.now() }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  setPartnerIsMuted: (muted) => set({ partnerIsMuted: muted }),

  setFriendCalling: (targetAlias) => set({ status: 'friend-calling', callTargetAlias: targetAlias, isFriendCall: true }),

  setIsFriendCall: (val) => set({ isFriendCall: val }),

  // Stop mic tracks and clear localStream — call only when truly leaving the call page
  stopLocalStream: () => {
    const { localStream } = get();
    localStream?.getTracks().forEach(t => t.stop());
    set({ localStream: null });
  },

  // Reset call state WITHOUT stopping the mic — mic stays alive between skips
  reset: () => {
    set({
      status: 'idle',
      roomId: null,
      partnerId: null,
      partnerAlias: null,
      partnerRegion: null,
      partnerGender: null,
      partnerIsPremium: false,
      partnerIsLinked: false,
      peerType: null,
      callStartedAt: null,
      remoteStream: null,
      isMuted: false,
      partnerIsMuted: false,
      callTargetAlias: null,
      isFriendCall: false,
      isMinimized: false,
      callChatMessages: [],
      callChatUnread: 0,
    });
  },
}));
