interface GenderModalProps {
  onSelect: (gender: 'male' | 'female') => void;
}

export function GenderModal({ onSelect }: GenderModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: '#0c2e1d' }}
      >
        {/* Header */}
        <div className="pt-8 pb-4 px-6 text-center">
          <img src="/logo.png" alt="AppleTalk" className="w-14 h-14 mx-auto" />
          <h2 className="mt-3 text-xl font-serif font-bold text-white">
            Welcome to AppleTalk
          </h2>
          <p className="mt-1.5 text-sm text-white/50">
            Tell us who you are
          </p>
        </div>

        {/* Warning */}
        <div className="mx-6 mb-4 px-4 py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex gap-2.5 items-start">
          <span className="text-yellow-400 text-base mt-0.5">⚠️</span>
          <p className="text-yellow-300/90 text-xs leading-relaxed">
            <span className="font-semibold">This cannot be changed once selected.</span>{' '}
            Your gender and username are permanently tied to this device — even clearing browser data will not reset it.
            <span className="block mt-1 text-yellow-300/70">একবার select করলে আর পরিবর্তন করা যাবে না। browser data clear করলেও এটি reset হবে না।</span>
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 mx-6" />

        {/* Options */}
        <div className="p-6 flex flex-col gap-3">
          <button
            onClick={() => onSelect('male')}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-white/10 hover:border-mango-500 hover:bg-mango-500/10 transition-all duration-200 group"
          >
            <span className="text-3xl">👨</span>
            <div className="text-left">
              <p className="text-white font-semibold text-base group-hover:text-mango-400 transition-colors">Male</p>
              <p className="text-white/40 text-xs">I am male</p>
            </div>
          </button>

          <button
            onClick={() => onSelect('female')}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-white/10 hover:border-mango-500 hover:bg-mango-500/10 transition-all duration-200 group"
          >
            <span className="text-3xl">👩</span>
            <div className="text-left">
              <p className="text-white font-semibold text-base group-hover:text-mango-400 transition-colors">Female</p>
              <p className="text-white/40 text-xs">I am female</p>
            </div>
          </button>
        </div>

        <p className="text-center text-white/25 text-xs pb-5">
          Used only for better matching
        </p>
      </div>
    </div>
  );
}
