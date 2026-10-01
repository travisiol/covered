"use client";

import Link from "next/link";
import { useState } from "react";
import { keccak256, parseEther, toHex, zeroAddress, type Address } from "viem";
import { CATALOG, monthlyCard, type Brand } from "@/lib/catalog";
import { BRAND, PONS, ROUTER_ADDRESS, explorerTx } from "@/lib/config";
import { routerAbi } from "@/lib/covered";
import { priceWithFee, usd } from "@/lib/format";
import { ponsAbi, tokensForFirstBuy } from "@/lib/pons";
import { ensureRouter, rememberCoin, setupAutoPay } from "@/lib/tab";
import { errorText, publicClient, useWallet, wallet } from "@/lib/wallet";
import { BrandMark } from "./GiftCard";

const DESCRIPTION_MAX = 256;
const TAXES = [0, 1, 2, 3];
const MAX_PICKS = 4;

type Done = { token: Address; hash: string; warnings: string[] };

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="panel p-6 md:p-8">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-3">
        <span className="num grid place-items-center size-8 rounded-[10px] bg-ink text-card text-[14px] font-bold">{n}</span>
        <h2 className="text-[22px]">{title}</h2>
      </div>
      {hint && <p className="text-mute text-[14.5px] mt-2">{hint}</p>}
      <div className="grid gap-5 mt-6">{children}</div>
    </fieldset>
  );
}

