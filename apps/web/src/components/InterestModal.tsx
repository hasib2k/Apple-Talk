import { useState } from 'react';
import {
  Music, Gamepad2, Sparkles, Film, BookOpen, Plane, UtensilsCrossed,
  Trophy, Cpu, Palette, Code2, Dumbbell, X, Check,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';

const INTERESTS: { slug: string; label: string; icon: LucideIcon }[] = [
  { slug: 'music',   label: 'Music',   icon: Music },
  { slug: 'gaming',  label: 'Gaming',  icon: Gamepad2 },
  { slug: 'anime',   label: 'Anime',   icon: Sparkles },
  { slug: 'movies',  label: 'Movies',  icon: Film },
  { slug: 'books',   label: 'Books',   icon: BookOpen },
  { slug: 'travel',  label: 'Travel',  icon: Plane },
  { slug: 'food',    label: 'Food',    icon: UtensilsCrossed },
  { slug: 'sports',  label: 'Sports',  icon: Trophy },
  { slug: 'tech',    label: 'Tech',    icon: Cpu },
  { slug: 'art',     label: 'Art',     icon: Palette },
  { slug: 'coding',  label: 'Coding',  icon: Code2 },
  { slug: 'fitness', label: 'Fitness', icon: Dumbbell },
];

interface InterestModalProps {
  onDone: (selected: string[]) => void;
  onSkip: () => void;
}

export function InterestModal({ onDone, onSkip }: InterestModalProps) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(slug: string) {
    setSelected(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < 5 ? [...prev, slug] : prev
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: '#0c2e1d' }}
      >
        {/* Header */}
        <div className="pt-8 pb-4 px-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-serif font-bold text-white">
                What are you into?
              </h2>
              <p className="mt-1 text-sm text-white/50">
                Pick up to 5 interests for better matching.{' '}
                <span className="text-white/30">You can change these later from your profile.</span>
              </p>
            </div>
            <button
              onClick={onSkip}
              className="shrink-0 ml-3 p-1.5 rounded-xl text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
              title="Skip"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Interest grid */}
        <div className="px-6 pb-5">
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(i => (
              <button
                key={i.slug}
                onClick={() => toggle(i.slug)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border-2 transition-all',
                  selected.includes(i.slug)
                    ? 'border-mango-500 bg-mango-500/20 text-mango-400'
                    : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white',
                )}
              >
                <i.icon size={12} />
                <span>{i.label}</span>
                {selected.includes(i.slug) && <Check size={10} className="text-mango-400" />}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-white/25 mt-3">
            {selected.length}/5 selected
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-7 flex flex-col gap-2">
          <button
            onClick={() => onDone(selected)}
            className="w-full bg-mango-500 hover:bg-mango-600 text-white font-semibold py-3 rounded-2xl text-sm transition-all"
          >
            {selected.length > 0 ? 'Save & Continue' : 'Skip for now'}
          </button>
        </div>
      </div>
    </div>
  );
}
