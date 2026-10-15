import { useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, UserMinus, Crown } from 'lucide-react';
import { useFriendStore } from '../store/friend.store';
import { useAuthStore } from '../store/auth.store';
import { getSocket } from '../lib/socket';
import { VerifiedBadge } from './VerifiedBadge';

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function FriendProfileModal() {
  const navigate = useNavigate();
  const { viewProfileId, setViewProfileId, friends, removeFriend, setOutgoingFriendCall } = useFriendStore();
  const { user } = useAuthStore();

  if (!viewProfileId) return null;
  const vf = friends.find(f => f.id === viewProfileId);
  if (!vf) return null;

  const socket = getSocket();
  const isPremium = user?.isPremium ?? false;

  function handleMessage() {
    setViewProfileId(null);
    navigate('/friends', { state: { openChatId: vf!.id } });
  }

  function handleCall() {
    setViewProfileId(null);
    setOutgoingFriendCall({ toId: vf!.id, toAlias: vf!.alias });
    socket.emit('friend:call', { targetUserId: vf!.id });
  }

  function handleUnfriend() {
    removeFriend(vf!.id).then(() => socket.emit('friend:remove', { friendId: vf!.id }));
    setViewProfileId(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={() => setViewProfileId(null)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:w-auto sm:min-w-[380px] sm:max-w-md bg-leaf-800 rounded-t-3xl sm:rounded-3xl border-t sm:border border-leaf-700 p-6 flex flex-col items-center gap-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-leaf-600" />

        {/* Avatar */}
        <div className="relative mt-2">
          <div className="w-16 h-16 rounded-full bg-leaf-500 flex items-center justify-center overflow-hidden"
            style={vf.isPremium ? { boxShadow: '0 0 0 2px #f59e0b, 0 0 12px rgba(245,158,11,0.4)' } : undefined}>
            <img src="/logo.png" alt="user" style={{ width: 38, height: 38, objectFit: 'contain' }} />
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-leaf-800 ${vf.isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
        </div>

        {/* Name + status */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <p className={`text-lg font-bold ${vf.isPremium ? 'text-amber-400' : 'text-leaf-50'}`}>{vf.alias}</p>
            {vf.isPremium && <Crown size={14} color="#f59e0b" />}
            {vf.isLinked && <VerifiedBadge size={14} />}
          </div>
          <p className={`text-xs font-semibold ${vf.isOnline ? 'text-green-400' : 'text-leaf-400'}`}>
            {vf.isOnline ? 'Online now' : vf.lastSeen ? `Last seen ${timeAgo(vf.lastSeen)}` : 'Offline'}
          </p>
          {vf.gender && <p className="text-xs text-leaf-400 capitalize">{vf.gender}</p>}
        </div>

        {/* Interests */}
        {vf.interests && vf.interests.length > 0 && (
          <div className="w-full flex flex-wrap gap-1.5 justify-center">
            {vf.interests.map(slug => (
              <span key={slug} className="px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
                style={vf.isPremium
                  ? { background: 'linear-gradient(150deg,#fde68a,#f59e0b)', color: '#1a2e05' }
                  : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#c8e6b0' }
                }>
                {slug.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 w-full mt-1">
          <button
            onClick={handleMessage}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-colors ${
              vf.isPremium ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-leaf-700 hover:bg-leaf-600 text-leaf-50'
            }`}
          >
            <MessageCircle size={16} />
            Message
          </button>
          <button
            onClick={handleCall}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-colors ${
              isPremium ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-mango-500 hover:bg-mango-600 text-leaf-800'
            }`}
          >
            <Phone size={16} />
            Call
          </button>
        </div>

        {/* Unfriend — redesigned */}
        <button
          onClick={handleUnfriend}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 text-xs font-semibold transition-all"
        >
          <UserMinus size={13} />
          Unfriend
        </button>
      </div>
    </div>
  );
}
