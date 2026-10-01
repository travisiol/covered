import "server-only";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { QUOTE_TTL_SECONDS, ROUTER_ADDRESS, robinhood } from "../config";
import { weiFor } from "../format";
import { quoteDomain, quoteTypes, routerAbi } from "../covered";

const RPC = process.env.ROBINHOOD_RPC_URL ?? robinhood.rpcUrls.default.http[0];

export const chain = createPublicClient({ chain: robinhood, transport: http(RPC), batch: { multicall: true } });

/** The hot key that signs quotes and sends fulfill / refund / charge. */
export function fulfillerAccount() {
  const key = process.env.FULFILLER_PRIVATE_KEY?.trim();
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return privateKeyToAccount(key as Hex);
}

export function fulfillerWallet() {
  const account = fulfillerAccount();
  if (!account) return null;
  return createWalletClient({ account, chain: robinhood, transport: http(RPC) });
}

let cached: { usd: number; at: number } | null = null;

/** ETH/USD spot, from Coinbase then Kraken, cached for 30 seconds. */
export async function ethUsd(): Promise<number> {
  if (cached && Date.now() - cached.at < 30_000) return cached.usd;
  const sources: [string, (j: never) => unknown][] = [
    ["https://api.coinbase.com/v2/prices/ETH-USD/spot", (j: { data: { amount: string } }) => j.data.amount],
    ["https://api.kraken.com/0/public/Ticker?pair=ETHUSD", (j: { result: Record<string, { c: string[] }> }) => Object.values(j.result)[0].c[0]],
  ];
  for (const [url, pick] of sources) {
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const usd = Number(pick((await r.json()) as never));
      if (usd > 0) {
        cached = { usd, at: Date.now() };
        return usd;
      }
    } catch {}
  }
  if (cached) return cached.usd;
  throw new Error("No ETH price available right now.");
}

export { weiFor };

export async function signQuote(tab: Address, sku: Hex, usdCents: number) {
  const account = fulfillerAccount();
  if (!account) return null;
  const price = await ethUsd();
  const weiAmount = weiFor(usdCents, price);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + QUOTE_TTL_SECONDS);
  const nonce = BigInt("0x" + [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join(""));
  const signature = await account.signTypedData({
    domain: quoteDomain(tab, robinhood.id),
    types: quoteTypes,
    primaryType: "Quote",
    message: { tab, sku, usdCents, weiAmount, expiry, nonce },
  });
  return { tab, sku, usdCents, weiAmount: weiAmount.toString(), expiry: Number(expiry), nonce: nonce.toString(), signature, ethUsd: price };
}

/** A tab is only served if the router really deployed it. */
export async function isCoveredTab(tab: Address, creator: Address): Promise<boolean> {
  if (!ROUTER_ADDRESS) return false;
  // Fails when the router is not on chain yet: then no tab is ours.
  const predicted = await chain.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "predictTab", args: [creator] }).catch(() => null);
  return predicted !== null && predicted.toLowerCase() === tab.toLowerCase();
}