export function LaunchForm() {
  const w = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [logo, setLogo] = useState("");
  const [about, setAbout] = useState("");
  const [x, setX] = useState("");
  const [buy, setBuy] = useState("");
  const [tax, setTax] = useState(0);
  const [picks, setPicks] = useState<Brand[]>([]);
  const [monthly, setMonthly] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);

  // The coin says what it pays for, so buyers know before they trade.
  const feeLine = picks.length ? `Creator fees pay for ${picks.map((b) => b.name).join(", ")} via ${BRAND.name}` : BRAND.feeLine;
  const description = `${about.trim()}${about.trim() ? " " : ""}${feeLine}`;
  const buyWei = (() => {
    try {
      return buy.trim() ? parseEther(buy.trim()) : 0n;
    } catch {
      return null;
    }
  })();
  const monthlyCost = picks.reduce((sum, b) => sum + priceWithFee(monthlyCard(b)), 0);
  const perThousand = 1000 * (0.01 * PONS.creatorShareOfFee + tax / 100);

  const problem =
    !name.trim() ? "Give your coin a name."
    : !/^[A-Za-z0-9]{2,11}$/.test(symbol) ? "The ticker is 2 to 11 letters or digits."
    : description.length > DESCRIPTION_MAX ? `The description is ${description.length - DESCRIPTION_MAX} characters too long.`
    : logo && !/^(https:\/\/|ipfs:\/\/)/.test(logo) ? "The image must be an https:// or ipfs:// link."
    : buyWei === null ? "The first buy is not a valid amount of ETH."
    : email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "That e-mail address does not look right."
    : null;

  const toggle = (b: Brand) =>
    setPicks((now) => (now.some((p) => p.id === b.id) ? now.filter((p) => p.id !== b.id) : now.length < MAX_PICKS ? [...now, b] : now));

  async function launch() {
    setError(null);
    if (!ROUTER_ADDRESS) {
      setError("Covered is not open for launches yet.");
      return;
    }
    try {
      setBusy("Waiting for your wallet…");
      await ensureRouter(() => setBusy("First launch ever: confirm the one-time set-up of Covered…"));
      const client = await wallet.client();
      const me = client.account.address;
      const [tab, economicsHash, fee] = await Promise.all([
        publicClient.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "predictTab", args: [me] }),
        publicClient.readContract({ address: PONS.factory, abi: ponsAbi, functionName: "previewLaunchEconomics", args: [0n, zeroAddress] }),
        publicClient.readContract({ address: PONS.factory, abi: ponsAbi, functionName: "launchFee" }),
      ]);
      const params = {
        name: name.trim(),
        symbol: symbol.toUpperCase(),
        logo: logo.trim(),
        description,
        socials: { twitter: x.trim(), telegram: "", discord: "", website: `${window.location.origin}`, farcaster: "" },
        // The whole point: creator fees go to the launcher's Covered balance.
        creatorFeeRecipient: tab,
        creatorTaxBps: tax * 100,
        buybackEnabled: false,
        economicsHash,
        salt: keccak256(toHex(`${me}:${Date.now()}:${Math.random()}`)),
      };
      // Simulating first gives the coin's address and catches a revert before the wallet opens.
      const { request, result } =
        buyWei! > 0n
          ? await publicClient.simulateContract({
              account: me,
              address: PONS.forwarder,
              abi: ponsAbi,
              functionName: "launchAndBuy",
              args: [params, 0n, zeroAddress, buyWei!, (tokensForFirstBuy(buyWei!) * 95n) / 100n, me, []],
              value: fee + buyWei!,
            })
          : await publicClient.simulateContract({
              account: me,
              address: PONS.factory,
              abi: ponsAbi,
              functionName: "launchToken",
              args: [params, 0n, zeroAddress, []],
              value: fee,
            });
      setBusy("1 of 2 · Confirm the launch in your wallet…");
      const hash = await client.writeContract(request as Parameters<typeof client.writeContract>[0]);
      setBusy("Launching…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The launch transaction failed.");
      const [token, curve] = result;
      rememberCoin(me, { token, curve, name: params.name, symbol: params.symbol, at: Date.now() });

      // The coin is live from here. What follows can be redone from the balance page.
      const warnings: string[] = [];
      if (picks.length || email.trim()) {
        try {
          setBusy("2 of 2 · Confirm your auto-pay list…");
          await setupAutoPay(picks.map((brand) => ({ brand, amount: monthlyCard(brand), monthly })), email.trim());
        } catch (e) {
          warnings.push(`Your auto-pay list was not saved (${errorText(e)}) Set it from your balance page.`);
        }
      }
      setDone({ token, hash, warnings });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    const link = `${window.location.origin}/c/${done.token}`;
    const post = `I launched $${symbol.toUpperCase()}. Its creator fees pay for my ${picks.map((b) => b.name).join(", ") || "gift cards"}.`;
    return (
      <div className="panel p-8 md:p-12 max-w-[680px] mx-auto text-center fade-up">
        <span className="tag bg-sage-soft">Launched</span>
        <h2 className="text-[34px] md:text-[44px] mt-5">${symbol.toUpperCase()} is live</h2>
        <p className="text-mute mt-4 leading-relaxed max-w-[480px] mx-auto">
          Every trade now adds to your balance{picks.length ? ", and your cards are bought by themselves as the fees come in" : ""}. Share its page: it
          shows anyone what the coin pays for.
        </p>
        <p className="tile num text-[14px] px-4 py-3 mt-7 break-all select-all">{link}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <a className="btn btn-primary" href={`https://x.com/intent/post?text=${encodeURIComponent(post)}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">
            Post on X
          </a>
          <button
            className="btn btn-line"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <Link href="/balance" className="btn btn-line">
            My balance
          </Link>
        </div>
        {done.warnings.map((text) => (
          <p key={text} className="text-[14px] font-semibold mt-5">
            {text}
          </p>
        ))}
        <a href={explorerTx(done.hash)} target="_blank" rel="noreferrer" className="inline-block text-mute text-[13.5px] underline mt-6">
          View the launch transaction
        </a>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5 items-start">
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void launch();
        }}
      >
        <Section n={1} title="Your coin">
          <div className="grid sm:grid-cols-[1.4fr_1fr] gap-4">
            <label>
              <span className="label">Name</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Movie Night" maxLength={34} />
            </label>
            <label>
              <span className="label">Ticker</span>
              <input className="field uppercase" value={symbol} onChange={(e) => setSymbol(e.target.value.trim())} placeholder="MOVIE" maxLength={11} />
            </label>
          </div>
          <label>
            <span className="label">Image link</span>
            <input className="field" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://… or ipfs://…" />
            <span className="hint block">Optional. A square PNG or JPG hosted anywhere public.</span>
          </label>
          <label>
            <span className="label">Description</span>
            <textarea className="field" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What is this coin about?" />
            <span className="hint block">
              Ends with “{feeLine}”. {description.length}/{DESCRIPTION_MAX}
            </span>
          </label>
          <label>
            <span className="label">X link</span>
            <input className="field" value={x} onChange={(e) => setX(e.target.value)} placeholder="https://x.com/…" />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label>
              <span className="label">First buy, in ETH</span>
              <input className="field num" value={buy} onChange={(e) => setBuy(e.target.value)} placeholder="0" inputMode="decimal" />
              <span className="hint block">Optional. Buys your own coin in the launch transaction, before anyone else.</span>
            </label>
            <div>
              <span className="label">Creator tax</span>
              <div className="flex gap-2">
                {TAXES.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setTax(t)}
                    aria-pressed={tax === t}
                    className={`min-h-12 flex-1 rounded-[13px] text-[15px] font-bold border transition-colors ${tax === t ? "bg-ink text-card border-ink" : "border-line bg-card hover:border-ink"}`}
                  >
                    {t}%
                  </button>
                ))}
              </div>
              <span className="hint block">Optional, on top of pons&apos; 1% fee, all of it to your balance. Cannot be changed later.</span>
            </div>
          </div>
        </Section>

        <Section n={2} title="What should it pay for?" hint={`Pick up to ${MAX_PICKS}. Each card is bought by itself as soon as your coin's fees cover it. You can change the list any time.`}>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATALOG.map((b) => {
              const on = picks.some((p) => p.id === b.id);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => toggle(b)}
                    aria-pressed={on}
                    disabled={!on && picks.length >= MAX_PICKS}
                    className={`w-full flex items-center gap-2.5 min-h-12 px-3 rounded-[13px] border text-left text-[14px] font-bold transition-colors disabled:opacity-40 ${on ? "border-ink bg-sage-soft" : "border-line bg-card hover:border-ink"}`}
                  >
                    <span className="grid place-items-center size-7 rounded-lg shrink-0" style={{ background: b.bg, boxShadow: "0 0 0 1px #17191714" }}>
                      <BrandMark brand={b} size={15} />
                    </span>
                    <span className="truncate">{b.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How often">
            {[
              [true, "Every 30 days"],
              [false, "Once"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={String(label)}
                role="radio"
                aria-checked={monthly === value}
                onClick={() => setMonthly(value as boolean)}
                className={`min-h-11 px-5 rounded-xl text-[14.5px] font-bold border transition-colors ${monthly === value ? "bg-ink text-card border-ink" : "bg-card border-line hover:border-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section n={3} title="Where do the cards go?" hint="Every code appears in your account, readable only by your wallet. Add an e-mail to get it in your inbox as well.">
          <label>
            <span className="label">E-mail</span>
            <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <span className="hint block">Optional. Stored encrypted, used only to send your cards.</span>
          </label>
        </Section>

        {error && (
          <p role="alert" className="panel px-6 py-4 text-red font-semibold">
            {error}
          </p>
        )}

        {!w.address ? (
          <button type="button" className="btn btn-primary w-full" onClick={wallet.open}>
            Connect wallet to launch
          </button>
        ) : (
          <div>
            <button className="btn btn-primary w-full" disabled={busy !== null || problem !== null}>
              {busy ?? "Launch on pons"}
            </button>
            <p className="hint">
              {problem ??
                `pons charges 0.0005 ETH to launch, plus your first buy if you set one.${picks.length || email.trim() ? " A second confirmation saves your auto-pay list." : ""}`}
            </p>
          </div>
        )}
      </form>

      <aside className="panel p-7 lg:sticky lg:top-24">
        <p className="text-mute text-[14px] font-semibold">What people will see</p>
        <p className="font-extrabold text-[28px] tracking-tight mt-1 break-words">
          {name || "Coin name"} <span className="text-mute">${symbol.toUpperCase() || "TICKER"}</span>
        </p>
        <p className="text-mute text-[14.5px] mt-3">This coin pays for</p>
        {picks.length === 0 ? (
          <p className="tile p-4 text-[14.5px] mt-3">Pick what your coin should pay for in step 2.</p>
        ) : (
          <ul className="grid gap-2 mt-3">
            {picks.map((b) => (
              <li key={b.id} className="tile flex items-center justify-between gap-3 px-3 min-h-14">
                <span className="flex items-center gap-2.5 font-bold">
                  <span className="grid place-items-center size-8 rounded-lg" style={{ background: b.bg, boxShadow: "0 0 0 1px #17191714" }}>
                    <BrandMark brand={b} size={17} />
                  </span>
                  {b.name}
                </span>
                <span className="num font-bold">
                  ${monthlyCard(b)}
                  <span className="text-mute font-semibold text-[13px]"> {monthly ? "/ 30 days" : "once"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-6 pt-5 border-t border-line grid gap-3 text-[14.5px]">
          <div className="flex justify-between gap-4">
            <dt className="text-mute">Creator fees per $1,000 traded</dt>
            <dd className="num font-bold">{usd(perThousand)}</dd>
          </div>
          {picks.length > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-mute">Trading needed to pay the list</dt>
              <dd className="num font-bold">{usd((monthlyCost / perThousand) * 1000, 0)}</dd>
            </div>
          )}
        </dl>
        <p className="hint">An estimate from pons&apos; fee rate. Fees depend on people trading the coin and can be zero.</p>
      </aside>
    </div>
  );
}
