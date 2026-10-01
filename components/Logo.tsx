/** A card with a tick on it: covered. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <rect x="1" y="5" width="26" height="18" rx="5.5" fill="#ff6b35" />
      <path d="M8.5 14.2l3.4 3.4 7.6-7.6" fill="none" stroke="#171917" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
