import { robinhood } from "@/lib/config";

const RPC = process.env.ROBINHOOD_RPC_URL ?? robinhood.rpcUrls.default.http[0];

// Read-only relay: the browser never sends a transaction through here (the
// wallet does that), so anything that is not a read is refused.
const ALLOWED = new Set([
  "eth_call",
  "eth_chainId",
  "eth_blockNumber",
  "eth_getCode",
  "eth_getBalance",
  "eth_getLogs",
  "eth_getBlockByNumber",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getTransactionCount",
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const calls = Array.isArray(body) ? body : [body];
  if (!body || calls.length > 50 || calls.some((c) => !c || !ALLOWED.has(c.method))) {
    return Response.json({ error: "Method not allowed" }, { status: 400 });
  }
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}
