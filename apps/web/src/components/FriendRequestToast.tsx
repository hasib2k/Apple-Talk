import { useEffect } from 'react';
import { UserPlus, Check, X } from 'lucide-react';
import { IncomingRequest } from '../store/friend.store';

interface Props {
  request: IncomingRequest;
  onAccept: (requesterId: string) => void;
  onReject: (requesterId: string) => void;
  onDismiss: (requesterId: string) => void;
}

export function FriendRequestToast({ request, onAccept, onReject, onDismiss }: Props) {
  // Auto-dismiss after 20 seconds (keeps in sidebar, just hides toast)
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(request.id), 20_000);
    return () => clearTimeout(timer);
  }, [request.id]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-slide-up" style={{ top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))' }}>
      <div className="bg-leaf-800 rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-mango-500/20 flex items-center justify-center shrink-0">
          <UserPlus size={18} className="text-mango-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{request.alias}</p>
          <p className="text-leaf-400 text-xs">wants to add you as a friend</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onAccept(request.id)}
            className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
          >
            <Check size={16} className="text-white" />
          </button>
          <button
            onClick={() => onReject(request.id)}
            className="w-8 h-8 rounded-full bg-leaf-700 hover:bg-leaf-600 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-white/70" />
          </button>
        </div>
      </div>
    </div>
  );
}
