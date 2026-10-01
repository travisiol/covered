"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BRAND } from "@/lib/config";
import { short, useWallet, wallet } from "@/lib/wallet";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#cards", label: "Gift cards" },
  { href: "/launch", label: "Launch" },
  { href: "/balance", label: "Balance" },
  { href: "/docs", label: "Docs" },
];

export function Nav() {
  const path = usePathname();
  const w = useWallet();
  const [open, setOpen] = useState(false);

  const connect = (
    <button className="btn btn-line btn-sm" onClick={w.address ? wallet.disconnect : wallet.open} title={w.address ? "Disconnect" : undefined}>
      {w.address ? short(w.address) : "Connect wallet"}
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-line">
      <div className="wrap h-[68px] flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-[18px] tracking-[0.04em]">
          <Logo />
          {BRAND.name.toUpperCase()}
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-[15px] font-semibold" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "text-ink" : "text-mute hover:text-ink transition-colors"}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {connect}
          <button
            className="md:hidden grid place-items-center size-10 rounded-xl border border-line bg-card"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M4 4l10 10M14 4L4 14" /> : <path d="M2 5h14M2 9h14M2 13h14" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" className="md:hidden border-t border-line bg-paper" aria-label="Main">
          <ul className="wrap py-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="flex items-center min-h-12 text-[17px] font-semibold">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
