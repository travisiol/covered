import { concat, defineChain, encodeAbiParameters, getContractAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import artifact from "./abi/CoveredRouter.bytecode.json";

// The brand lives here. Rename the project by changing these strings.
export const BRAND = {
  name: "Covered",
  ticker: "COVERED",
  tagline: "Your coin. Your fees. Your everyday.",
  x: "",
  // Appended to a coin's description so anyone reading it knows where the fees go.
  feeLine: "Creator fees pay for gift cards via Covered",
};

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

// pons v2 on Robinhood Chain. Read from the chain on 2026-10-01 (scripts/probe-pons.mjs).
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address,
  forwarder: "0xe33e9e479df8802cb0866d5d05258bec4cf62948" as Address,
  escrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as Address,
  // A new curve: 1.68 ETH of virtual quote against 1e9 tokens, 1% fee on the way in.
  phantomQuote: 1_680_000_000_000_000_000n,
  launchSupply: 1_000_000_000n * 10n ** 18n,
  feeBps: 100n,
  // pons keeps 30% of the 1% trading fee; the creator gets the other 70%.
  creatorShareOfFee: 0.7,
  maxCreatorTaxBps: 1000,
  redirectTimelockDays: 3,
};

const env = (v: string | undefined) => (v && /^0x[0-9a-fA-F]{40}$/.test(v.trim()) ? (v.trim() as Address) : null);

// The canonical deterministic deployment proxy (Arachnid), present on Robinhood Chain.
export const CREATE2_PROXY: Address = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const ROUTER_SALT = keccak256(stringToHex("covered:router:v1"));

/**
 * The router's address is fixed by its bytecode and three addresses, so it is
 * known before anyone deploys it, and any wallet can send the deployment.
 * lib/abi/CoveredRouter.bytecode.json is therefore part of the address: once
 * coins point at this router, that file must not change.
 */
export function routerDeployment(owner: Address, fulfiller: Address, treasury: Address) {
  const args = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }],
    [owner, PONS.escrow, PONS.factory, fulfiller, treasury],
  );
  const initCode = concat([artifact.bytecode as Hex, args]);
  return {
    address: getContractAddress({ opcode: "CREATE2", from: CREATE2_PROXY, salt: ROUTER_SALT, bytecode: initCode }),
    to: CREATE2_PROXY,
    data: concat([ROUTER_SALT, initCode]),
  };
}

/** The operator: owner, fulfiller and treasury of the router to begin with. Its key is FULFILLER_PRIVATE_KEY. */
export const OPERATOR = env(process.env.NEXT_PUBLIC_OPERATOR_ADDRESS);
/** How to deploy the router, for whoever gets there first. */
export const ROUTER = OPERATOR ? routerDeployment(OPERATOR, OPERATOR, OPERATOR) : null;
/** The router this site uses. NEXT_PUBLIC_ROUTER_ADDRESS overrides it (a local fork). */
export const ROUTER_ADDRESS = env(process.env.NEXT_PUBLIC_ROUTER_ADDRESS) ?? ROUTER?.address ?? null;
export const IS_LIVE = ROUTER_ADDRESS !== null;

/** Added on top of a card's face value: covers the card supplier's margin and the gas we pay. */
export const SERVICE_FEE_BPS = 300;
export const QUOTE_TTL_SECONDS = 300;
export const REFUND_DELAY_HOURS = 48;
export const PLAN_PERIOD_DAYS = 30;
/** A plan's per-charge wei cap is set to this multiple of today's quote. */
export const PLAN_MAX_WEI_MULTIPLE = 2;

export const explorerTx = (hash: string) => `${robinhood.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddress = (a: string) => `${robinhood.blockExplorers.default.url}/address/${a}`;
