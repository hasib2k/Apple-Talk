import type { CSSProperties } from 'react';

/**
 * Claymorphism design tokens — soft, puffy, inflated surfaces.
 * Dark-green variant that keeps AppleTalk's brand identity.
 *
 * The signature look = big radius + an outer drop shadow + a light inner
 * highlight (top-left) + a dark inner shadow (bottom-right), so every surface
 * looks like a soft piece of pressed clay.
 */
export const CLAY = {
  // palette
  bg: '#0b2417',
  bgDeep: '#071a10',
  surface: '#103528',
  surfaceAlt: '#0d2d21',
  accent: '#a3e635',
  accentSoft: '#c6f06a',
  text: '#eaf7d9',
  muted: '#8bc4a2',
  faint: '#5f8f74',
  danger: '#f87171',

  // radii
  r: 28,
  rSm: 18,
  rPill: 999,

  // shadows
  raised:
    '9px 9px 22px rgba(0,0,0,0.45), -7px -7px 18px rgba(255,255,255,0.035), inset 2px 2px 5px rgba(255,255,255,0.06), inset -5px -5px 12px rgba(0,0,0,0.4)',
  raisedSm:
    '6px 6px 14px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.03), inset 1px 1px 3px rgba(255,255,255,0.05), inset -3px -3px 7px rgba(0,0,0,0.38)',
  pressed:
    'inset 5px 5px 12px rgba(0,0,0,0.5), inset -4px -4px 9px rgba(255,255,255,0.035)',
  btnGreen:
    '5px 5px 14px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.04), inset 3px 3px 6px rgba(226,255,170,0.65), inset -4px -4px 9px rgba(77,124,15,0.7)',
  btnDanger:
    '5px 5px 14px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.04), inset 3px 3px 6px rgba(254,180,180,0.5), inset -4px -4px 9px rgba(153,27,27,0.7)',

  // gradients
  accentGrad: 'linear-gradient(145deg,#c6f06a,#84cc16)',
  dangerGrad: 'linear-gradient(145deg,#f87171,#dc2626)',
} as const;

/** Puffy raised card/surface. */
export const clayCard = (extra?: CSSProperties): CSSProperties => ({
  background: CLAY.surface,
  borderRadius: CLAY.r,
  boxShadow: CLAY.raised,
  ...extra,
});

/** Inset (carved-in) surface — inputs, tracks, wells. */
export const clayInset = (extra?: CSSProperties): CSSProperties => ({
  background: CLAY.bgDeep,
  borderRadius: CLAY.rSm,
  boxShadow: CLAY.pressed,
  border: 'none',
  ...extra,
});

/** Puffy primary (green) button. */
export const clayBtn = (extra?: CSSProperties): CSSProperties => ({
  background: CLAY.accentGrad,
  color: '#1a2e05',
  fontWeight: 800,
  border: 'none',
  borderRadius: CLAY.rPill,
  boxShadow: CLAY.btnGreen,
  cursor: 'pointer',
  ...extra,
});

/** Soft neutral/ghost button (raised clay, no fill). */
export const clayGhost = (extra?: CSSProperties): CSSProperties => ({
  background: CLAY.surfaceAlt,
  color: CLAY.text,
  fontWeight: 600,
  border: 'none',
  borderRadius: CLAY.rPill,
  boxShadow: CLAY.raisedSm,
  cursor: 'pointer',
  ...extra,
});

/** Puffy danger (red) button. */
export const clayDanger = (extra?: CSSProperties): CSSProperties => ({
  background: CLAY.dangerGrad,
  color: '#fff',
  fontWeight: 800,
  border: 'none',
  borderRadius: CLAY.rPill,
  boxShadow: CLAY.btnDanger,
  cursor: 'pointer',
  ...extra,
});
