import Link from "next/link";
import { BRAND, PONS, ROUTER_ADDRESS, explorerAddress } from "@/lib/config";
import { Logo } from "./Logo";

export function Footer() {
  const link = "text-mute hover:text-ink transition-colors";
  return (
    <footer className="mt-28 border-t border-line">
      <div className="wrap py-10 flex flex-wrap items-start justify-between gap-x-12 gap-y-8 text-[14px]">
        <div className="max-w-[440px]">
          <div className="flex items-center gap-2.5 font-extrabold tracking-[0.04em] text-[16px]">
            <Logo size={22} />
            {BRAND.name.toUpperCase()}
          </div>
          <p className="text-mute leading-relaxed mt-3">
            Not affiliated with, sponsored by or endorsed by any brand whose gift cards are listed, nor by Robinhood or pons. Creator fees depend on
            people trading a coin and can be zero.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          <Link href="/launch" className={link}>Launch</Link>
          <Link href="/balance" className={link}>Balance</Link>
          <Link href="/docs" className={link}>Docs</Link>
          {ROUTER_ADDRESS ? (
            <a href={explorerAddress(ROUTER_ADDRESS)} target="_blank" rel="noreferrer" className={link}>Router contract</a>
          ) : (
            <Link href="/docs#contracts" className={link}>Contracts</Link>
          )}
          <a href={explorerAddress(PONS.factory)} target="_blank" rel="noreferrer" className={link}>pons factory</a>
        </nav>
      </div>
    </footer>
  );
}
