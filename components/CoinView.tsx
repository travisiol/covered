"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAddress, parseAbi, type Address } from "viem";
import { PLAN_PERIOD_DAYS, ROUTER_ADDRESS, explorerAddress } from "@/lib/config";
import { routerAbi } from "@/lib/covered";
import { ago, priceWithFee, usd } from "@/lib/format";
import { curveAbi } from "@/lib/pons";
import { fetchEthUsd, readTab } from "@/lib/tab";
import { publicClient, short } from "@/lib/wallet";
import { Progress } from "./BalanceView";
import { BrandMark } from "./GiftCard";

const tokenAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function logo() view returns (string)",
  "function curve() view returns (address)",
  "function deployer() view returns (address)",
]);

type Loaded = Awaited<ReturnType<typeof readTab>> & { name: string; symbol: string; logo: string; creator: Address };
type State = { status: "loading" } | { status: "missing"; why: string } | { status: "ok"; coin: Loaded };

const image = (logo: string) => (logo.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${logo.slice(7)}` : logo);

async function loadCoin(token: string): Promise<State> {
  if (!isAddress(token)) return { status: "missing", why: "That is not a coin address." };
  if (!ROUTER_ADDRESS) return { status: "missing", why: "This coin does not send its fees to Covered." };
  const t = { address: token, abi: tokenAbi } as const;
  try {
    const [name, symbol, logo, curve, creator] = await Promise.all([
      publicClient.readContract({ ...t, functionName: "name" }),
      publicClient.readContract({ ...t, functionName: "symbol" }),
      publicClient.readContract({ ...t, functionName: "logo" }).catch(() => ""),
      publicClient.readContract({ ...t, functionName: "curve" }),
      publicClient.readContract({ ...t, functionName: "deployer" }),
    ]);
    const [recipient, tab, open, ethUsd] = await Promise.all([
      publicClient.readContract({ address: curve, abi: curveAbi, functionName: "deployer" }),
      publicClient.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "predictTab", args: [creator] }),
      publicClient.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "isOpen", args: [creator] }),
      fetchEthUsd(),
    ]);
    // The proof: the coin's fee recipient on pons is its launcher's Covered balance.
    if (recipient.toLowerCase() !== tab.toLowerCase()) return { status: "missing", why: "This coin does not send its fees to Covered." };
    return { status: "ok", coin: { ...(await readTab(tab, open, ethUsd)), name, symbol, logo, creator } };
  } catch {
    return { status: "missing", why: "No pons coin was found at this address." };
  }
}

/** What a coin pays for, readable by anyone: the page a creator shares. */
export function CoinView({ token }: { token: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    loadCoin(token).then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [token]);

  if (state.status === "loading") return <p className="panel p-10 text-mute text-center">Loading this coin…</p>;
  if (state.status === "missing") {
    return (
      <div className="panel p-10 text-center max-w-[560px] mx-auto">
        <h1 className="text-[28px]">Nothing to show here</h1>
        <p className="text-mute mt-3">{state.why}</p>
        <Link href="/launch" className="btn btn-primary mt-7">
          Launch a coin
        </Link>
      </div>
    );
  }

  const c = state.coin;
  const spendable = c.availableUsd + c.pendingUsd;
  const delivered = c.orders.filter((o) => o.status === "delivered");
  const share = `$${c.symbol} pays for my ${c.plans.map((p) => p.brand.name).join(", ") || "gift cards"}. Every trade helps.`;

  return (
    <div className="grid gap-5 max-w-[820px] mx-auto">
      <section className="panel p-7 md:p-9">
        <div className="flex flex-wrap items-center gap-5">
          {c.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image(c.logo)} alt="" className="size-20 rounded-[18px] object-cover border border-line" />
          ) : (
            <span className="grid place-items-center size-20 rounded-[18px] bg-accent-soft text-[26px] font-extrabold">{c.symbol.slice(0, 2)}</span>
          )}
          <div className="min-w-0">
            <h1 className="text-[34px] md:text-[44px] break-words">
              {c.name} <span className="text-mute">${c.symbol}</span>
            </h1>
            <p className="text-mute mt-2">
              Its creator fees go to{" "}
              <a className="underline" href={explorerAddress(c.tab)} target="_blank" rel="noreferrer">
                {short(c.creator)}&apos;s Covered balance
              </a>
              , which buys gift cards by itself.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-7">
          <a className="btn btn-primary" href={explorerAddress(token)} target="_blank" rel="noreferrer">
            View the coin
          </a>
          <a className="btn btn-line" href={`https://x.com/intent/post?text=${encodeURIComponent(share)}&url=${encodeURIComponent(typeof window === "undefined" ? "" : window.location.href)}`} target="_blank" rel="noreferrer">
            Post on X
          </a>
          <button
            className="btn btn-line"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            }}
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      </section>

      <section className="panel p-7 md:p-9">
        <h2 className="text-[24px]">What this coin pays for</h2>
        {c.plans.length === 0 ? (
          <p className="text-mute mt-3">Its creator has not picked a card yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {c.plans.map((p) => (
              <li key={p.brand.id} className="py-5 grid sm:grid-cols-[1fr_1fr] gap-4 items-center">
                <p className="flex items-center gap-3 font-bold text-[17px]">
                  <span className="grid place-items-center size-10 rounded-[10px]" style={{ background: p.brand.bg, boxShadow: "0 0 0 1px #17191714" }}>
                    <BrandMark brand={p.brand} size={20} />
                  </span>
                  {p.brand.name} <span className="num">${p.amount}</span>
                  <span className="text-mute font-semibold text-[13px]">{p.monthly ? `every ${PLAN_PERIOD_DAYS} days` : "once"}</span>
                </p>
                {p.waiting ? <p className="text-mute text-[14px]">Paid for this period.</p> : <Progress have={spendable} need={priceWithFee(p.amount)} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-7 md:p-9">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[24px]">Cards paid so far</h2>
          <p className="text-mute text-[14.5px]">
            <span className="num text-ink font-bold">{usd(c.earnedUsd)}</span> collected from fees
          </p>
        </div>
        {delivered.length === 0 ? (
          <p className="text-mute mt-3">None yet. The first one shows up here when the fees reach its price.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {delivered.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 py-4">
                <p className="flex items-center gap-3 font-bold">
                  <span className="grid place-items-center size-9 rounded-[10px]" style={{ background: o.brand.bg, boxShadow: "0 0 0 1px #17191714" }}>
                    <BrandMark brand={o.brand} size={18} />
                  </span>
                  {o.brand.name} <span className="num">${o.amount}</span>
                </p>
                <span className="text-mute text-[14px]">{ago(o.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
