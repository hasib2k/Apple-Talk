import { useAudioLevel } from '../../hooks/useAudioLevel';

interface VoiceOrbProps {
  isActive: boolean;
  isMuted?: boolean;
  isLocal?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isPremium?: boolean;
  stream?: MediaStream | null;
}

const SIZES = {
  sm: { outer: 72, inner: 72 },
  md: { outer: 110, inner: 110 },
  lg: { outer: 160, inner: 140 },
};

export function VoiceOrb({ isActive, isMuted, isLocal, size = 'lg', isPremium, stream }: VoiceOrbProps) {
  const { outer, inner } = SIZES[size];
  const level = useAudioLevel(isActive && !isMuted ? (stream ?? null) : null);

  if (isLocal) {
    const ringColor = isPremium ? 'rgba(251,191,36,0.3)' : 'rgba(134,239,172,0.3)';
    const borderColor = isPremium ? 'rgba(251,191,36,0.4)' : 'rgba(134,239,172,0.25)';
    const shadowColor = isPremium ? 'rgba(245,158,11,0.25)' : 'rgba(134,239,172,0.20)';
    const barColor = isPremium ? '#fbbf24' : '#86efac';

    // Base bar heights, scaled by audio level
    const BASE_HEIGHTS = [10, 18, 14, 20, 12];
    const MAX_HEIGHTS =  [18, 28, 22, 30, 20];

    return (
      <div style={{ position: 'relative', width: outer, height: outer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isActive && !isMuted && (
          <div style={{
            position: 'absolute',
            width: outer * (1.3 + level * 0.3),
            height: outer * (1.3 + level * 0.3),
            borderRadius: '50%',
            border: `1.5px solid ${ringColor}`,
            opacity: 0.4 + level * 0.6,
            transition: 'width 0.1s ease, height 0.1s ease, opacity 0.1s ease',
            animation: level < 0.05 ? 'mtring 2.5s ease-out infinite' : 'none',
          }} />
        )}
        <div style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: isMuted
            ? 'linear-gradient(135deg,#450a0a,#7f1d1d)'
            : isPremium
              ? 'linear-gradient(135deg,#78350f,#92400e)'
              : 'linear-gradient(135deg,#14532d,#166534)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isMuted
            ? '0 0 24px rgba(239,68,68,0.25)'
            : `0 0 ${24 + level * 20}px ${shadowColor}`,
          border: `2px solid ${isMuted ? 'rgba(239,68,68,0.4)' : borderColor}`,
          transform: `scale(${1 + level * 0.06})`,
          transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        }}>
          {isMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v3M8 23h8" />
            </svg>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28 }}>
              {BASE_HEIGHTS.map((base, i) => {
                const h = isActive
                  ? base + (MAX_HEIGHTS[i] - base) * level
                  : 5;
                return (
                  <div key={i} style={{
                    width: 3,
                    height: h,
                    borderRadius: 3,
                    background: barColor,
                    transformOrigin: 'bottom',
                    transition: 'height 0.08s ease',
                    // Subtle idle animation when no audio
                    animation: isActive && level < 0.04
                      ? `barPulse ${[0.7, 0.9, 0.6, 0.8, 0.75][i]}s ease-in-out infinite alternate ${[0, 0.1, 0.2, 0.05, 0.25][i]}s`
                      : 'none',
                  }} />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Partner orb ──────────────────────────────────────────────
  const ringScale1 = 1 + level * 0.35;
  const ringScale2 = 1 + level * 0.22;
  const ringOpacity1 = isActive && !isMuted ? (0.25 + level * 0.55) : 0;
  const ringOpacity2 = isActive && !isMuted ? (0.15 + level * 0.45) : 0;
  const sphereScale = 1 + level * 0.05;
  const glowSize = 24 + level * 32;

  const ringColor1 = isPremium ? 'rgba(251,191,36,0.6)' : 'rgba(163,230,53,0.4)';
  const ringColor2 = isPremium ? 'rgba(251,191,36,0.4)' : 'rgba(163,230,53,0.3)';

  return (
    <div style={{ position: 'relative', width: outer + 40, height: outer + 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Ring 1 — reacts to audio */}
      <div style={{
        position: 'absolute',
        width: outer + 10,
        height: outer + 10,
        borderRadius: '50%',
        border: `1.5px solid ${ringColor1}`,
        transform: `scale(${isActive && !isMuted ? ringScale1 : 1})`,
        opacity: ringOpacity1,
        transition: 'transform 0.1s ease, opacity 0.1s ease',
        // Fallback idle pulse when no audio
        animation: isActive && !isMuted && level < 0.04 ? 'mtring 2.8s ease-out infinite' : 'none',
        pointerEvents: 'none',
      }} />

      {/* Ring 2 — reacts to audio with slight delay feel */}
      <div style={{
        position: 'absolute',
        width: outer + 10,
        height: outer + 10,
        borderRadius: '50%',
        border: `1.5px solid ${ringColor2}`,
        transform: `scale(${isActive && !isMuted ? ringScale2 : 1})`,
        opacity: ringOpacity2,
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        animation: isActive && !isMuted && level < 0.04 ? 'mtring 2.8s ease-out infinite 1.4s' : 'none',
        pointerEvents: 'none',
      }} />

      {/* Sphere */}
      <div style={{
        position: 'relative', width: inner, height: inner, borderRadius: '50%',
        background: isMuted
          ? 'linear-gradient(158deg,#3f0000,#7f1d1d 60%,#450a0a)'
          : isPremium
            ? 'linear-gradient(158deg,#fef9c3 0%,#fde68a 30%,#f59e0b 66%,#b45309 100%)'
            : isActive
              ? 'linear-gradient(158deg,#ecfccb 0%,#bef264 30%,#84cc16 66%,#4d7c0f 100%)'
              : 'linear-gradient(158deg,#2a5c3a,#163b24)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        boxShadow: isPremium
          ? `0 0 0 2px rgba(251,191,36,0.7), 0 0 ${glowSize}px rgba(245,158,11,${0.15 + level * 0.3})`
          : `0 0 ${glowSize}px rgba(163,230,53,${0.1 + level * 0.25})`,
        transform: `scale(${sphereScale})`,
        transition: 'transform 0.08s ease, box-shadow 0.08s ease, all 0.4s ease',
      }}>
        {isMuted ? (
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fca5a5', letterSpacing: '0.04em' }}>Muted</span>
        ) : (
          <img
            src="/logo.png"
            alt="AppleTalk"
            style={{
              width: inner * 0.5,
              height: inner * 0.5,
              objectFit: 'contain',
              opacity: isActive ? 1 : 0.3,
              transition: 'opacity 0.4s ease',
            }}
          />
        )}
      </div>
    </div>
  );
}
