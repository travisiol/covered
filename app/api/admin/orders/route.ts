import { isAddress } from "viem";
import { tabAbi } from "@/lib/covered";
import { isAdmin, openOrders } from "@/lib/server/admin";
import { settle } from "@/lib/server/deliver";
import { chain, fulfillerAccount, fulfillerWallet } from "@/lib/server/fulfiller";
import { supplier } from "@/lib/server/provider";

export const maxDuration = 60;

/** GET -> every order waiting for its card, plus the state of the operator wallet. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return Response.json({ error: "Wrong admin secret." }, { status: 401 });
  const account = fulfillerAccount();
  const gas = account ? await chain.getBalance({ address: account.address }) : 0n;
  return Response.json({ orders: await openOrders(), supplier: supplier(), operator: account?.address ?? null, operatorWei: gas.toString() });
}

/**
 * POST { tab, id, code, pin? }      -> deliver: stores the code encrypted in the order and releases its payment.
 * POST { tab, id, refund: true }    -> refund: unlocks the order's price back to the creator.
 */
export async function POST(req: Request) {
  if (!isAdmin(req)) return Response.json({ error: "Wrong admin secret." }, { status: 401 });
  const { tab, id, code, pin, refund } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof tab !== "string" || !isAddress(tab) || !Number.isInteger(id)) return Response.json({ error: "Unknown order." }, { status: 400 });
  const wallet = fulfillerWallet();
  if (!wallet) return Response.json({ error: "FULFILLER_PRIVATE_KEY is not set." }, { status: 503 });
  try {
    if (refund === true) {
      const hash = await wallet.writeContract({ address: tab, abi: tabAbi, functionName: "refund", args: [BigInt(id as number)] });
      await chain.waitForTransactionReceipt({ hash });
      return Response.json({ ok: true });
    }
    if (typeof code !== "string" || code.trim().length < 4 || code.length > 120) return Response.json({ error: "Enter the card's code." }, { status: 400 });
    await settle(tab, id as number, { code: code.trim(), pin: typeof pin === "string" && pin.trim() ? pin.trim() : undefined });
    return Response.json({ ok: true });
  } catch (e) {
    const message = (e as { shortMessage?: string; message: string }).shortMessage ?? (e as Error).message;
    return Response.json({ error: /insufficient funds|gas/i.test(message) ? "The operator wallet has no ETH for gas. Fund it, then try again." : message }, { status: 500 });
  }
}
