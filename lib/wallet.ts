"use client";

import { useSyncExternalStore } from "react";
import { createPublicClient, createWalletClient, custom, http, numberToHex, type Address, type EIP1193Provider } from "viem";
import { robinhood } from "./config";

export type Detected = { uuid: string; name: string; icon: string; rdns: string; provider: EIP1193Provider };

type State = {
  wallets: Detected[];
  address: Address | null;
  chainId: number | null;
  provider: EIP1193Provider | null;
  dialog: boolean;
};

const LAST = "covered:wallet";
let state: State = { wallets: [], address: null, chainId: null, provider: null, dialog: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

const SERVER: State = state;
let started = false;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("eip6963:announceProvider", (e) => {
    const { info, provider } = (e as CustomEvent).detail as { info: Omit<Detected, "provider">; provider: EIP1193Provider };
    if (state.wallets.some((w) => w.uuid === info.uuid)) return;
    const wallet = { ...info, provider };
    set({ wallets: [...state.wallets, wallet] });
    // Silent reconnect to the wallet used last time.
    if (!state.address && localStorage.getItem(LAST) === info.rdns) void attach(wallet, false);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

async function attach(wallet: Detected, prompt: boolean) {
  const p = wallet.provider;
  const accounts = (await p.request({ method: prompt ? "eth_requestAccounts" : "eth_accounts" })) as Address[];
  if (!accounts.length) return;
  const chainId = Number(await p.request({ method: "eth_chainId" }));
  const on = (p as unknown as { on?: (e: string, f: (v: never) => void) => void }).on?.bind(p);
  on?.("accountsChanged", (a: Address[]) => set({ address: a[0] ?? null }));
  on?.("chainChanged", (c: string) => set({ chainId: Number(c) }));
  localStorage.setItem(LAST, wallet.rdns);
  set({ address: accounts[0], chainId, provider: p, dialog: false });
}

export const wallet = {
  open: () => set({ dialog: true }),
  close: () => set({ dialog: false }),
  connect: (w: Detected) => attach(w, true),
  disconnect: () => {
    localStorage.removeItem(LAST);
    set({ address: null, provider: null, chainId: null });
  },
  /** Switch the wallet to Robinhood Chain, adding it if the wallet has never seen it. */
  async ensureChain() {
    const p = state.provider;
    if (!p) throw new Error("Connect a wallet first.");
    if (state.chainId === robinhood.id) return;
    const chainId = numberToHex(robinhood.id);
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e;
      await p.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: robinhood.name,
            nativeCurrency: robinhood.nativeCurrency,
            rpcUrls: [...robinhood.rpcUrls.default.http],
            blockExplorerUrls: [robinhood.blockExplorers.default.url],
          },
        ],
      });
    }
    set({ chainId: robinhood.id });
  },
  async client() {
    await wallet.ensureChain();
    return createWalletClient({ account: state.address!, chain: robinhood, transport: custom(state.provider!) });
  },
};

export function useWallet() {
  return useSyncExternalStore(
    (l) => {
      start();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}

// Reads go through our own /api/rpc: the public RPC sends doubled CORS headers
// on a 429, which a browser treats as a network failure.
export const publicClient = createPublicClient({
  chain: robinhood,
  transport: http(typeof window === "undefined" ? robinhood.rpcUrls.default.http[0] : "/api/rpc"),
  batch: { multicall: true },
});

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function errorText(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; code?: number };
  if (err.code === 4001 || /rejected|denied/i.test(err.message ?? "")) return "You rejected the request in your wallet.";
  return err.shortMessage ?? err.message ?? "Something went wrong.";
}
