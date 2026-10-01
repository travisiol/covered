"use client";

import { useEffect, useSyncExternalStore } from "react";
import { decodeEventLog, type Address, type Hex } from "viem";
import { parseSku, skuOf, type Brand } from "./catalog";
import { PLAN_MAX_WEI_MULTIPLE, PLAN_PERIOD_DAYS, PONS, REFUND_DELAY_HOURS, ROUTER, ROUTER_ADDRESS } from "./config";
import { ORDER_STATUS, revealMessage, routerAbi, tabAbi, type OrderStatus } from "./covered";
import { weiFor, weiToUsd } from "./format";
import { curveAbi, escrowAbi } from "./pons";
import { publicClient, wallet } from "./wallet";

export type OrderView = {
  id: number;
  brand: Brand;
  amount: number;
  paidUsd: number;
  status: OrderStatus;
  /** Bought by itself from the auto-pay list, not by a click. */
  auto: boolean;
  createdAt: number;
  refundableAt: number;
  /** True once the creator may refund an undelivered order himself. */
  refundable: boolean;
};
/** `waiting`: already bought for the current period; the next one is due at `nextDue`. */
export type PlanView = { brand: Brand; amount: number; monthly: boolean; nextDue: number; waiting: boolean };
export type Coin = { token: Address; curve: Address; name: string; symbol: string; at: number; accruingUsd?: number };
/** One line of the auto-pay list a creator picks. */
export type Pick = { brand: Brand; amount: number; monthly: boolean };

export type TabView = {
  ready: boolean;
  tab: Address | null;
  open: boolean;
  /** Spendable now, in the tab. */
  availableUsd: number;
  /** Swept by pons, waiting in its escrow; collected automatically on the next action. */
  pendingUsd: number;
  lockedUsd: number;
  earnedUsd: number;
  availableWei: bigint;
  pendingWei: bigint;
  ethUsd: number;
  orders: OrderView[];
  plans: PlanView[];
  coins: Coin[];
};

const EMPTY: TabView = {
  ready: false,
  tab: null,
  open: false,
  availableUsd: 0,
  pendingUsd: 0,
  lockedUsd: 0,
  earnedUsd: 0,
  availableWei: 0n,
  pendingWei: 0n,
  ethUsd: 0,
  orders: [],
  plans: [],
  coins: [],
};

let view: TabView = EMPTY;
const listeners = new Set<() => void>();
const publish = (next: TabView) => {
  view = next;
  listeners.forEach((l) => l());
};

const now = () => Math.floor(Date.now() / 1000);
const NOT_OPEN = "Covered is not open for launches yet.";

// ------------------------------------------------------------------ coins

const coinsKey = (creator: string) => `covered:coins:${creator.toLowerCase()}`;

export function rememberCoin(creator: Address, coin: Coin) {
  const list: Coin[] = JSON.parse(localStorage.getItem(coinsKey(creator)) ?? "[]");
  localStorage.setItem(coinsKey(creator), JSON.stringify([coin, ...list.filter((c) => c.token !== coin.token)]));
}

// ------------------------------------------------------------------- read

export const fetchEthUsd = () =>
  fetch("/api/price")
    .then((r) => r.json() as Promise<{ ethUsd?: number }>)
    .then((j) => j.ethUsd ?? 0)
    .catch(() => 0);

/** Everything about one tab, read from the chain. Used by the owner's page and by a coin's public page. */
export async function readTab(tab: Address, open: boolean, ethUsd: number) {
  let available = 0n;
  let locked = 0n;
  let pulled = 0n;
  let orders: OrderView[] = [];
  let plans: PlanView[] = [];
  const pending = await publicClient.readContract({ address: PONS.escrow, abi: escrowAbi, functionName: "balanceOf", args: [tab] });

  if (open) {
    const c = { address: tab, abi: tabAbi } as const;
    const [a, l, p, raw, skus] = await Promise.all([
      publicClient.readContract({ ...c, functionName: "available" }),
      publicClient.readContract({ ...c, functionName: "locked" }),
      publicClient.readContract({ ...c, functionName: "totalPulled" }),
      publicClient.readContract({ ...c, functionName: "allOrders" }),
      publicClient.readContract({ ...c, functionName: "planSkus" }),
    ]);
    available = a;
    locked = l;
    pulled = p;
    orders = raw
      .flatMap((o, id) => {
        const item = parseSku(o.sku);
        if (!item) return [];
        const createdAt = Number(o.createdAt);
        const refundableAt = createdAt + REFUND_DELAY_HOURS * 3600;
        return [
          {
            id,
            brand: item.brand,
            amount: item.amount,
            paidUsd: weiToUsd(o.weiAmount, ethUsd),
            status: ORDER_STATUS[o.status],
            auto: o.recurring,
            createdAt,
            refundableAt,
            refundable: now() >= refundableAt,
          },
        ];
      })
      .reverse();
    const rows = await Promise.all(skus.map((sku) => publicClient.readContract({ ...c, functionName: "plans", args: [sku] })));
    plans = skus.flatMap((sku, i) => {
      const item = parseSku(sku);
      const [, periodDays, nextDue, active] = rows[i];
      return item && active ? [{ brand: item.brand, amount: item.amount, monthly: periodDays > 0, nextDue: Number(nextDue), waiting: Number(nextDue) > now() }] : [];
    });
  }

  return {
    tab,
    open,
    ethUsd,
    availableWei: available,
    pendingWei: pending,
    availableUsd: weiToUsd(available, ethUsd),
    pendingUsd: weiToUsd(pending, ethUsd),
    lockedUsd: weiToUsd(locked, ethUsd),
    earnedUsd: weiToUsd(pulled + pending, ethUsd),
    orders,
    plans,
  };
}

