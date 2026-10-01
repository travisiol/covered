import type { Brand } from "@/lib/catalog";
import { LOGO, WORDMARKS } from "@/lib/logos";

export function BrandMark({ brand, size = 20, color }: { brand: Brand; size?: number | string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color ?? brand.mark} aria-hidden>
      <path d={LOGO[brand.id]} />
    </svg>
  );
}

export function GiftCard({ brand, amount, note, className = "" }: { brand: Brand; amount?: number; note?: string; className?: string }) {
  return (
    <div className={`gc ${className}`} style={{ background: brand.bg, color: brand.fg }}>
      {/* The mark again, oversized and faint, bleeding off the corner. */}
      <svg viewBox="0 0 24 24" className="gc-ghost" fill={brand.mark} aria-hidden>
        <path d={LOGO[brand.id]} />
      </svg>
      <div className="flex items-start justify-between">
        <BrandMark brand={brand} size={WORDMARKS.has(brand.id) ? "30cqw" : "19cqw"} />
        {amount !== undefined ? <span className="gc-amount num">${amount}</span> : <span className="gc-kind">GIFT CARD</span>}
      </div>
      <div>
        {!WORDMARKS.has(brand.id) && <div className="gc-name">{brand.name}</div>}
        {note && <div className="gc-note">{note}</div>}
      </div>
    </div>
  );
}
