// Creates the operator of a Covered deployment: a fresh key (owner, fulfiller
// and treasury of the router to begin with) and the server secrets, written to
// .env.local. Prints the public values only. Refuses to overwrite an operator.
//   node scripts/new-operator.mjs
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const FILE = ".env.local";
const current = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";
if (/^FULFILLER_PRIVATE_KEY=0x[0-9a-fA-F]{64}/m.test(current)) {
  console.error(`${FILE} already holds an operator key. Changing it changes the router address: remove it by hand if that is what you want.`);
  process.exit(1);
}

const key = generatePrivateKey();
const operator = privateKeyToAccount(key).address;
const secret = () => randomBytes(24).toString("base64url");

writeFileSync(
  FILE,
  [
    "# Written by scripts/new-operator.mjs. Never commit this file.",
    "# The operator key is the router's owner, fulfiller and treasury. Back it up:",
    "# losing it loses the treasury's ETH, and CARDS_SECRET decrypts every card code.",
    `NEXT_PUBLIC_OPERATOR_ADDRESS=${operator}`,
    `FULFILLER_PRIVATE_KEY=${key}`,
    `CARDS_SECRET=${secret()}`,
    `CRON_SECRET=${secret()}`,
    `ADMIN_SECRET=${secret()}`,
    "",
  ].join("\n"),
);
console.log("operator", operator);
console.log(`secrets written to ${FILE}`);