async function load(creator: Address | null) {
  if (!creator || !ROUTER_ADDRESS) return publish({ ...EMPTY, ready: true });
  const [ethUsd, tab, open] = await Promise.all([
    fetchEthUsd(),
    publicClient.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "predictTab", args: [creator] }),
    publicClient.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "isOpen", args: [creator] }),
  ]);
  const state = await readTab(tab, open, ethUsd);
  const coins: Coin[] = JSON.parse(localStorage.getItem(coinsKey(creator)) ?? "[]");
  const accruing = await Promise.all(
    coins.map((coin) => publicClient.readContract({ address: coin.curve, abi: curveAbi, functionName: "quoteFeeBalance" }).catch(() => 0n)),
  );
  publish({
    ...state,
    ready: true,
    // The curve's fee balance still includes pons' own share.
    coins: coins.map((coin, i) => ({ ...coin, accruingUsd: weiToUsd(accruing[i], ethUsd) * PONS.creatorShareOfFee })),
  });
}

// ------------------------------------------------------------------ write

async function send(request: Parameters<Awaited<ReturnType<typeof wallet.client>>["writeContract"]>[0]) {
  const client = await wallet.client();
  const hash = await client.writeContract(request);
  return publicClient.waitForTransactionReceipt({ hash });
}

/**
 * The router is deployed by whoever needs it first: one transaction, once,
 * for everybody. Its address is already known, so nothing changes afterwards.
 */
export async function ensureRouter(onDeploy?: () => void) {
  if (!ROUTER_ADDRESS) throw new Error(NOT_OPEN);
  if (await publicClient.getCode({ address: ROUTER_ADDRESS })) return;
  if (!ROUTER || ROUTER.address !== ROUTER_ADDRESS) throw new Error(NOT_OPEN);
  const client = await wallet.client();
  onDeploy?.();
  const hash = await client.sendTransaction({ account: client.account, chain: client.chain, to: ROUTER.to, data: ROUTER.data });
  await publicClient.waitForTransactionReceipt({ hash });
  if (!(await publicClient.getCode({ address: ROUTER_ADDRESS }))) throw new Error("The set-up transaction went through but the contract is not there.");
}

/** Deploys the tab if needed and collects the escrow, in one transaction. */
async function collect(creator: Address) {
  await ensureRouter();
  const client = await wallet.client();
  await send({ account: client.account, chain: client.chain, address: ROUTER_ADDRESS!, abi: routerAbi, functionName: "pullMany", args: [[creator]] });
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? j.reason ?? "Request failed.");
  return j as T;
}

type Quote = { sku: Hex; usdCents: number; weiAmount: string; expiry: number; nonce: string; signature: Hex };

/**
 * Turn the auto-pay list on: opens the tab if needed and saves every pick in
 * one transaction. Each pick is capped at twice today's price per charge.
 */
export async function setupAutoPay(picks: Pick[], email = "") {
  await ensureRouter();
  if (!ROUTER_ADDRESS) throw new Error(NOT_OPEN);
  const sealed = email ? (await api<{ sealed: Hex }>("/api/seal", { email })).sealed : "0x";
  const ethUsd = view.ethUsd || (await fetchEthUsd());
  if (!ethUsd) throw new Error("No ETH price available right now. Try again in a minute.");
  const client = await wallet.client();
  await send({
    account: client.account,
    chain: client.chain,
    address: ROUTER_ADDRESS,
    abi: routerAbi,
    functionName: "setup",
    args: [
      picks.map((p) => skuOf(p.brand.id, p.amount)),
      picks.map((p) => p.amount * 100),
      picks.map((p) => (p.monthly ? PLAN_PERIOD_DAYS : 0)),
      picks.map((p) => weiFor(p.amount * 100, ethUsd) * BigInt(PLAN_MAX_WEI_MULTIPLE)),
      sealed,
    ],
  });
  if (email) localStorage.setItem(`covered:email:${client.account.address.toLowerCase()}`, email);
}

