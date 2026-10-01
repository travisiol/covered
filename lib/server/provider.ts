import "server-only";
import type { Card } from "./seal";

// Who supplies the cards.
//
//   "reloadly"  bought automatically through Reloadly's gift card API. Written
//               against their documentation (https://docs.reloadly.com/gift-cards)
//               and NOT yet run with real credentials.
//   "manual"    the default: an order waits, locked in the creator's balance,
//               until the operator delivers its code from /admin.
//   "dev"       DEV_SUPPLIER=1 on a local fork: returns codes that say what they
//               are. Ignored in production.
//
//   RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET   API credentials
//   RELOADLY_SANDBOX=true                         use the sandbox
//   RELOADLY_PRODUCTS={"netflix":1234,...}        our brand id -> their productId
//   RELOADLY_SENDER_NAME                          name printed on the order

const sandbox = process.env.RELOADLY_SANDBOX === "true";
const BASE = sandbox ? "https://giftcards-sandbox.reloadly.com" : "https://giftcards.reloadly.com";
const ACCEPT = "application/com.reloadly.giftcards-v1+json";

const products = (): Record<string, number> => JSON.parse(process.env.RELOADLY_PRODUCTS || "{}");

export function supplier(): "reloadly" | "manual" | "dev" {
  if (process.env.DEV_SUPPLIER === "1" && process.env.NODE_ENV !== "production") return "dev";
  if (process.env.RELOADLY_CLIENT_ID && process.env.RELOADLY_CLIENT_SECRET && Object.keys(products()).length) return "reloadly";
  return "manual";
}

/** Whether a brand's card is bought automatically; anything else is delivered by hand. */
export const automatic = (brandId: string) => supplier() === "dev" || (supplier() === "reloadly" && products()[brandId] !== undefined);

let token: { value: string; until: number } | null = null;

async function auth(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const r = await fetch("https://auth.reloadly.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.RELOADLY_CLIENT_ID,
      client_secret: process.env.RELOADLY_CLIENT_SECRET,
      grant_type: "client_credentials",
      audience: BASE,
    }),
  });
  if (!r.ok) throw new Error(`Supplier sign-in failed (${r.status}).`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 };
  return token.value;
}

/**
 * Buy one card. `ref` makes the order idempotent on the supplier's side. With
 * an `email`, the supplier also sends the card straight to that inbox.
 */
export async function buyCard(brandId: string, usd: number, ref: string, email?: string | null): Promise<Card> {
  if (supplier() === "dev") return { code: `TEST-${brandId.toUpperCase()}-${usd}-NOT-A-REAL-CARD` };
  const productId = products()[brandId];
  if (productId === undefined) throw new Error(`No supplier product for ${brandId}.`);
  const headers = { accept: ACCEPT, "content-type": "application/json", authorization: `Bearer ${await auth()}` };
  const order = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      productId,
      quantity: 1,
      unitPrice: usd,
      customIdentifier: ref,
      senderName: process.env.RELOADLY_SENDER_NAME ?? "Covered",
      ...(email ? { recipientEmail: email } : {}),
    }),
  });
  if (!order.ok) throw new Error(`Supplier refused the order (${order.status}): ${(await order.text()).slice(0, 200)}`);
  const { transactionId } = (await order.json()) as { transactionId: number };
  const cards = await fetch(`${BASE}/orders/transactions/${transactionId}/cards`, { headers });
  if (!cards.ok) throw new Error(`Supplier did not return the card (${cards.status}).`);
  const [card] = (await cards.json()) as { cardNumber: string; pinCode?: string }[];
  return { code: card.cardNumber, pin: card.pinCode || undefined };
}
