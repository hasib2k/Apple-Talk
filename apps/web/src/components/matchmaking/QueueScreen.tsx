import { useEffect, useState } from 'react';
import { Loader2, Mic } from 'lucide-react';
import type { CallStatus } from '../../store/call.store';

interface QueueScreenProps {
  status: CallStatus;
  onCancel: () => void;
  label?: string;
  isFriendCall?: boolean;
}

export function QueueScreen({ status, onCancel, label, isFriendCall }: QueueScreenProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-dvh bg-leaf-900 flex flex-col items-center justify-center gap-8 px-6">
      {/* Animated search orb */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-mango-500/30 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-mango-500/50 animate-ping [animation-delay:0.3s]" />
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-mango-400 to-mango-600 flex items-center justify-center shadow-xl">
          <Mic size={40} className="text-white" />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-white text-2xl font-serif font-bold mb-2">
          {label ?? (status === 'idle' ? 'Getting ready' : `Finding someone${dots}`)}
        </h2>
        <p className="text-leaf-300 text-sm">
          {isFriendCall
            ? 'Setting up your friend call...'
            : status === 'queued'
            ? 'Matching on your interests and region...'
            : 'Connecting to server...'}
        </p>
      </div>

      {!isFriendCall && (
        <div className="flex items-center gap-2 text-leaf-400 text-xs">
          <Loader2 size={14} className="animate-spin" />
          <span>Usually under 30 seconds</span>
        </div>
      )}

      <button
        onClick={onCancel}
        className="text-leaf-300 hover:text-white text-sm border border-leaf-700 px-6 py-2.5 rounded-xl transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
