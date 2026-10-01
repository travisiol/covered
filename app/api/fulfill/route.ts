import { isAddress } from "viem";
import { tabAbi } from "@/lib/covered";
import { deliver } from "@/lib/server/deliver";
import { chain, isCoveredTab } from "@/lib/server/fulfiller";

export const maxDuration = 60;

/** POST { tab, id } -> buys and delivers the card of an open order. Safe to call twice. */
export async function POST(req: Request) {
  const { tab, id } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof tab !== "string" || !isAddress(tab) || !Number.isInteger(id) || (id as number) < 0) {
    return Response.json({ error: "Unknown order." }, { status: 400 });
  }
  const creator = await chain.readContract({ address: tab, abi: tabAbi, functionName: "creator" }).catch(() => null);
  if (!creator || !(await isCoveredTab(tab, creator))) return Response.json({ error: "Unknown tab." }, { status: 404 });
  const result = await deliver(tab, id as number);
  return Response.json(result.ok ? result : { ...result, error: result.reason }, { status: result.ok ? 200 : result.status === "not-configured" ? 503 : 409 });
}
