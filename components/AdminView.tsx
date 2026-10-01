"use client";

import { useCallback, useState } from "react";
import { REFUND_DELAY_HOURS } from "@/lib/config";
import { ago, eth, usd } from "@/lib/format";
import type { OpenOrder } from "@/lib/server/admin";

type Data = { orders: OpenOrder[]; supplier: string; operator: string | null; operatorWei: string };
const KEY = "covered:admin";

/** The operator's desk: orders waiting for a card, delivered here by hand. */
export function AdminView() {
  const [secret, setSecret] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [codes, setCodes] = useState<Record<string, { code: string; pin: string }>>({});

  const call = useCallback(async (token: string, body?: unknown) => {
    const r = await fetch("/api/admin/orders", {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Request failed.");
    return j;
  }, []);

  const load = useCallback(
    async (token: string) => {
      setBusy("load");
      setMessage(null);
      try {
        setData(await call(token));
        sessionStorage.setItem(KEY, token);
      } catch (e) {
        setData(null);
        setMessage({ text: (e as Error).message, bad: true });
      } finally {
        setBusy(null);
      }
    },
    [call],
  );

  const act = async (o: OpenOrder, body: Record<string, unknown>, done: string) => {
    const k = `${o.tab}:${o.id}`;
    setBusy(k);
    setMessage(null);
    try {
      await call(secret, { tab: o.tab, id: o.id, ...body });
      setMessage({ text: done });
      setData(await call(secret));
    } catch (e) {
      setMessage({ text: (e as Error).message, bad: true });
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <form
        className="panel p-7 md:p-9 max-w-[480px] grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void load(secret);
        }}
      >
        <label>
          <span className="label">Admin secret</span>
          <input className="field" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="current-password" />
          <span className="hint block">The ADMIN_SECRET value of this server.</span>
        </label>
        {message && (
          <p role="alert" className="text-red font-semibold text-[14.5px]">
            {message.text}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy !== null || !secret}>
            {busy ? "Opening…" : "Open"}
          </button>
          <button
            type="button"
            className="btn btn-line"
            onClick={() => {
              const saved = sessionStorage.getItem(KEY) ?? "";
              setSecret(saved);
              if (saved) void load(saved);
            }}
          >
            Use this session&apos;s secret
          </button>
        </div>
      </form>
    );
  }

  const gas = BigInt(data.operatorWei);

  return (
    <div className="grid gap-5">
      <section className="panel p-7 grid sm:grid-cols-3 gap-4 text-[14.5px]">
        <div>
          <p className="text-mute text-[13px]">Cards are delivered</p>
          <p className="font-bold mt-1">{data.supplier === "manual" ? "By hand, from this page" : data.supplier === "reloadly" ? "By Reloadly, where it sells the brand" : "By the local stand-in"}</p>
        </div>
        <div className="min-w-0">
          <p className="text-mute text-[13px]">Operator wallet</p>
          <p className="num font-bold mt-1 break-all select-all">{data.operator ?? "FULFILLER_PRIVATE_KEY is not set"}</p>
        </div>
        <div>
          <p className="text-mute text-[13px]">Its gas</p>
          <p className={`num font-bold mt-1 ${gas === 0n ? "text-red" : ""}`}>{eth(gas)} ETH</p>
          {gas === 0n && <p className="text-red text-[13px] font-semibold">Send it some ETH on Robinhood Chain: it pays the gas of every delivery.</p>}
        </div>
      </section>

      {message && (
        <p role="status" className={`panel px-6 py-4 font-semibold ${message.bad ? "text-red" : "note-ok"}`}>
          {message.text}
        </p>
      )}

      <section className="panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[24px]">Orders waiting for a card</h2>
          <button className="btn btn-line btn-sm" disabled={busy !== null} onClick={() => load(secret)}>
            {busy === "load" ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {data.orders.length === 0 ? (
          <p className="text-mute mt-4">Nothing is waiting.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {data.orders.map((o) => {
              const k = `${o.tab}:${o.id}`;
              const v = codes[k] ?? { code: "", pin: "" };
              return (
                <li key={k} className="py-5 grid lg:grid-cols-[1fr_1.4fr] gap-4 items-start">
                  <div className="min-w-0">
                    <p className="font-bold text-[17px]">
                      {o.brand} <span className="num">${o.amount}</span>
                      {o.auto && <span className="text-mute font-semibold text-[13px]"> · auto-pay</span>}
                    </p>
                    <p className="text-mute text-[13.5px] mt-1">
                      {ago(o.createdAt)} · {usd(o.paidUsd)} locked · order {o.id}
                    </p>
                    <p className="num text-mute text-[13px] break-all mt-1">for {o.creator}</p>
                    {o.email && <p className="text-[13.5px] mt-1">Also wants it at {o.email}</p>}
                  </div>
                  <form
                    className="grid sm:grid-cols-[1.6fr_1fr_auto_auto] gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(o, { code: v.code, pin: v.pin }, `${o.brand} $${o.amount} delivered. The creator can read its code now.`);
                    }}
                  >
                    <label>
                      <span className="sr-only">Card code</span>
                      <input className="field num" placeholder="Card code" value={v.code} onChange={(e) => setCodes({ ...codes, [k]: { ...v, code: e.target.value } })} />
                    </label>
                    <label>
                      <span className="sr-only">PIN</span>
                      <input className="field num" placeholder="PIN, if any" value={v.pin} onChange={(e) => setCodes({ ...codes, [k]: { ...v, pin: e.target.value } })} />
                    </label>
                    <button className="btn btn-primary" disabled={busy !== null || v.code.trim().length < 4}>
                      {busy === k ? "Sending…" : "Deliver"}
                    </button>
                    <button type="button" className="btn btn-line" disabled={busy !== null} onClick={() => act(o, { refund: true }, `${o.brand} $${o.amount} refunded to the creator's balance.`)}>
                      Refund
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hint mt-4">
          Delivering stores the code encrypted in the order and pays its locked price to the treasury. An order nobody delivers can be refunded by
          its creator after {REFUND_DELAY_HOURS} hours.
        </p>
      </section>
    </div>
  );
}
