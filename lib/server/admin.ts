import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { parseSku } from "../catalog";
import { ROUTER_ADDRESS } from "../config";
import { routerAbi, tabAbi } from "../covered";
import { weiToUsd } from "../format";
import { chain, ethUsd } from "./fulfiller";
import { unseal } from "./seal";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** The operator signs in to /admin with ADMIN_SECRET, sent as a bearer token. */
export function isAdmin(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return Boolean(secret) && timingSafeEqual(digest(given), digest(secret!));
}

export type OpenOrder = {
  tab: string;
  creator: string;
  id: number;
  brand: string;
  brandId: string;
  amount: number;
  paidUsd: number;
  createdAt: number;
  auto: boolean;
  email: string | null;
};

/** Every order still waiting for its card, oldest first. */
export async function openOrders(): Promise<OpenOrder[]> {
  if (!ROUTER_ADDRESS) return [];
  const code = await chain.getCode({ address: ROUTER_ADDRESS });
  if (!code) return [];
  const price = await ethUsd().catch(() => 0);
  const count = Number(await chain.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "creatorCount" }));
  const out: OpenOrder[] = [];
  for (let i = 0; i < count; i++) {
    const creator = await chain.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "creators", args: [BigInt(i)] });
    const tab = await chain.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "predictTab", args: [creator] });
    const [locked, sealedContact] = await Promise.all([
      chain.readContract({ address: tab, abi: tabAbi, functionName: "locked" }),
      chain.readContract({ address: tab, abi: tabAbi, functionName: "contact" }),
    ]);
    if (locked === 0n) continue; // no open order on this tab
    const orders = await chain.readContract({ address: tab, abi: tabAbi, functionName: "allOrders" });
    orders.forEach((o, id) => {
      const item = parseSku(o.sku);
      if (o.status !== 1 || !item) return;
      out.push({
        tab,
        creator,
        id,
        brand: item.brand.name,
        brandId: item.brand.id,
        amount: item.amount,
        paidUsd: weiToUsd(o.weiAmount, price),
        createdAt: Number(o.createdAt),
        auto: o.recurring,
        email: sealedContact === "0x" ? null : unseal<string>(sealedContact),
      });
    });
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}
