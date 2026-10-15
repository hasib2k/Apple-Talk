import { Mic, MicOff, PhoneOff, SkipForward, UserPlus, UserCheck, UserX } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  onMuteToggle: () => void;
  onHangUp: () => void;
  onSkip: () => void;
  onAddFriend: () => void;
  onCancelRequest: () => void;
  isFriend: boolean;
  requestSent: boolean;
  isConnected: boolean;
  partnerIsPremium?: boolean;
  userIsPremium?: boolean;
}

const controlBtn = (active: boolean, danger = false): React.CSSProperties => ({
  width: 58, height: 58, borderRadius: '50%', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.2s',
  opacity: active ? 1 : 0.3,
  pointerEvents: active ? 'auto' : 'none',
  background: danger
    ? 'rgba(239,68,68,0.15)'
    : 'rgba(255,255,255,0.06)',
  border: 'none',
  boxShadow: 'none',
});

export function CallControls({ isMuted, onMuteToggle, onHangUp, onSkip, onAddFriend, onCancelRequest, isFriend, requestSent, isConnected, partnerIsPremium, userIsPremium }: CallControlsProps) {
  const micColor = userIsPremium ? '#f59e0b' : '#a3e635';
  const skipColor = isConnected ? (userIsPremium ? '#f59e0b' : '#a3e635') : '#6f9c81';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>

      {/* Add friend pill */}
      <div style={{ opacity: isConnected ? 1 : 0.3, pointerEvents: isConnected ? 'auto' : 'none', transition: 'opacity 0.4s' }}>
        {isFriend ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 99,
            background: 'rgba(74,222,128,0.12)', border: 'none',
            fontSize: 14, fontWeight: 600, color: '#4ade80',
          }}>
            <UserCheck size={16} />
            Friend
          </div>
        ) : requestSent ? (
          <button
            onClick={onCancelRequest}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 99,
              background: 'rgba(255,255,255,0.06)', border: 'none',
              fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            <UserX size={16} />
            Cancel Request
          </button>
        ) : (
          <button
            onClick={onAddFriend}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 99,
              background: partnerIsPremium
                ? 'linear-gradient(150deg,#fde68a,#f59e0b)'
                : 'linear-gradient(150deg,#bef264,#84cc16)',
              border: 'none', fontSize: 14, fontWeight: 700, color: '#1a2e05',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: partnerIsPremium
                ? '0 6px 20px rgba(245,158,11,0.45)'
                : '0 6px 20px rgba(132,204,22,0.35)',
              transition: 'all 0.2s',
            }}
          >
            <UserPlus size={16} />
            Add Friend
          </button>
        )}
      </div>

      {/* Main buttons row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>

        {/* Mute */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onMuteToggle}
            disabled={!isConnected}
            style={{
              ...controlBtn(isConnected, isMuted),
              background: isMuted ? 'rgba(239,68,68,0.18)' : userIsPremium ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.06)',
              border: 'none',
            }}
          >
            {isMuted
              ? <MicOff size={22} color="#f87171" strokeWidth={2} />
              : <Mic size={22} color={micColor} strokeWidth={2} />
            }
          </button>
          <span style={{ fontSize: 10, color: '#8fcea8', fontWeight: 500 }}>{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>

        {/* End call */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onHangUp}
            style={{
              width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg,#ef4444,#dc2626)',
              boxShadow: 'none',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            <PhoneOff size={26} color="#fff" strokeWidth={2} />
          </button>
          <span style={{ fontSize: 10, color: '#8fcea8', fontWeight: 500 }}>End</span>
        </div>

        {/* Skip */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onSkip}
            disabled={!isConnected}
            style={controlBtn(isConnected)}
          >
            <SkipForward size={22} color={skipColor} strokeWidth={2} />
          </button>
          <span style={{ fontSize: 10, color: '#8fcea8', fontWeight: 500 }}>Skip</span>
        </div>

      </div>
    </div>
  );
}
