"use client";

import Link from "next/link";
import { useState } from "react";
import { CATALOG, monthlyCard, type Brand } from "@/lib/catalog";
import { PLAN_PERIOD_DAYS, SERVICE_FEE_BPS, explorerAddress } from "@/lib/config";
import { ago, priceWithFee, until, usd } from "@/lib/format";
import { saveDeliveryEmail, savedEmail, tabActions, useTab, type OrderView } from "@/lib/tab";
import { errorText, short, useWallet, wallet } from "@/lib/wallet";
import { BrandMark, GiftCard } from "./GiftCard";

const STATUS_STYLE: Record<OrderView["status"], string> = {
  none: "",
  open: "bg-accent-soft text-ink",
  delivered: "bg-sage-soft text-ink",
  refunded: "bg-paper text-mute",
};
const STATUS_LABEL: Record<OrderView["status"], string> = { none: "", open: "On its way", delivered: "Delivered", refunded: "Refunded" };

/** How far the balance is toward a card, as a bar. */
export function Progress({ have, need }: { have: number; need: number }) {
  const pct = Math.max(0, Math.min(100, (have / need) * 100));
  return (
    <div>
      <div className="h-2 rounded-full bg-paper border border-line overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-accent rounded-full transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <p className="num text-mute text-[13px] mt-1.5">
        {usd(Math.min(have, need))} of {usd(need)}
      </p>
    </div>
  );
}