/**
 * Choose the inbox the cards are also sent to. The address is encrypted by the
 * server, then written by the creator's own wallet into their balance contract.
 */
export async function saveDeliveryEmail(creator: Address, email: string) {
  await ensureRouter();
  if (!ROUTER_ADDRESS) throw new Error(NOT_OPEN);
  const sealed = email ? (await api<{ sealed: Hex }>("/api/seal", { email })).sealed : "0x";
  const client = await wallet.client();
  const base = { account: client.account, chain: client.chain } as const;
  if (view.open && view.tab) await send({ ...base, address: view.tab, abi: tabAbi, functionName: "setContact", args: [sealed] });
  else if (email) await send({ ...base, address: ROUTER_ADDRESS, abi: routerAbi, functionName: "setup", args: [[], [], [], [], sealed] });
  localStorage.setItem(`covered:email:${creator.toLowerCase()}`, email);
  await load(creator);
}

export const savedEmail = (creator: Address) => localStorage.getItem(`covered:email:${creator.toLowerCase()}`) ?? "";

export const tabActions = {
  refresh: load,

  /** Buy one card now. Resolves with a note to show the user. */
  async buy(creator: Address, brand: Brand, amount: number): Promise<string> {
    if (!ROUTER_ADDRESS || !view.tab) throw new Error("Your balance is empty: launch a coin first.");
    const tab = view.tab;
    const quote = await api<Quote>("/api/quote", { tab, creator, brand: brand.id, amount });
    const wei = BigInt(quote.weiAmount);
    if (wei > view.availableWei + view.pendingWei) throw new Error("Your balance does not cover this card yet.");
    if (!view.open || wei > view.availableWei) await collect(creator);
    const client = await wallet.client();
    const receipt = await send({
      account: client.account,
      chain: client.chain,
      address: tab,
      abi: tabAbi,
      functionName: "redeem",
      args: [quote.sku, quote.usdCents, wei, BigInt(quote.expiry), BigInt(quote.nonce), quote.signature],
    });
    let id = -1;
    for (const log of receipt.logs) {
      try {
        id = Number(decodeEventLog({ abi: tabAbi, eventName: "Ordered", data: log.data, topics: log.topics }).args.id);
      } catch {}
    }
    const note = await api<{ note: string }>("/api/fulfill", { tab, id })
      .then((r) => r.note)
      .catch((e: Error) => e.message);
    await load(creator);
    return note;
  },

  /** Add a card to the auto-pay list: bought by itself once the balance covers it. */
  async autoPay(creator: Address, pick: Pick): Promise<string> {
    await setupAutoPay([pick]);
    await load(creator);
    return pick.monthly
      ? "Added. It is bought every 30 days, as soon as your balance covers it."
      : "Added. It is bought once, as soon as your balance covers it.";
  },

  async cancelPlan(creator: Address, plan: PlanView) {
    const client = await wallet.client();
    await send({ account: client.account, chain: client.chain, address: view.tab!, abi: tabAbi, functionName: "cancelPlan", args: [skuOf(plan.brand.id, plan.amount)] });
    await load(creator);
  },

  async refund(creator: Address, id: number) {
    const client = await wallet.client();
    await send({ account: client.account, chain: client.chain, address: view.tab!, abi: tabAbi, functionName: "refund", args: [BigInt(id)] });
    await load(creator);
  },

  /** Everything spendable, to the creator's own wallet. */
  async withdrawAll(creator: Address) {
    if (!ROUTER_ADDRESS) throw new Error(NOT_OPEN);
    if (!view.open || view.pendingWei > 0n) await collect(creator);
    const client = await wallet.client();
    const amount = await publicClient.readContract({ address: view.tab!, abi: tabAbi, functionName: "available" });
    await send({ account: client.account, chain: client.chain, address: view.tab!, abi: tabAbi, functionName: "withdraw", args: [creator, amount] });
    await load(creator);
  },

  /** The code of a delivered card: proven by a wallet signature, never stored in the browser. */
  async reveal(creator: Address, id: number): Promise<{ code: string; pin: string | null }> {
    const client = await wallet.client();
    const issuedAt = Date.now();
    const signature = await client.signMessage({ account: creator, message: revealMessage(view.tab!, id, issuedAt) });
    return api("/api/reveal", { tab: view.tab, id, issuedAt, signature });
  },
};

export function useTab(creator: Address | null): TabView {
  useEffect(() => {
    load(creator).catch(() => publish({ ...EMPTY, ready: true }));
  }, [creator]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => view,
    () => EMPTY,
  );
}
