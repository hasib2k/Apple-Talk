export interface MatchmakingJoinPayload {
  interests: string[];
  region: string | null;
  isPremium: boolean;
  purpose?: string;
  gender?: string | null;
  wantGender?: string | null;
}

export interface MatchedPayload {
  roomId: string;
  partnerId: string;
  partnerAlias: string;
  peerType: 'initiator' | 'receiver';
  partnerRegion: string | null;
  partnerGender: string | null;
  partnerIsPremium: boolean;
  partnerIsLinked: boolean;
}

export interface QueuedPayload {
  position: number;
  estimatedWait: number;
}

export interface WebRTCOfferPayload {
  roomId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerPayload {
  roomId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRTCIceCandidatePayload {
  roomId: string;
  candidate: RTCIceCandidateInit;
}

export interface CallEndPayload {
  roomId: string;
  reason: CallEndReason;
}

export type CallEndReason = 'hangup' | 'skip' | 'disconnect' | 'ban';

export interface ClientToServerEvents {
  'matchmaking:join': (payload: MatchmakingJoinPayload) => void;
  'matchmaking:cancel': () => void;
  'call:ready': (payload: { roomId: string }) => void;
  'call:end': (payload: CallEndPayload) => void;
  'webrtc:offer': (payload: WebRTCOfferPayload) => void;
  'webrtc:answer': (payload: WebRTCAnswerPayload) => void;
  'webrtc:ice-candidate': (payload: WebRTCIceCandidatePayload) => void;
  'online:count:request': () => void;
  'friend:request': (payload: { targetUserId: string }) => void;
  'friend:respond': (payload: { requesterId: string; accept: boolean }) => void;
  'friend:remove': (payload: { friendId: string }) => void;
  'friend:call': (payload: { targetUserId: string }) => void;
  'friend:call-accept': (payload: { callerId: string }) => void;
  'friend:call-decline': (payload: { callerId: string }) => void;
  'friend:call-cancel': (payload: { targetUserId: string }) => void;
  'call:mute-update': (payload: { muted: boolean }) => void;
  'call:chat': (payload: { text: string; time: string }) => void;
  'call:reaction': (payload: { emoji: string }) => void;
  'friend:chat': (payload: { toUserId: string; text: string; time: string }) => void;
  'users:status-check': (payload: { userIds: string[] }) => void;
}

export interface ServerToClientEvents {
  'matchmaking:matched': (payload: MatchedPayload) => void;
  'matchmaking:queued': (payload: QueuedPayload) => void;
  'call:partner-left': (payload: { roomId: string; reason: CallEndReason }) => void;
  'webrtc:offer': (payload: WebRTCOfferPayload) => void;
  'webrtc:answer': (payload: WebRTCAnswerPayload) => void;
  'webrtc:ice-candidate': (payload: WebRTCIceCandidatePayload) => void;
  'error': (payload: { message: string; code: string }) => void;
  'online:count': (payload: { count: number }) => void;
  'friend:request': (payload: { fromId: string; fromAlias: string }) => void;
  'friend:accepted': (payload: { byId: string; byAlias: string }) => void;
  'friend:rejected': (payload: { byId: string }) => void;
  'friend:removed': (payload: { byId: string }) => void;
  'friend:incoming-call': (payload: { fromId: string; fromAlias: string }) => void;
  'friend:call-declined': (payload: { byId: string }) => void;
  'friend:call-cancelled': () => void;
  'call:partner-muted': (payload: { muted: boolean }) => void;
  'call:chat': (payload: { text: string; time: string }) => void;
  'call:reaction': (payload: { emoji: string }) => void;
  'friend:chat': (payload: { id?: string; fromUserId: string; text: string; time: string }) => void;
  'friend:chat-seen': (payload: { byUserId: string }) => void;
  'friend:online': (payload: { userId: string; alias: string }) => void;
  'friend:offline': (payload: { userId: string }) => void;
  'users:online-status': (payload: { onlineIds: string[] }) => void;
  'notification:new': (payload: { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }) => void;
  'user:premium-updated': (payload: { isPremium: boolean; premiumUntil: string | null }) => void;
  'session:replaced': () => void;
}