export function BalanceView() {
  const w = useWallet();
  const tab = useTab(w.address);
  const [picked, setPicked] = useState<Brand | null>(null);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [codes, setCodes] = useState<Record<number, { code: string; pin: string | null }>>({});
  const [email, setEmail] = useState<string | null>(null);

  if (!w.address) {
    return (
      <div className="panel p-10 text-center max-w-[560px] mx-auto">
        <h2 className="text-[28px]">Connect your wallet</h2>
        <p className="text-mute mt-3">Your balance and your cards belong to the wallet you launched your coin with.</p>
        <button className="btn btn-primary mt-7" onClick={wallet.open}>
          Connect wallet
        </button>
      </div>
    );
  }

  const me = w.address;
  const spendable = tab.availableUsd + tab.pendingUsd;
  const emailValue = email ?? savedEmail(me);

  const run = async (label: string, job: () => Promise<string | void>) => {
    setBusy(label);
    setNote(null);
    try {
      const text = await job();
      if (text) setNote({ text });
    } catch (e) {
      setNote({ text: errorText(e), bad: true });
    } finally {
      setBusy(null);
    }
  };

  const pick = (b: Brand) => {
    setPicked(b);
    setAmount(monthlyCard(b));
    setNote(null);
  };
  const price = priceWithFee(amount);
  const short_ = picked && price > spendable;

  return (
    <div className="grid gap-5">
      <section className="panel p-7 md:p-9 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-mute text-[15px] font-semibold">Available balance</p>
          <p className="num text-[52px] md:text-[64px] font-extrabold leading-none mt-2">
            {tab.ready ? usd(spendable) : <span className="text-mute text-[28px]">Loading…</span>}
          </p>
          <p className="text-mute text-[14px] mt-4">
            {usd(tab.earnedUsd)} collected from creator fees so far
            {tab.lockedUsd > 0 && ` · ${usd(tab.lockedUsd)} held for cards on their way`}
            {tab.tab && (
              <>
                {" · "}
                <a className="underline" href={explorerAddress(tab.tab)} target="_blank" rel="noreferrer">
                  {short(tab.tab)}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab.ready && tab.coins.length === 0 && tab.earnedUsd === 0 && (
            <Link href="/launch" className="btn btn-primary">
              Launch a coin
            </Link>
          )}
          <button className="btn btn-line" disabled={busy !== null || spendable <= 0} onClick={() => run("withdraw", () => tabActions.withdrawAll(me))}>
            {busy === "withdraw" ? "Withdrawing…" : "Withdraw as ETH"}
          </button>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <section className="panel p-7">
          <h2 className="text-[24px]">Auto-pay</h2>
          <p className="text-mute text-[14.5px] mt-2">Cards on this list are bought by themselves, as soon as your balance covers them.</p>
          {tab.plans.length === 0 ? (
            <p className="tile p-4 text-[14.5px] mt-5">Nothing on the list yet. Pick a card below and choose “Auto-buy”.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {tab.plans.map((p) => (
                <li key={p.brand.id} className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2.5 font-bold">
                      <span className="grid place-items-center size-8 rounded-lg" style={{ background: p.brand.bg, boxShadow: "0 0 0 1px #17191714" }}>
                        <BrandMark brand={p.brand} size={17} />
                      </span>
                      {p.brand.name} <span className="num">${p.amount}</span>
                      <span className="text-mute font-semibold text-[13px]">{p.monthly ? `every ${PLAN_PERIOD_DAYS} days` : "once"}</span>
                    </p>
                    <button className="btn btn-line btn-sm" disabled={busy !== null} onClick={() => run("cancel", () => tabActions.cancelPlan(me, p))}>
                      Remove
                    </button>
                  </div>
                  <div className="mt-3">
                    {p.waiting ? (
                      <p className="text-mute text-[13px]">Next one {until(p.nextDue)}</p>
                    ) : (
                      <Progress have={spendable} need={priceWithFee(p.amount)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-7">
          <h2 className="text-[24px]">Delivery</h2>
          <p className="text-mute text-[14.5px] mt-2">
            Every card&apos;s code shows up under My cards, readable only by your wallet. Add an e-mail to receive it in your inbox too.
          </p>
          <form
            className="flex flex-wrap gap-2 mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run("email", async () => {
                await saveDeliveryEmail(me, emailValue.trim());
                return emailValue.trim() ? "Saved. New cards are also sent to this address." : "Removed. Cards only show up here.";
              });
            }}
          >
            <label className="flex-1 min-w-[220px]">
              <span className="sr-only">E-mail for your cards</span>
              <input className="field" type="email" value={emailValue} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </label>
            <button className="btn btn-line" disabled={busy !== null}>
              {busy === "email" ? "Saving…" : "Save"}
            </button>
          </form>
          <p className="hint">Saved by a transaction from your wallet, stored encrypted in your own balance contract.</p>
        </section>
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
        <section className="panel p-7">
          <h2 className="text-[24px]">Choose a card</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mt-6">
            {CATALOG.map((b) => (
              <li key={b.id}>
                <button onClick={() => pick(b)} aria-pressed={picked?.id === b.id} className={`block w-full text-left rounded-[18px] p-1 lift ${picked?.id === b.id ? "ring-2 ring-ink" : ""}`}>
                  <GiftCard brand={b} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-7 lg:sticky lg:top-24">
          {!picked ? (
            <p className="text-mute">Pick a card to see its price.</p>
          ) : (
            <>
              <GiftCard brand={picked} amount={amount} note={picked.covers} className="max-w-[300px]" />
              <p className="label mt-6">Card value</p>
              <div className="flex flex-wrap gap-2">
                {picked.amounts.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    aria-pressed={a === amount}
                    className={`num min-h-11 px-4 rounded-xl text-[14.5px] font-bold border transition-colors ${a === amount ? "bg-ink text-card border-ink" : "bg-card border-line hover:border-ink"}`}
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <dl className="mt-6 grid gap-2 text-[14.5px]">
                <div className="flex justify-between">
                  <dt className="text-mute">Card</dt>
                  <dd className="num">{usd(amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-mute">Service fee ({SERVICE_FEE_BPS / 100}%)</dt>
                  <dd className="num">{usd(price - amount)}</dd>
                </div>
                <div className="flex justify-between font-bold text-[16px] pt-2 border-t border-line">
                  <dt>Taken from your balance</dt>
                  <dd className="num">{usd(price)}</dd>
                </div>
              </dl>
              {short_ && (
                <p className="text-[14px] font-semibold mt-4">
                  Your balance is {usd(price - spendable)} short. Put it on auto-buy and it is bought when the fees get there.
                </p>
              )}
              <div className="grid gap-2 mt-6">
                <button className="btn btn-primary" disabled={busy !== null || !!short_} onClick={() => run("buy", () => tabActions.buy(me, picked, amount))}>
                  {busy === "buy" ? "Buying…" : "Buy now"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn btn-line !px-3" disabled={busy !== null} onClick={() => run("monthly", () => tabActions.autoPay(me, { brand: picked, amount, monthly: true }))}>
                    {busy === "monthly" ? "Saving…" : "Auto-buy monthly"}
                  </button>
                  <button className="btn btn-line !px-3" disabled={busy !== null} onClick={() => run("once", () => tabActions.autoPay(me, { brand: picked, amount, monthly: false }))}>
                    {busy === "once" ? "Saving…" : "Auto-buy once"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {note && (
        <p role="status" className={`panel px-6 py-4 text-[15px] font-semibold ${note.bad ? "text-red" : "note-ok"}`}>
          {note.text}
        </p>
      )}

      <section className="panel p-7">
        <h2 className="text-[24px]">My cards</h2>
        {tab.orders.length === 0 ? (
          <p className="text-mute mt-3">No card yet. Your first one appears here with its code, the moment it is delivered.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {tab.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
                <div className="flex items-center gap-3 min-w-[200px]">
                  <span className="grid place-items-center size-10 rounded-[10px]" style={{ background: o.brand.bg, boxShadow: "0 0 0 1px #17191714" }}>
                    <BrandMark brand={o.brand} size={20} />
                  </span>
                  <div>
                    <p className="font-bold">
                      {o.brand.name} <span className="num">${o.amount}</span>
                      {o.auto && <span className="text-mute font-semibold text-[13px]"> · auto-pay</span>}
                    </p>
                    <p className="text-mute text-[13px]">
                      {ago(o.createdAt)} · {usd(o.paidUsd)}
                    </p>
                  </div>
                </div>
                <span className={`tag ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                <div className="ml-auto">
                  {o.status === "delivered" &&
                    (codes[o.id] ? (
                      <span className="num text-[16px] font-bold select-all">
                        {codes[o.id].code}
                        {codes[o.id].pin && ` · PIN ${codes[o.id].pin}`}
                      </span>
                    ) : (
                      <button className="btn btn-ink btn-sm" disabled={busy !== null} onClick={() => run("reveal", async () => setCodes({ ...codes, [o.id]: await tabActions.reveal(me, o.id) }))}>
                        Show code
                      </button>
                    ))}
                  {o.status === "open" &&
                    (o.refundable ? (
                      <button className="btn btn-line btn-sm" disabled={busy !== null} onClick={() => run("refund", () => tabActions.refund(me, o.id))}>
                        Refund
                      </button>
                    ) : (
                      <span className="text-mute text-[13px]">Refundable {until(o.refundableAt)}</span>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-7">
        <h2 className="text-[24px]">My coins</h2>
        {tab.coins.length === 0 ? (
          <p className="text-mute mt-3">
            Coins you launch from this browser show up here.{" "}
            <Link href="/launch" className="underline text-ink font-semibold">
              Launch a coin
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {tab.coins.map((c) => (
              <li key={c.token} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-bold">
                    {c.name} <span className="text-mute font-semibold">${c.symbol}</span>
                  </p>
                  <p className="text-mute text-[13px]">
                    <span className="num text-ink">{usd(c.accruingUsd ?? 0)}</span> of fees on the curve, not swept by pons yet
                  </p>
                </div>
                <Link href={`/c/${c.token}`} className="btn btn-line btn-sm">
                  Public page
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
