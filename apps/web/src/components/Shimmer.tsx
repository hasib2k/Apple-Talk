import type { CSSProperties } from 'react';

// ── Base block ────────────────────────────────────────────────
interface ShProps {
  w?: number | string;
  h: number | string;
  r?: number | string;
  style?: CSSProperties;
}

export function Sh({ w, h, r = 8, style }: ShProps) {
  return (
    <div
      className="shimmer"
      style={{ width: w ?? '100%', height: h, borderRadius: r, flexShrink: 0, ...style }}
    />
  );
}

// ── Friend / history row ──────────────────────────────────────
export function RowSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
      <Sh w={36} h={36} r="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Sh w="55%" h={12} r={6} />
        <Sh w="35%" h={10} r={6} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Sh w={32} h={32} r="50%" />
        <Sh w={32} h={32} r="50%" />
      </div>
    </div>
  );
}

// ── Feed post card ────────────────────────────────────────────
export function PostSkeleton() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 18, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Sh w={38} h={38} r="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Sh w="40%" h={11} r={6} />
          <Sh w="25%" h={9} r={6} />
        </div>
      </div>
      {/* Content lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Sh h={11} r={6} />
        <Sh w="85%" h={11} r={6} />
        <Sh w="60%" h={11} r={6} />
      </div>
      {/* Action row */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <Sh w={56} h={28} r={99} />
        <Sh w={72} h={28} r={99} />
        <Sh w={48} h={28} r={99} style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  );
}

// ── Comment row skeleton ──────────────────────────────────────
export function CommentSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
      <Sh w={28} h={28} r="50%" />
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Sh w="35%" h={10} r={6} />
        <Sh w="80%" h={10} r={6} />
      </div>
    </div>
  );
}

// ── Profile stat card (small box) ────────────────────────────
export function StatCardSkeleton() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Sh w={28} h={28} r={8} />
      <Sh w="60%" h={22} r={6} />
      <Sh w="80%" h={10} r={6} />
    </div>
  );
}

// ── Profile header ────────────────────────────────────────────
export function ProfileHeaderSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 20px 16px' }}>
      <Sh w={80} h={80} r="50%" />
      <Sh w={130} h={18} r={9} />
      <Sh w={90} h={12} r={6} />
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <Sh w={70} h={36} r={12} />
        <Sh w={70} h={36} r={12} />
        <Sh w={70} h={36} r={12} />
      </div>
    </div>
  );
}
