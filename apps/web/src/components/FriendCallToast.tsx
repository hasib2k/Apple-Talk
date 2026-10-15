import { Phone, PhoneOff } from 'lucide-react';

interface Props {
  call: { fromId: string; fromAlias: string };
  onAccept: (fromId: string) => void;
  onDecline: (fromId: string) => void;
}

export function FriendCallToast({ call, onAccept, onDecline }: Props) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-slide-up" style={{ top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))' }}>
      <div className="bg-leaf-800 rounded-2xl shadow-2xl px-4 py-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 animate-pulse">
          <Phone size={18} className="text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{call.fromAlias}</p>
          <p className="text-leaf-400 text-xs">is calling you</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onAccept(call.fromId)}
            className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
            title="Receive"
          >
            <Phone size={16} className="text-white" />
          </button>
          <button
            onClick={() => onDecline(call.fromId)}
            className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            title="Reject"
          >
            <PhoneOff size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
