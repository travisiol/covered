import { decodeEventLog } from "viem";
import { parseSku } from "@/lib/catalog";
import { ROUTER_ADDRESS } from "@/lib/config";
import { routerAbi, tabAbi } from "@/lib/covered";
import { deliver } from "@/lib/server/deliver";
import { chain, ethUsd, fulfillerWallet, weiFor } from "@/lib/server/fulfiller";

export const maxDuration = 300;

/**
 * Charges every plan that is due and can be paid, then delivers its card.
 * Run it on a schedule with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const wallet = fulfillerWallet();
  if (!ROUTER_ADDRESS || !wallet) return Response.json({ error: "Not configured." }, { status: 503 });
  if (!(await chain.getCode({ address: ROUTER_ADDRESS }))) return Response.json({ checked: 0, report: [] });

  const price = await ethUsd();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const count = Number(await chain.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "creatorCount" }));
  const report: { tab: string; sku: string; result: string }[] = [];

  for (let i = 0; i < count; i++) {
    const creator = await chain.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "creators", args: [BigInt(i)] });
    const tab = await chain.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "predictTab", args: [creator] });
    const skus = await chain.readContract({ address: tab, abi: tabAbi, functionName: "planSkus" });
    if (!skus.length) continue;
    let [available, pending] = await Promise.all([
      chain.readContract({ address: tab, abi: tabAbi, functionName: "available" }),
      chain.readContract({ address: tab, abi: tabAbi, functionName: "pendingInEscrow" }),
    ]);
    for (const sku of skus) {
      const [usdCents, , nextDue, active, maxWei] = await chain.readContract({ address: tab, abi: tabAbi, functionName: "plans", args: [sku] });
      const item = parseSku(sku);
      if (!active || nextDue > now || !item || usdCents !== item.amount * 100) continue;
      const name = `${item.brand.id}-${item.amount}`;
      const wei = weiFor(usdCents, price);
      if (wei > maxWei) {
        report.push({ tab, sku: name, result: "skipped: above the plan's cap" });
        continue;
      }
      // Not enough yet: the plan simply waits for more fees, nothing is lost.
      if (wei > available + pending) continue;
      try {
        const hash = await wallet.writeContract({ address: tab, abi: tabAbi, functionName: "charge", args: [sku, wei] });
        const receipt = await chain.waitForTransactionReceipt({ hash });
        let id: bigint | null = null;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== tab.toLowerCase()) continue;
          try {
            id = decodeEventLog({ abi: tabAbi, eventName: "Ordered", data: log.data, topics: log.topics }).args.id;
          } catch {}
        }
        if (id === null) throw new Error("charge sent but no order was opened");
        const d = await deliver(tab, Number(id));
        report.push({ tab, sku: name, result: d.ok ? d.status : d.reason });
        available = available + pending - wei;
        pending = 0n;
      } catch (e) {
        report.push({ tab, sku: name, result: `failed: ${(e as Error).message.slice(0, 120)}` });
      }
    }
  }
  return Response.json({ checked: count, report });
}
