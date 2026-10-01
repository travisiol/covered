import { isAddress, isHex, recoverMessageAddress } from "viem";
import { revealMessage, tabAbi } from "@/lib/covered";
import { chain } from "@/lib/server/fulfiller";
import { unseal, type Card } from "@/lib/server/seal";

/** POST { tab, id, issuedAt, signature } -> the card code, to the tab's creator only. */
export async function POST(req: Request) {
  const { tab, id, issuedAt, signature } = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof tab !== "string" || !isAddress(tab) || !Number.isInteger(id) || typeof issuedAt !== "number" || !isHex(signature)) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (Math.abs(Date.now() - issuedAt) > 5 * 60_000) return Response.json({ error: "Signature expired, try again." }, { status: 401 });
  const [signer, creator, sealed] = await Promise.all([
    recoverMessageAddress({ message: revealMessage(tab, id as number, issuedAt), signature }),
    chain.readContract({ address: tab, abi: tabAbi, functionName: "creator" }),
    chain.readContract({ address: tab, abi: tabAbi, functionName: "sealedCard", args: [BigInt(id as number)] }),
  ]);
  if (signer.toLowerCase() !== creator.toLowerCase()) {
    return Response.json({ error: "Only the balance's owner can read its cards." }, { status: 403 });
  }
  const card = sealed === "0x" ? null : unseal<Card>(sealed);
  if (!card) return Response.json({ error: "This card has not been delivered yet." }, { status: 404 });
  return Response.json({ code: card.code, pin: card.pin ?? null });
}
