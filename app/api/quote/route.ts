import { isAddress } from "viem";
import { brandById, skuOf } from "@/lib/catalog";
import { fulfillerAccount, isCoveredTab, signQuote } from "@/lib/server/fulfiller";

/** POST { tab, creator, brand, amount } -> a price signed for five minutes. */
export async function POST(req: Request) {
  const { tab, creator, brand, amount } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const b = typeof brand === "string" ? brandById(brand) : undefined;
  if (typeof tab !== "string" || typeof creator !== "string" || !isAddress(tab) || !isAddress(creator) || !b || !b.amounts.includes(Number(amount))) {
    return Response.json({ error: "Unknown card." }, { status: 400 });
  }
  if (!fulfillerAccount()) return Response.json({ error: "Card orders are not set up on this server." }, { status: 503 });
  if (!(await isCoveredTab(tab, creator))) return Response.json({ error: "This is not your tab." }, { status: 403 });
  try {
    return Response.json(await signQuote(tab, skuOf(b.id, Number(amount)), Number(amount) * 100));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
