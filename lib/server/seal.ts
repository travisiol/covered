import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Hex } from "viem";

// Card codes and delivery e-mails are kept on chain, encrypted with a key only
// this server holds. Nothing is stored on the server itself, so nothing is
// lost on a redeploy. Losing CARDS_SECRET loses every stored code.
export type Card = { code: string; pin?: string };

const key = () => {
  const secret = process.env.CARDS_SECRET;
  if (!secret) throw new Error("CARDS_SECRET is not set.");
  return createHash("sha256").update("covered-seal:" + secret).digest();
};

export function seal(value: unknown): Hex {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return `0x${Buffer.concat([iv, c.getAuthTag(), body]).toString("hex")}`;
}

export function unseal<T>(sealed: Hex): T | null {
  try {
    const buf = Buffer.from(sealed.slice(2), "hex");
    if (buf.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8"));
  } catch {
    return null;
  }
}
