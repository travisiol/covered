"use client";

import { useState } from "react";
import { CATALOG } from "@/lib/catalog";
import { PONS } from "@/lib/config";
import { usd } from "@/lib/format";

// Slider position 0..100 -> $50..$50,000 a day, on a log scale.
const volumeAt = (p: number) => Math.round((50 * Math.pow(1000, p / 100)) / 10) * 10;
const SUBS = [...CATALOG].sort((a, b) => a.monthly - b.monthly);

/** An estimate the visitor drives himself. Nothing here is a figure about real coins. */
export function Calculator() {
  const [pos, setPos] = useState(38);
  const [tax, setTax] = useState(0);
  const volume = volumeAt(pos);
  const monthly = volume * 30 * (0.01 * PONS.creatorShareOfFee + tax / 100);

  let left = monthly;
  const covered = new Set<string>();
  for (const b of SUBS) {
    if (left < b.monthly) break;
    left -= b.monthly;
    covered.add(b.id);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16 items-start">
      <div>
        <span className="tag bg-accent-soft">Estimate</span>
        <h2 className="text-[30px] md:text-[40px] mt-4">What could a coin cover?</h2>
        <p className="text-mute leading-relaxed mt-4 max-w-[440px]">
          Move the slider to a trading volume. pons takes 1% of every trade and gives the creator {PONS.creatorShareOfFee * 100}% of it; a creator tax
          is added on top.
        </p>

        <label className="block mt-9">
          <span className="flex items-baseline justify-between text-[14.5px] font-bold">
            Trading volume per day
            <span className="num text-[22px] font-extrabold">{usd(volume, 0)}</span>
          </span>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="w-full mt-3 accent-accent h-6" />
        </label>

        <div className="mt-6">
          <span className="text-[14.5px] font-bold">Creator tax</span>
          <div className="flex gap-2 mt-3">
            {[0, 1, 2, 3].map((t) => (
              <button
                key={t}
                onClick={() => setTax(t)}
                aria-pressed={tax === t}
                className={`min-h-11 px-5 rounded-xl text-[14.5px] font-bold border transition-colors ${tax === t ? "bg-ink text-card border-ink" : "bg-card border-line hover:border-ink"}`}
              >
                {t}%
              </button>
            ))}
          </div>
        </div>

        <div className="mt-9 pt-7 border-t border-line">
          <p className="text-mute text-[14.5px]">At that volume, creator fees would be about</p>
          <p className="num text-[48px] md:text-[60px] font-extrabold leading-none mt-2">
            {usd(monthly, 0)}
            <span className="text-mute text-[18px] font-semibold"> / month</span>
          </p>
          <p className="text-mute text-[13.5px] mt-4">An estimate, not a promise or an income. Most coins stop trading, and a coin nobody trades earns nothing.</p>
        </div>
      </div>

      <div>
        <p className="font-bold mb-4">
          {covered.size === 0 ? "Not enough for a subscription yet" : `Enough for ${covered.size} of these ${SUBS.length} each month`}
        </p>
        <ul className="grid sm:grid-cols-2 gap-2.5">
          {SUBS.map((b) => {
            const on = covered.has(b.id);
            return (
              <li
                key={b.id}
                className={`flex items-center justify-between gap-3 min-h-14 px-4 rounded-[14px] border text-[14.5px] transition-colors duration-200 ${on ? "bg-sage-soft border-sage" : "bg-paper border-line text-mute"}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={`grid place-items-center size-5 rounded-full text-[11px] font-bold shrink-0 ${on ? "bg-ink text-card" : "border border-line"}`}>
                    {on ? "✓" : ""}
                  </span>
                  <span className="truncate font-semibold">{b.covers}</span>
                </span>
                <span className="num shrink-0 font-semibold">{usd(b.monthly)}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-mute text-[13px] mt-4">Typical US monthly prices, for the estimate only.</p>
      </div>
    </div>
  );
}
