import { parseAbi } from "viem";

// Hand-written mirrors of contracts/contracts/*.sol, so viem can type every
// call. The compiled ABIs sit next to this file in lib/abi.
export const routerAbi = parseAbi([
  "constructor(address owner_, address ponsEscrow_, address ponsFactory_, address fulfiller_, address treasury_)",
  "function predictTab(address creator) view returns (address)",
  "function isOpen(address creator) view returns (bool)",
  "function openTab(address creator) returns (address)",
  "function pullMany(address[] list)",
  "function setup(bytes32[] skus, uint32[] usdCents, uint32[] periodDays, uint256[] maxWei, bytes sealedContact) returns (address)",
  "function creatorOf(address tab) view returns (address)",
  "function fulfiller() view returns (address)",
  "function treasury() view returns (address)",
  "function owner() view returns (address)",
  "function creatorCount() view returns (uint256)",
  "function creators(uint256) view returns (address)",
]);

export const tabAbi = parseAbi([
  "struct Order { bytes32 sku; uint32 usdCents; uint64 createdAt; uint8 status; bool recurring; uint256 weiAmount; }",
  "function creator() view returns (address)",
  "function available() view returns (uint256)",
  "function locked() view returns (uint256)",
  "function totalPulled() view returns (uint256)",
  "function pendingInEscrow() view returns (uint256)",
  "function pull() returns (uint256)",
  "function withdraw(address to, uint256 amount)",
  "function redeem(bytes32 sku, uint32 usdCents, uint256 weiAmount, uint256 expiry, uint256 nonce, bytes signature) returns (uint256)",
  "function setPlan(bytes32 sku, uint32 usdCents, uint32 periodDays, uint256 maxWei)",
  "function setPlans(bytes32[] skus, uint32[] usdCents, uint32[] periodDays, uint256[] maxWei)",
  "function cancelPlan(bytes32 sku)",
  "function charge(bytes32 sku, uint256 weiAmount) returns (uint256)",
  "function fulfill(uint256 id, bytes sealedCode)",
  "function sealedCard(uint256 id) view returns (bytes)",
  "function contact() view returns (bytes)",
  "function setContact(bytes sealedContact)",
  "function refund(uint256 id)",
  "function orderCount() view returns (uint256)",
  "function orders(uint256 id) view returns (Order)",
  "function allOrders() view returns (Order[])",
  "function planSkus() view returns (bytes32[])",
  "function plans(bytes32 sku) view returns (uint32 usdCents, uint32 periodDays, uint64 nextDue, bool active, uint256 maxWei)",
  "event Ordered(uint256 indexed id, bytes32 indexed sku, uint32 usdCents, uint256 weiAmount, bool recurring)",
]);

export const ORDER_STATUS = ["none", "open", "delivered", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const quoteTypes = {
  Quote: [
    { name: "tab", type: "address" },
    { name: "sku", type: "bytes32" },
    { name: "usdCents", type: "uint32" },
    { name: "weiAmount", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const quoteDomain = (tab: `0x${string}`, chainId: number) =>
  ({ name: "Covered", version: "1", chainId, verifyingContract: tab }) as const;

/** The message a creator signs to read a delivered card code. */
export const revealMessage = (tab: string, id: number, issuedAt: number) =>
  `Covered: show me the gift card of order ${id} on tab ${tab.toLowerCase()}.\nIssued at ${issuedAt}.`;
