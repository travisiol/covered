import { SERVICE_FEE_BPS } from "./config";

export const usd = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const weiToUsd = (wei: bigint, ethUsd: number) => (Number(wei / 10n ** 10n) / 1e8) * ethUsd;

export const eth = (wei: bigint, digits = 5) => (Number(wei / 10n ** 10n) / 1e8).toFixed(digits);

/** Wei for a card of `usdCents`, service fee included, rounded up. Same maths on server and client. */
export function weiFor(usdCents: number, ethPrice: number): bigint {
  const total = (BigInt(usdCents) * BigInt(10_000 + SERVICE_FEE_BPS)) / 10_000n;
  const priceCents = BigInt(Math.round(ethPrice * 100));
  return (total * 10n ** 18n + priceCents - 1n) / priceCents;
}

export const priceWithFee = (faceUsd: number) => faceUsd * (1 + SERVICE_FEE_BPS / 10_000);

export function ago(seconds: number): string {
  const d = Math.max(0, Date.now() / 1000 - seconds);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return `${Math.floor(d / 86400)} d ago`;
}

export function until(seconds: number): string {
  const d = seconds - Date.now() / 1000;
  if (d <= 0) return "as soon as the balance allows";
  if (d < 86400) return `in ${Math.ceil(d / 3600)} h`;
  return `in ${Math.ceil(d / 86400)} days`;
}
