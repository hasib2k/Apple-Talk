export function VerifiedBadge({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }} aria-label="Verified">
      <circle cx="10" cy="10" r="10" fill="#3b82f6" />
      <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
