"use client";

import { useEffect, useState } from "react";
import { errorText, useWallet, wallet, type Detected } from "@/lib/wallet";

export function WalletDialog() {
  const w = useWallet();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!w.dialog) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && wallet.close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [w.dialog]);

  if (!w.dialog) return null;

  const pick = async (d: Detected) => {
    setError(null);
    try {
      await wallet.connect(d);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink/45" onClick={wallet.close}>
      <div role="dialog" aria-modal aria-label="Connect a wallet" className="panel w-full max-w-[400px] p-6 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[24px] font-bold">Connect a wallet</h2>
          <button onClick={wallet.close} aria-label="Close" className="size-9 rounded-full hover:bg-paper text-mute text-2xl">
            ×
          </button>
        </div>
        {w.wallets.length === 0 ? (
          <p className="text-mute text-[15px] leading-relaxed">
            No wallet found in this browser. Install one that supports Robinhood Chain (MetaMask, Rabby, Robinhood Wallet), then reload this page.
          </p>
        ) : (
          <ul className="grid gap-2">
            {w.wallets.map((d) => (
              <li key={d.uuid}>
                <button onClick={() => pick(d)} className="w-full flex items-center gap-3 h-14 px-4 rounded-[13px] border border-line hover:border-ink transition-colors text-left font-bold">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.icon} alt="" className="size-7 rounded-md" />
                  {d.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-4 text-[14px] text-red">{error}</p>}
        <p className="hint mt-5">Your tab belongs to the wallet you connect. Only that wallet can spend or withdraw its balance.</p>
      </div>
    </div>
  );
}
