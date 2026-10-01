import "server-only";
import type { Address } from "viem";
import { parseSku } from "../catalog";
import { REFUND_DELAY_HOURS } from "../config";
import { tabAbi } from "../covered";
import { chain, fulfillerWallet } from "./fulfiller";
import { automatic, buyCard } from "./provider";
import { seal, unseal, type Card } from "./seal";

const busy = new Set<string>();
// A card bought whose `fulfill` did not land: kept for the retry, so it is never bought twice.
const bought = new Map<string, Card>();

export type Delivery =
  | { ok: true; status: "delivered" | "already" | "queued"; note: string }
  | { ok: false; status: "not-configured" | "busy" | "not-open" | "unknown-sku" | "refunded"; reason: string };

/** Write a delivered card's code, encrypted, into its order and release the payment. */
export async function settle(tab: Address, id: number, card: Card) {
  const wallet = fulfillerWallet();
  if (!wallet) throw new Error("The fulfiller key is not set.");
  const hash = await wallet.writeContract({ address: tab, abi: tabAbi, functionName: "fulfill", args: [BigInt(id), seal(card)] });
  const receipt = await chain.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The delivery transaction failed.");
}

/**
 * Deliver the card of an open on-chain order. Bought from the supplier when
 * there is one for that brand; otherwise the order waits for the operator, who
 * delivers it from /admin. If the supplier refuses, the order is refunded.
 */
export async function deliver(tab: Address, id: number): Promise<Delivery> {
  const wallet = fulfillerWallet();
  if (!wallet) return { ok: false, status: "not-configured", reason: "Card delivery is not set up on this server." };
  const lock = `${tab.toLowerCase()}:${id}`;
  if (busy.has(lock)) return { ok: false, status: "busy", reason: "This order is being delivered." };
  busy.add(lock);
  try {
    const order = await chain.readContract({ address: tab, abi: tabAbi, functionName: "orders", args: [BigInt(id)] });
    if (order.status === 2) return { ok: true, status: "already", note: "Card delivered. Open it under My cards to see its code." };
    if (order.status !== 1) return { ok: false, status: "not-open", reason: "This order is not open." };
    const item = parseSku(order.sku);
    if (!item || order.usdCents !== item.amount * 100) {
      return { ok: false, status: "unknown-sku", reason: "This order is for a card we do not sell." };
    }
    if (!automatic(item.brand.id)) {
      return {
        ok: true,
        status: "queued",
        note: `Order placed. Your card appears under My cards as soon as it is delivered. Its price stays locked in your balance until then, and you can refund it after ${REFUND_DELAY_HOURS} hours.`,
      };
    }
    let card = bought.get(lock);
    if (!card) {
      try {
        const sealedContact = await chain.readContract({ address: tab, abi: tabAbi, functionName: "contact" });
        card = await buyCard(item.brand.id, item.amount, lock, sealedContact === "0x" ? null : unseal<string>(sealedContact));
        bought.set(lock, card);
      } catch (e) {
        const hash = await wallet.writeContract({ address: tab, abi: tabAbi, functionName: "refund", args: [BigInt(id)] });
        await chain.waitForTransactionReceipt({ hash });
        return { ok: false, status: "refunded", reason: `${(e as Error).message} The order was refunded to your balance.` };
      }
    }
    await settle(tab, id, card);
    bought.delete(lock);
    return { ok: true, status: "delivered", note: "Card delivered. Open it under My cards to see its code." };
  } finally {
    busy.delete(lock);
  }
}
