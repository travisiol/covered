import { BRAND } from "@/lib/config";
import { LOGO } from "@/lib/logos";

function Mark({ id, color }: { id: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d={LOGO[id]} />
    </svg>
  );
}

/**
 * Three matte cards, stacked: the services a balance is typically spent on,
 * and the Covered card in front. HTML and CSS only, so every word is real text.
 */
export function HeroCards() {
  return (
    <div className="stack">
      <div className="stack-card stack-back">
        <p className="stack-brand">
          <Mark id="youtube" color="#171917" />
          YouTube Premium
        </p>
      </div>
      <div className="stack-card stack-mid">
        <p className="stack-brand">
          <Mark id="netflix" color="#E50914" />
          Netflix
        </p>
      </div>
      <div className="stack-card stack-front">
        <div className="flex items-start justify-between">
          <span className="emboss">
            <svg viewBox="0 0 24 24" fill="none" stroke="#171917" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5.5 12.5l4.2 4.2L18.5 8" />
            </svg>
          </span>
          <p className="stack-brand">
            <Mark id="spotify" color="#171917" />
            Spotify
          </p>
        </div>
        <div>
          <p className="stack-name">{BRAND.name.toUpperCase()}</p>
          <p className="stack-sub">Paid from your coin&apos;s creator fees</p>
        </div>
      </div>
    </div>
  );
}
